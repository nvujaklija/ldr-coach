"""A single entry in a couple's shared memory timeline.

Memories are deliberately schema-light: each row is a ``type`` plus a free-form
``data`` JSON blob, so the timeline can hold heterogeneous moments (a photo, a
hand-written note, an auto-recorded completed visit or ritual) without a table
per kind. Auto-recorded memories — written by the shared ``memories`` service
when a visit, milestone, or ritual is completed — carry a ``source`` key in
``data`` and a null ``created_by_id``.
"""

from typing import Any

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base, TimestampMixin, UUIDMixin

# The kinds of moment a memory can capture.
MEMORY_ITEM_TYPES = ("photo", "note", "ritual", "visit")


class MemoryItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "memory_items"

    couple_id: Mapped[str] = mapped_column(
        ForeignKey("couples.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Who added it; null for memories auto-recorded by the system.
    created_by_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    # Kind-specific payload, e.g. {"title": ..., "note": ...} or
    # {"title": ..., "source": "visit", "location": ...}.
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
