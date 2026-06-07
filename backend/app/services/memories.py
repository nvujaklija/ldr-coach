"""Shared memory-timeline writer.

The memory timeline is fed from two directions: partners add memories by hand
(``POST /memories``), and other features auto-record a memory when something
worth remembering is completed (a visit, a milestone, a ritual occurrence).

To keep that cross-cutting behaviour in one place — rather than duplicating the
"build a MemoryItem and add it" dance across the visits/milestones/rituals
routes — those slices call ``record_memory`` here. The helper only ``add``s and
``flush``es the row; it deliberately does not commit, so the memory is written
in the same transaction as the state change that triggered it (e.g. a visit
flipping to "completed"). The calling route's existing ``db.commit()`` persists
both atomically.
"""

from typing import TYPE_CHECKING, Any

from sqlalchemy.orm import Session

from app.models import MemoryItem
from app.models.memory_item import MEMORY_ITEM_TYPES

if TYPE_CHECKING:
    from app.models import CoupleRitual, Milestone, RitualInstance, Visit


def record_memory(
    db: Session,
    *,
    couple_id: str,
    type: str,
    data: dict[str, Any],
    created_by_id: str | None = None,
) -> MemoryItem:
    """Add a memory to the couple's timeline within the current transaction.

    Flushes so the new row gets an id, but leaves the commit to the caller so
    the memory and whatever triggered it land atomically. ``created_by_id`` is
    None for system-recorded memories.
    """
    if type not in MEMORY_ITEM_TYPES:
        raise ValueError(f"type must be one of {MEMORY_ITEM_TYPES}")
    item = MemoryItem(
        couple_id=couple_id,
        created_by_id=created_by_id,
        type=type,
        data=data,
    )
    db.add(item)
    db.flush()
    return item


def record_visit_completed(db: Session, visit: "Visit") -> MemoryItem:
    """Timeline entry for a visit that just turned ``completed``."""
    return record_memory(
        db,
        couple_id=visit.couple_id,
        type="visit",
        data={
            "source": "visit",
            "title": f"Visited {visit.location}",
            "location": visit.location,
            "start_date": visit.start_date.isoformat(),
            "end_date": visit.end_date.isoformat() if visit.end_date else None,
        },
    )


def record_milestone_done(db: Session, milestone: "Milestone") -> MemoryItem:
    """Timeline entry for a milestone that was just checked off."""
    return record_memory(
        db,
        couple_id=milestone.couple_id,
        type="note",
        data={
            "source": "milestone",
            "title": f"Completed: {milestone.title}",
            "milestone_id": milestone.id,
            "visit_id": milestone.visit_id,
        },
    )


def record_ritual_done(
    db: Session, ritual: "CoupleRitual", instance: "RitualInstance"
) -> MemoryItem:
    """Timeline entry for a ritual occurrence marked done."""
    return record_memory(
        db,
        couple_id=ritual.couple_id,
        type="ritual",
        data={
            "source": "ritual",
            "title": ritual.title,
            "ritual_id": ritual.id,
            "scheduled_for": instance.scheduled_for.isoformat(),
        },
    )
