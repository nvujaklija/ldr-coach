"""A couple and its membership.

A couple groups two users. Membership is modeled with a join table so the
schema stays flexible (roles, future invite flows) rather than hard-coding
two foreign keys on the couple.
"""

from sqlalchemy import ForeignKey, String
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
