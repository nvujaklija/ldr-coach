"""A daily mood / connection check-in posted by one partner.

One check-in per user per calendar day (enforced by a unique constraint);
posting again for the same day updates the existing row. ``couple_id`` is
nullable so a user can check in before they're matched into a couple — it is
backfilled from their couple membership when one exists.
"""

from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base, TimestampMixin, UUIDMixin


class CheckIn(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "check_ins"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_check_in_user_date"),)

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    couple_id: Mapped[str | None] = mapped_column(
        ForeignKey("couples.id", ondelete="CASCADE"), index=True, nullable=True
    )
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    # 1 (low) .. 5 (high); the range is validated at the schema layer.
    mood_score: Mapped[int] = mapped_column(Integer, nullable=False)
    connection_score: Mapped[int] = mapped_column(Integer, nullable=False)
    # Free-form short labels, e.g. ["tired", "missing-you"].
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
