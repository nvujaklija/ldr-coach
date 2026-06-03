"""A planned or past in-person visit between partners."""

from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

# Lifecycle of a visit. A couple may have at most one "planned" visit at a
# time — that is their active "next visit". Past trips become "completed".
VISIT_STATUSES = ("planned", "completed", "cancelled")


class Visit(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "visits"

    couple_id: Mapped[str] = mapped_column(
        ForeignKey("couples.id", ondelete="CASCADE"), index=True, nullable=False
    )
    location: Mapped[str] = mapped_column(String(200), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="planned", nullable=False)
