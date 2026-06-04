"""Ritual routes: template catalog + a couple's recurring rituals.

Endpoints:
    GET   /rituals/templates                          list the starter catalog
    GET   /rituals                                     list the couple's rituals
    POST  /rituals                                     create a recurring ritual
    PATCH /rituals/{id}                                update / pause / cancel
    PATCH /rituals/{id}/instances/{instance_id}        mark an occurrence done
"""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentCouple, DbSession
from app.models import CoupleRitual, RitualInstance, RitualTemplate
from app.schemas.ritual import (
    RitualCreate,
    RitualInstanceOut,
    RitualInstanceUpdate,
    RitualOut,
    RitualTemplateOut,
    RitualUpdate,
)
from app.services import rituals as ritual_service

router = APIRouter(prefix="/rituals", tags=["rituals"])


def _to_out(db: DbSession, ritual: CoupleRitual) -> RitualOut:
    """Serialize a ritual, attaching its next planned occurrence."""
    out = RitualOut.model_validate(ritual)
    instance = ritual_service.ensure_next_instance(db, ritual)
    if instance is not None:
        out.next_instance = RitualInstanceOut.model_validate(instance)
    return out


def _get_owned_ritual(db: DbSession, ritual_id: str, couple_id: str) -> CoupleRitual:
    ritual = db.get(CoupleRitual, ritual_id)
    if ritual is None or ritual.couple_id != couple_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ritual not found")
    return ritual


@router.get("/templates", response_model=list[RitualTemplateOut])
def list_templates(db: DbSession, couple: CurrentCouple) -> list[RitualTemplate]:
    stmt = select(RitualTemplate).order_by(RitualTemplate.title.asc())
    return list(db.scalars(stmt))


@router.get("", response_model=list[RitualOut])
def list_rituals(db: DbSession, couple: CurrentCouple) -> list[RitualOut]:
    stmt = (
        select(CoupleRitual)
        .where(
            CoupleRitual.couple_id == couple.id,
            CoupleRitual.status != "cancelled",
        )
        .order_by(CoupleRitual.created_at.asc())
    )
    return [_to_out(db, r) for r in db.scalars(stmt)]


@router.post("", response_model=RitualOut, status_code=status.HTTP_201_CREATED)
def create_ritual(payload: RitualCreate, db: DbSession, couple: CurrentCouple) -> RitualOut:
    if payload.template_key is not None:
        exists = db.scalar(
            select(RitualTemplate.id).where(RitualTemplate.key == payload.template_key)
        )
        if exists is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Unknown ritual template"
            )
    ritual = CoupleRitual(
        couple_id=couple.id,
        template_key=payload.template_key,
        title=payload.title,
        cadence=payload.cadence,
        description=payload.description,
        day_of_week=payload.day_of_week,
        day_of_month=payload.day_of_month,
        time_of_day=payload.time_of_day,
        timezone=payload.timezone,
        status="active",
    )
    db.add(ritual)
    db.commit()
    db.refresh(ritual)
    return _to_out(db, ritual)


@router.patch("/{ritual_id}", response_model=RitualOut)
def update_ritual(
    ritual_id: str, payload: RitualUpdate, db: DbSession, couple: CurrentCouple
) -> RitualOut:
    ritual = _get_owned_ritual(db, ritual_id, couple.id)
    fields = payload.model_dump(exclude_unset=True)
    schedule_changed = bool(
        fields.keys() & {"cadence", "day_of_week", "day_of_month", "time_of_day", "timezone"}
    )
    for field, value in fields.items():
        setattr(ritual, field, value)
    # A changed schedule (or a pause) invalidates the pending occurrence, so
    # drop it and let _to_out regenerate from the new schedule.
    if schedule_changed or ritual.status != "active":
        for inst in db.scalars(
            select(RitualInstance).where(
                RitualInstance.ritual_id == ritual.id,
                RitualInstance.status == "planned",
            )
        ):
            db.delete(inst)
    db.commit()
    db.refresh(ritual)
    return _to_out(db, ritual)


@router.patch("/{ritual_id}/instances/{instance_id}", response_model=RitualOut)
def update_instance(
    ritual_id: str,
    instance_id: str,
    payload: RitualInstanceUpdate,
    db: DbSession,
    couple: CurrentCouple,
) -> RitualOut:
    ritual = _get_owned_ritual(db, ritual_id, couple.id)
    instance = db.get(RitualInstance, instance_id)
    if instance is None or instance.ritual_id != ritual.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ritual occurrence not found"
        )
    instance.status = payload.status
    if payload.status == "done":
        instance.completed_at = datetime.now(UTC)
    db.commit()
    # Completing/cancelling this occurrence rolls the schedule forward to the
    # next one via _to_out -> ensure_next_instance.
    db.refresh(ritual)
    return _to_out(db, ritual)
