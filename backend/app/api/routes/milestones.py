"""Milestone routes: per-visit checklist items for the current couple."""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.api.deps import CurrentCouple, DbSession
from app.models import Milestone, Visit
from app.schemas.milestone import MilestoneCreate, MilestoneOut, MilestoneUpdate

router = APIRouter(prefix="/milestones", tags=["milestones"])


def _assert_visit_in_couple(db: DbSession, visit_id: str, couple_id: str) -> None:
    visit = db.get(Visit, visit_id)
    if visit is None or visit.couple_id != couple_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")


@router.get("", response_model=list[MilestoneOut])
def list_milestones(
    db: DbSession,
    couple: CurrentCouple,
    visit_id: str | None = Query(default=None, alias="visitId"),
) -> list[Milestone]:
    stmt = select(Milestone).where(Milestone.couple_id == couple.id)
    if visit_id is not None:
        stmt = stmt.where(Milestone.visit_id == visit_id)
    stmt = stmt.order_by(Milestone.created_at.asc())
    return list(db.scalars(stmt))


@router.post("", response_model=MilestoneOut, status_code=status.HTTP_201_CREATED)
def create_milestone(
    payload: MilestoneCreate, db: DbSession, couple: CurrentCouple
) -> Milestone:
    if payload.visit_id is not None:
        _assert_visit_in_couple(db, payload.visit_id, couple.id)
    milestone = Milestone(
        couple_id=couple.id,
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


@router.patch("/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    milestone_id: str, payload: MilestoneUpdate, db: DbSession, couple: CurrentCouple
) -> Milestone:
    milestone = db.get(Milestone, milestone_id)
    if milestone is None or milestone.couple_id != couple.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(milestone, field, value)
    db.commit()
    db.refresh(milestone)
    return milestone
