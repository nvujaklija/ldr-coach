"""Couple onboarding routes: create a couple, invite a partner, join one."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.models import Couple, CoupleInvite, CoupleMember
from app.schemas.couple import CoupleCreate, CoupleJoin, CoupleOut, InviteOut
from app.services import couples as service

router = APIRouter(prefix="/couples", tags=["couples"])


def _require_couple(db: DbSession, user_id: str) -> Couple:
    couple = service.get_couple_for_user(db, user_id)
    if couple is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not part of a couple yet",
        )
    return couple


@router.post("", response_model=CoupleOut, status_code=status.HTTP_201_CREATED)
def create_couple(payload: CoupleCreate, current_user: CurrentUser, db: DbSession) -> CoupleOut:
    if service.get_membership(db, current_user.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already belong to a couple",
        )
    couple = Couple(name=payload.name)
    db.add(couple)
    db.flush()
    db.add(CoupleMember(couple_id=couple.id, user_id=current_user.id))
    db.commit()
    db.refresh(couple)
    return service.build_couple_out(db, couple)


@router.post("/invites", response_model=InviteOut, status_code=status.HTTP_201_CREATED)
def create_invite(current_user: CurrentUser, db: DbSession) -> InviteOut:
    couple = _require_couple(db, current_user.id)
    if service.member_count(db, couple.id) >= service.MAX_MEMBERS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This couple already has both partners",
        )
    invite = CoupleInvite(
        couple_id=couple.id,
        code=service.generate_invite_code(db),
        created_by_id=current_user.id,
        expires_at=datetime.now(UTC) + timedelta(days=settings.INVITE_EXPIRE_DAYS),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return InviteOut(
        code=invite.code,
        invite_url=service.invite_url(invite.code),
        expires_at=invite.expires_at,
        accepted=False,
    )


@router.post("/join", response_model=CoupleOut)
def join_couple(payload: CoupleJoin, current_user: CurrentUser, db: DbSession) -> CoupleOut:
    if service.get_membership(db, current_user.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already belong to a couple",
        )
    invite = db.scalar(select(CoupleInvite).where(CoupleInvite.code == payload.code))
    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code",
        )
    if invite.accepted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This invite has already been used",
        )
    # SQLite returns naive datetimes even for timezone-aware columns; treat
    # a stored value without tzinfo as UTC so the comparison stays correct.
    expires_at = invite.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at < datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite has expired",
        )

    couple = db.get(Couple, invite.couple_id)
    if couple is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code",
        )
    if service.member_count(db, couple.id) >= service.MAX_MEMBERS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This couple already has both partners",
        )

    db.add(CoupleMember(couple_id=couple.id, user_id=current_user.id))
    invite.accepted_by_id = current_user.id
    invite.accepted_at = datetime.now(UTC)
    db.commit()
    db.refresh(couple)
    return service.build_couple_out(db, couple)
