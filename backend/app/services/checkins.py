"""Daily check-in domain logic.

Check-ins are scoped to the logged-in user's couple when they belong to one,
falling back to just their own otherwise. Couple membership is resolved
through ``app.services.couples`` so there is a single source of truth for
"which couple is this user in" across the codebase.
"""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CheckIn
from app.schemas.check_in import (
    CheckInAverages,
    CheckInCreate,
    CheckInList,
    CheckInOut,
)
from app.services import couples as couple_service

DEFAULT_RANGE_DAYS = 30
MAX_RANGE_DAYS = 365


def _couple_id_for(db: Session, user_id: str) -> str | None:
    membership = couple_service.get_membership(db, user_id)
    return membership.couple_id if membership is not None else None


def _visible_user_ids(db: Session, user_id: str, couple_id: str | None) -> list[str]:
    """User ids whose check-ins the caller may see: both partners, or just them."""
    if couple_id is None:
        return [user_id]
    return couple_service.member_user_ids(db, couple_id)


def _averages(check_ins: list[CheckIn]) -> CheckInAverages:
    if not check_ins:
        return CheckInAverages(count=0, mood_score=None, connection_score=None)
    n = len(check_ins)
    return CheckInAverages(
        count=n,
        mood_score=round(sum(c.mood_score for c in check_ins) / n, 2),
        connection_score=round(sum(c.connection_score for c in check_ins) / n, 2),
    )


def upsert_today(db: Session, user_id: str, payload: CheckInCreate) -> tuple[CheckIn, bool]:
    """Create or update today's check-in for the user.

    Returns ``(check_in, created)`` so the route can signal 201 vs 200.
    """
    today = date.today()
    couple_id = _couple_id_for(db, user_id)

    check_in = db.scalar(select(CheckIn).where(CheckIn.user_id == user_id, CheckIn.date == today))
    created = check_in is None
    if check_in is None:
        check_in = CheckIn(user_id=user_id, date=today)
        db.add(check_in)

    # Backfill couple membership in case the user was matched after a prior day.
    check_in.couple_id = couple_id
    check_in.mood_score = payload.mood_score
    check_in.connection_score = payload.connection_score
    check_in.tags = payload.tags
    check_in.note = payload.note

    db.commit()
    db.refresh(check_in)
    return check_in, created


def list_check_ins(db: Session, user_id: str, days: int) -> CheckInList:
    couple_id = _couple_id_for(db, user_id)
    user_ids = _visible_user_ids(db, user_id, couple_id)
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
