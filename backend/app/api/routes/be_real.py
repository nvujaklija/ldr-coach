"""BeReal-for-couples routes.

Endpoints (all couple-scoped):
    GET  /be-real/status                 schedule + next moment in each tz
    POST /be-real/enable                 turn it on (queues the first moment)
    POST /be-real/disable                turn it off
    POST /be-real/moments/{id}/post      upload this partner's photo
    GET  /be-real/moments                paginated past/current moments
    GET  /be-real/moments/{id}           one moment with visible posts
"""

import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select

from app.api.deps import CurrentCouple, CurrentUser, DbSession
from app.core.config import settings
from app.models import BeRealMoment, BeRealPost, Couple, CoupleMember, User
from app.schemas.be_real import (
    BeRealEnable,
    BeRealMomentList,
    BeRealMomentOut,
    BeRealPostOut,
    BeRealStatusOut,
    PartnerTimeOut,
)
from app.services import be_real as service

router = APIRouter(prefix="/be-real", tags=["be-real"])

# Image content types we accept for a BeReal photo, and their saved extension.
_EXTENSION_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
}


def _serialize_moment(db: DbSession, moment: BeRealMoment, viewer_id: str) -> BeRealMomentOut:
    posts = service.posts_for_moment(db, moment.id)
    visible = service.visible_posts(moment, posts, viewer_id)
    return BeRealMomentOut(
        id=moment.id,
        scheduled_utc=moment.scheduled_utc,
        status=moment.status,
        is_open=service.moment_is_open(moment),
        you_posted=any(p.user_id == viewer_id for p in posts),
        partner_posted=any(p.user_id != viewer_id for p in posts),
        posts=[BeRealPostOut.model_validate(p) for p in visible],
    )


def _member_count(db: DbSession, couple_id: str) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(CoupleMember)
            .where(CoupleMember.couple_id == couple_id)
        )
        or 0
    )


def _get_owned_moment(db: DbSession, moment_id: str, couple_id: str) -> BeRealMoment:
    moment = db.get(BeRealMoment, moment_id)
    if moment is None or moment.couple_id != couple_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found")
    return moment


def _build_status(db: DbSession, couple: Couple, viewer_id: str) -> BeRealStatusOut:
    schedule = service.get_or_create_schedule(db, couple.id)
    # Keep an upcoming moment materialised while active (mirrors rituals).
    moment = service.ensure_upcoming_moment(db, couple)
    db.refresh(schedule)

    reference = moment.scheduled_utc if moment is not None else schedule.next_utc
    partners: list[PartnerTimeOut] = []
    rows = db.execute(
        select(CoupleMember, User)
        .join(User, User.id == CoupleMember.user_id)
        .where(CoupleMember.couple_id == couple.id)
        .order_by(CoupleMember.created_at)
    ).all()
    for _member, user in rows:
        local_time: str | None = None
        if reference is not None:
            ref = reference if reference.tzinfo else reference.replace(tzinfo=UTC)
            local_time = ref.astimezone(ZoneInfo(user.timezone)).isoformat()
        partners.append(
            PartnerTimeOut(
                user_id=user.id,
                display_name=user.display_name,
                timezone=user.timezone,
                local_time=local_time,
            )
        )

    return BeRealStatusOut(
        is_active=schedule.is_active,
        next_utc=schedule.next_utc,
        current_moment=(_serialize_moment(db, moment, viewer_id) if moment is not None else None),
        partners=partners,
    )


@router.get("/status", response_model=BeRealStatusOut)
def get_status(db: DbSession, couple: CurrentCouple, current_user: CurrentUser) -> BeRealStatusOut:
    return _build_status(db, couple, current_user.id)


@router.post("/enable", response_model=BeRealStatusOut)
def enable(
    payload: BeRealEnable, db: DbSession, couple: CurrentCouple, current_user: CurrentUser
) -> BeRealStatusOut:
    if payload.timezone is not None:
        current_user.timezone = payload.timezone
    schedule = service.get_or_create_schedule(db, couple.id)
    schedule.is_active = True
    db.commit()
    return _build_status(db, couple, current_user.id)


@router.post("/disable", response_model=BeRealStatusOut)
def disable(db: DbSession, couple: CurrentCouple, current_user: CurrentUser) -> BeRealStatusOut:
    schedule = service.get_or_create_schedule(db, couple.id)
    schedule.is_active = False
    schedule.next_utc = None
    # Drop the queued (not-yet-posted) moment so nothing fires while off.
    for moment in db.scalars(
        select(BeRealMoment).where(
            BeRealMoment.couple_id == couple.id, BeRealMoment.status == "waiting"
        )
    ):
        moment.status = "expired"
    db.commit()
    return _build_status(db, couple, current_user.id)


@router.post("/moments/{moment_id}/post", response_model=BeRealMomentOut)
async def post_photo(
    moment_id: str,
    db: DbSession,
    couple: CurrentCouple,
    current_user: CurrentUser,
    image: Annotated[UploadFile, File()],
) -> BeRealMomentOut:
    moment = _get_owned_moment(db, moment_id, couple.id)
    if not service.moment_is_open(moment):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This moment is not open for posting",
        )
    if image.content_type not in _EXTENSION_BY_TYPE:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported image type",
        )
    if any(p.user_id == current_user.id for p in service.posts_for_moment(db, moment.id)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="You already posted for this moment"
        )

    data = await image.read()
    if len(data) > settings.BE_REAL_MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image too large"
        )

    ext = _EXTENSION_BY_TYPE[image.content_type]
    filename = f"{moment.id}_{current_user.id}_{uuid.uuid4().hex}{ext}"
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    (upload_dir / filename).write_bytes(data)

    db.add(
        BeRealPost(
            moment_id=moment.id,
            user_id=current_user.id,
            image_url=f"{settings.API_PREFIX}/media/{filename}",
            posted_at=datetime.now(UTC),
        )
    )
    db.flush()

    # Mark complete once every partner has posted.
    if len(service.posts_for_moment(db, moment.id)) >= _member_count(db, couple.id):
        moment.status = "completed"
    db.commit()
    db.refresh(moment)
    return _serialize_moment(db, moment, current_user.id)


@router.get("/moments", response_model=BeRealMomentList)
def list_moments(
    db: DbSession,
    couple: CurrentCouple,
    current_user: CurrentUser,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> BeRealMomentList:
    total = (
        db.scalar(
            select(func.count())
            .select_from(BeRealMoment)
            .where(BeRealMoment.couple_id == couple.id)
        )
        or 0
    )
    moments = list(
        db.scalars(
            select(BeRealMoment)
            .where(BeRealMoment.couple_id == couple.id)
            .order_by(BeRealMoment.scheduled_utc.desc())
            .limit(limit)
            .offset(offset)
        )
    )
    return BeRealMomentList(
        moments=[_serialize_moment(db, m, current_user.id) for m in moments],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/moments/{moment_id}", response_model=BeRealMomentOut)
def get_moment(
    moment_id: str, db: DbSession, couple: CurrentCouple, current_user: CurrentUser
) -> BeRealMomentOut:
    moment = _get_owned_moment(db, moment_id, couple.id)
    return _serialize_moment(db, moment, current_user.id)
