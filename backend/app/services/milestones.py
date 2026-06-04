"""Milestone domain logic: a couple's per-visit checklist items."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Milestone, Visit
from app.schemas.milestone import MilestoneCreate


def list_for_couple(db: Session, couple_id: str, visit_id: str | None = None) -> list[Milestone]:
    stmt = select(Milestone).where(Milestone.couple_id == couple_id)
    if visit_id is not None:
        stmt = stmt.where(Milestone.visit_id == visit_id)
    return list(db.scalars(stmt.order_by(Milestone.created_at.asc())))


def visit_belongs_to_couple(db: Session, visit_id: str, couple_id: str) -> bool:
    visit = db.get(Visit, visit_id)
    return visit is not None and visit.couple_id == couple_id


def create_milestone(db: Session, couple_id: str, payload: MilestoneCreate) -> Milestone:
    milestone = Milestone(
        couple_id=couple_id,
        visit_id=payload.visit_id,
        title=payload.title,
        due_date=payload.due_date,
        notes=payload.notes,
        status="todo",
    )
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return milestone


def get_owned_milestone(db: Session, milestone_id: str, couple_id: str) -> Milestone | None:
    """Return the milestone only if it belongs to ``couple_id`` (else None)."""
    milestone = db.get(Milestone, milestone_id)
    if milestone is None or milestone.couple_id != couple_id:
        return None
    return milestone


def apply_update(db: Session, milestone: Milestone, data: dict) -> Milestone:
    for field, value in data.items():
        setattr(milestone, field, value)
    db.commit()
    db.refresh(milestone)
    return milestone
