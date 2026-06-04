"""Daily mood/connection check-in routes.

Check-ins are scoped to the logged-in user's couple when they belong to one,
falling back to just their own check-ins otherwise. Submitting is idempotent
per calendar day: posting again for today updates that day's row.
"""

from datetime import date, timedelta

from fastapi import APIRouter, Query, Response, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models import CheckIn, CoupleMember
from app.schemas.check_in import (
    CheckInAverages,
    CheckInCreate,
    CheckInList,
    CheckInOut,
)

router = APIRouter(prefix="/checkins", tags=["checkins"])

DEFAULT_RANGE_DAYS = 30
MAX_RANGE_DAYS = 365


def _couple_id_for(db: DbSession, user_id: str) -> str | None:
    """Return the couple this user belongs to, or None if unmatched."""
    return db.scalar(
        select(CoupleMember.couple_id).where(CoupleMember.user_id == user_id)
    )


def _visible_user_ids(db: DbSession, user_id: str, couple_id: str | None) -> list[str]:
    """User ids whose check-ins the caller may see: both partners, or just them."""
    if couple_id is None:
        return [user_id]
    return list(
        db.scalars(
            select(CoupleMember.user_id).where(CoupleMember.couple_id == couple_id)
        )
    )


def _averages(check_ins: list[CheckIn]) -> CheckInAverages:
    if not check_ins:
        return CheckInAverages(count=0, mood_score=None, connection_score=None)
    n = len(check_ins)
    return CheckInAverages(
        count=n,
        mood_score=round(sum(c.mood_score for c in check_ins) / n, 2),
        connection_score=round(sum(c.connection_score for c in check_ins) / n, 2),
    )


@router.post("/today", response_model=CheckInOut)
def upsert_today(
    payload: CheckInCreate,
    db: DbSession,
    current_user: CurrentUser,
    response: Response,
) -> CheckIn:
    today = date.today()
    couple_id = _couple_id_for(db, current_user.id)

    check_in = db.scalar(
        select(CheckIn).where(
            CheckIn.user_id == current_user.id, CheckIn.date == today
        )
    )
    if check_in is None:
        check_in = CheckIn(user_id=current_user.id, date=today)
        db.add(check_in)
        response.status_code = status.HTTP_201_CREATED

    # Backfill couple membership in case the user was matched after a prior day.
    check_in.couple_id = couple_id
    check_in.mood_score = payload.mood_score
    check_in.connection_score = payload.connection_score
    check_in.tags = payload.tags
    check_in.note = payload.note

    db.commit()
    db.refresh(check_in)
    return check_in


@router.get("", response_model=CheckInList)
def list_check_ins(
    db: DbSession,
    current_user: CurrentUser,
    days: int = Query(DEFAULT_RANGE_DAYS, ge=1, le=MAX_RANGE_DAYS),
) -> CheckInList:
    couple_id = _couple_id_for(db, current_user.id)
    user_ids = _visible_user_ids(db, current_user.id, couple_id)
    since = date.today() - timedelta(days=days - 1)

    check_ins = list(
        db.scalars(
            select(CheckIn)
            .where(CheckIn.user_id.in_(user_ids), CheckIn.date >= since)
            .order_by(CheckIn.date.desc(), CheckIn.created_at.desc())
        )
    )
    return CheckInList(
        check_ins=[CheckInOut.model_validate(c) for c in check_ins],
        averages=_averages(check_ins),
    )
