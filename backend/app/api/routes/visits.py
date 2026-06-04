"""Visit routes: the couple's next-visit countdown and history.

Business rule: a couple may have at most one "planned" visit at a time — that
visit is their active "next visit". Creating another while one is planned is a
409; mark the current one completed/cancelled first (PATCH) to replace it.
"""

from datetime import date

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentCouple, DbSession
from app.models import Visit
from app.schemas.visit import VisitCreate, VisitOut, VisitUpdate

router = APIRouter(prefix="/visits", tags=["visits"])


def _to_out(visit: Visit) -> VisitOut:
    out = VisitOut.model_validate(visit)
    if visit.status == "planned":
        out.days_until = (visit.start_date - date.today()).days
    return out


def _active_visit(db: DbSession, couple_id: str) -> Visit | None:
    return db.scalar(
        select(Visit)
        .where(Visit.couple_id == couple_id, Visit.status == "planned")
        .order_by(Visit.start_date.asc())
    )


@router.get("/next", response_model=VisitOut | None)
def get_next_visit(db: DbSession, couple: CurrentCouple) -> VisitOut | None:
    """The couple's active planned visit, or null if none is planned."""
    visit = _active_visit(db, couple.id)
    return _to_out(visit) if visit is not None else None


@router.post("", response_model=VisitOut, status_code=status.HTTP_201_CREATED)
def create_visit(payload: VisitCreate, db: DbSession, couple: CurrentCouple) -> VisitOut:
    if _active_visit(db, couple.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This couple already has an active next visit",
        )
    visit = Visit(
        couple_id=couple.id,
        location=payload.location,
        start_date=payload.start_date,
        end_date=payload.end_date,
        notes=payload.notes,
        status="planned",
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return _to_out(visit)


@router.patch("/{visit_id}", response_model=VisitOut)
def update_visit(
    visit_id: str, payload: VisitUpdate, db: DbSession, couple: CurrentCouple
) -> VisitOut:
    visit = db.get(Visit, visit_id)
    if visit is None or visit.couple_id != couple.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")

    data = payload.model_dump(exclude_unset=True)
    # Guard the single-active-visit rule: only allow reactivating to "planned"
    # if no other planned visit exists.
    if data.get("status") == "planned" and visit.status != "planned":
        other = _active_visit(db, couple.id)
        if other is not None and other.id != visit.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This couple already has an active next visit",
            )
    for field, value in data.items():
        setattr(visit, field, value)
    db.commit()
    db.refresh(visit)
    return _to_out(visit)
