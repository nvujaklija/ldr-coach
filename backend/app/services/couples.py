"""Couple membership and invite helpers shared by the auth and couple routes."""

import secrets

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Couple, CoupleInvite, CoupleMember, User
from app.schemas.couple import CoupleOut, MemberOut

# A couple is exactly two partners.
MAX_MEMBERS = 2

# Unambiguous alphabet (no 0/O/1/I/L) for codes people read aloud or type.
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 8


def generate_invite_code(db: Session) -> str:
    """Return a short, human-friendly invite code unique in the DB."""
    for _ in range(10):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))
        if db.scalar(select(CoupleInvite).where(CoupleInvite.code == code)) is None:
            return code
    raise RuntimeError("Could not generate a unique invite code")


def get_membership(db: Session, user_id: str) -> CoupleMember | None:
    return db.scalar(select(CoupleMember).where(CoupleMember.user_id == user_id))


def get_couple_for_user(db: Session, user_id: str) -> Couple | None:
    membership = get_membership(db, user_id)
    if membership is None:
        return None
    return db.get(Couple, membership.couple_id)


def member_count(db: Session, couple_id: str) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(CoupleMember)
            .where(CoupleMember.couple_id == couple_id)
        )
        or 0
    )


def build_couple_out(db: Session, couple: Couple) -> CoupleOut:
    rows = db.execute(
        select(CoupleMember, User)
        .join(User, User.id == CoupleMember.user_id)
        .where(CoupleMember.couple_id == couple.id)
        .order_by(CoupleMember.created_at)
    ).all()
    members = [
        MemberOut(user_id=user.id, display_name=user.display_name, role=member.role)
        for member, user in rows
    ]
    return CoupleOut(id=couple.id, name=couple.name, members=members)


def invite_url(code: str) -> str:
    return f"{settings.FRONTEND_URL}/join?code={code}"
