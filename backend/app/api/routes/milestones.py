"""Milestone routes: per-visit checklist items for the current couple.

Domain logic lives in ``app.services.milestones``; this module is HTTP only.
"""

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentCouple, DbSession
from app.schemas.milestone import MilestoneCreate, MilestoneOut, MilestoneUpdate
from app.services import milestones as milestone_service

router = APIRouter(prefix="/milestones", tags=["milestones"])


@router.get("", response_model=list[MilestoneOut])
def list_milestones(
    db: DbSession,
    couple: CurrentCouple,
    visit_id: str | None = Query(default=None, alias="visitId"),
) -> list[MilestoneOut]:
    return milestone_service.list_for_couple(db, couple.id, visit_id)


@router.post("", response_model=MilestoneOut, status_code=status.HTTP_201_CREATED)
def create_milestone(
    payload: MilestoneCreate, db: DbSession, couple: CurrentCouple
) -> MilestoneOut:
    if payload.visit_id is not None and not milestone_service.visit_belongs_to_couple(
        db, payload.visit_id, couple.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")
    return milestone_service.create_milestone(db, couple.id, payload)


@router.patch("/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    milestone_id: str, payload: MilestoneUpdate, db: DbSession, couple: CurrentCouple
) -> MilestoneOut:
    milestone = milestone_service.get_owned_milestone(db, milestone_id, couple.id)
    if milestone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")
    data = payload.model_dump(exclude_unset=True)
    return milestone_service.apply_update(db, milestone, data)
