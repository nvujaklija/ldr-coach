"""Visit routes: the couple's next-visit countdown and history.

Business rule: a couple may have at most one "planned" visit at a time — that
visit is their active "next visit". Creating another while one is planned is a
409; mark the current one completed/cancelled first (PATCH) to replace it.
The domain logic lives in ``app.services.visits``; this module is HTTP only.
"""

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentCouple, DbSession
from app.schemas.visit import VisitCreate, VisitOut, VisitUpdate
from app.services import visits as visit_service

router = APIRouter(prefix="/visits", tags=["visits"])

_ACTIVE_VISIT_CONFLICT = "This couple already has an active next visit"


@router.get("/next", response_model=VisitOut | None)
def get_next_visit(db: DbSession, couple: CurrentCouple) -> VisitOut | None:
    """The couple's active planned visit, or null if none is planned."""
    visit = visit_service.active_visit(db, couple.id)
    return visit_service.to_out(visit) if visit is not None else None


@router.post("", response_model=VisitOut, status_code=status.HTTP_201_CREATED)
def create_visit(payload: VisitCreate, db: DbSession, couple: CurrentCouple) -> VisitOut:
    if visit_service.active_visit(db, couple.id) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_ACTIVE_VISIT_CONFLICT)
    visit = visit_service.create_visit(db, couple.id, payload)
    return visit_service.to_out(visit)


@router.patch("/{visit_id}", response_model=VisitOut)
def update_visit(
    visit_id: str, payload: VisitUpdate, db: DbSession, couple: CurrentCouple
) -> VisitOut:
    visit = visit_service.get_owned_visit(db, visit_id, couple.id)
    if visit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")

    data = payload.model_dump(exclude_unset=True)
    # Guard the single-active-visit rule: only allow reactivating to "planned"
    # if no other planned visit exists.
    if data.get("status") == "planned" and visit.status != "planned":
        other = visit_service.active_visit(db, couple.id)
        if other is not None and other.id != visit.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_ACTIVE_VISIT_CONFLICT)
    return visit_service.to_out(visit_service.apply_update(db, visit, data))
