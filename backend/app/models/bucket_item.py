"""A shared bucket-list item: something a couple wants to do together.

Items can optionally be tied to a future visit (e.g. "Lake Como day" linked to
the next trip). The visit link uses SET NULL so cancelling or deleting a visit
leaves the wish on the list rather than removing it.
"""

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

BUCKET_STATUSES = ("planned", "in_progress", "done")


class BucketItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "bucket_items"

    couple_id: Mapped[str] = mapped_column(
        ForeignKey("couples.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # Free-form grouping, e.g. "Travel", "Experience", "Habit".
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    target_visit_id: Mapped[str | None] = mapped_column(
        ForeignKey("visits.id", ondelete="SET NULL"), index=True, nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="planned", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
