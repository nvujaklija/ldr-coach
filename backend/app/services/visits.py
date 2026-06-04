"""Visit domain logic: the next-visit countdown and the single-active rule.

Business rule lives here so the route module stays thin and the rule can be
unit-tested directly: a couple has at most one ``planned`` visit at a time.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Visit
from app.schemas.visit import VisitCreate, VisitOut


def to_out(visit: Visit) -> VisitOut:
    """Serialize a visit, attaching the live countdown for planned visits."""
    out = VisitOut.model_validate(visit)
    if visit.status == "planned":
        out.days_until = (visit.start_date - date.today()).days
    return out


def active_visit(db: Session, couple_id: str) -> Visit | None:
    """The couple's current planned (active "next") visit, if any."""
    return db.scalar(
        select(Visit)
        .where(Visit.couple_id == couple_id, Visit.status == "planned")
        .order_by(Visit.start_date.asc())
    )


def get_owned_visit(db: Session, visit_id: str, couple_id: str) -> Visit | None:
    """Return the visit only if it belongs to ``couple_id`` (else None)."""
    visit = db.get(Visit, visit_id)
    if visit is None or visit.couple_id != couple_id:
        return None
    return visit


def create_visit(db: Session, couple_id: str, payload: VisitCreate) -> Visit:
    visit = Visit(
        couple_id=couple_id,
        location=payload.location,
        start_date=payload.start_date,
        end_date=payload.end_date,
        notes=payload.notes,
        status="planned",
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit


def apply_update(db: Session, visit: Visit, data: dict) -> Visit:
    """Persist a validated partial update onto ``visit``."""
    for field, value in data.items():
        setattr(visit, field, value)
    db.commit()
    db.refresh(visit)
    return visit
