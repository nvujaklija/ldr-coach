"""A checklist item attached to a visit (e.g. "book flights").

Milestones belong to a couple and are usually scoped to one visit so the
dashboard can show a per-trip to-do list. visit_id is nullable to leave room
for couple-level milestones that aren't tied to a specific trip.
"""

from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

MILESTONE_STATUSES = ("todo", "done")


class Milestone(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "milestones"

    couple_id: Mapped[str] = mapped_column(
        ForeignKey("couples.id", ondelete="CASCADE"), index=True, nullable=False
    )
    visit_id: Mapped[str | None] = mapped_column(
        ForeignKey("visits.id", ondelete="CASCADE"), index=True, nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="todo", nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
