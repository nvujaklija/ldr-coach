"""A couple, its membership, and partner invites.

A couple groups two users. Membership is modeled with a join table so the
schema stays flexible (roles, future invite flows) rather than hard-coding
two foreign keys on the couple. A CoupleInvite is a single-use, expiring
code the first partner shares so the second partner can join the couple.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Couple(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "couples"

    name: Mapped[str] = mapped_column(String(120), nullable=False)


class CoupleMember(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "couple_members"

    couple_id: Mapped[str] = mapped_column(
        ForeignKey("couples.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # e.g. "partner" — kept free-form for now
    role: Mapped[str] = mapped_column(String(40), default="partner", nullable=False)


class CoupleInvite(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "couple_invites"

    couple_id: Mapped[str] = mapped_column(
        ForeignKey("couples.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Short, human-shareable code embedded in the invite link.
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    created_by_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Set when a partner redeems the code; a non-null value marks it used.
    accepted_by_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
