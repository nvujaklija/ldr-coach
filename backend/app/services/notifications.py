"""Notification domain logic: preferences and reminder generation.

Kept out of the route module so it can be unit-tested directly and driven by
the standalone reminder worker (``app.worker``).

Reminders are *generated* here and stored with a future ``trigger_at``; the
notification center only surfaces rows whose ``trigger_at`` has passed. Each
candidate carries a stable ``dedup_key`` so the worker can run on every poll
without producing duplicates.
"""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import (
    CoupleMember,
    CoupleRitual,
    Notification,
    NotificationPreference,
    Visit,
)
from app.services import rituals as ritual_service

# --- preferences ---------------------------------------------------------


def default_preference(user_id: str) -> NotificationPreference:
    """A transient (unsaved) preference row populated from server defaults."""
    return NotificationPreference(
        user_id=user_id,
        visit_reminder_days=settings.VISIT_REMINDER_DEFAULT_DAYS,
        visit_reminders_enabled=True,
        ritual_reminders_enabled=True,
        in_app_enabled=True,
        email_enabled=False,
    )


def get_preference(db: Session, user_id: str) -> NotificationPreference | None:
    return db.scalar(
        select(NotificationPreference).where(NotificationPreference.user_id == user_id)
    )


def get_or_create_preference(db: Session, user_id: str) -> NotificationPreference:
    """Return the user's saved preferences, persisting defaults on first use."""
    prefs = get_preference(db, user_id)
    if prefs is None:
        prefs = default_preference(user_id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


def _effective_preference(db: Session, user_id: str) -> NotificationPreference:
    """Saved preferences if present, otherwise transient defaults (not saved)."""
    return get_preference(db, user_id) or default_preference(user_id)


# --- trigger-time helpers (pure, deterministic) --------------------------


def visit_reminder_trigger(start_date: date, days_before: int) -> datetime:
    """UTC moment a visit reminder fires: ``days_before`` days ahead at the
    configured local hour (interpreted as UTC — visits have no timezone)."""
    day = start_date - timedelta(days=days_before)
    return datetime.combine(day, time(hour=settings.REMINDER_HOUR_LOCAL), tzinfo=UTC)


def ritual_reminder_trigger(scheduled_for: datetime, timezone: str | None) -> datetime:
    """UTC moment a same-day ritual reminder fires: the morning (configured
    local hour) of the occurrence's own day, in the ritual's timezone."""
    try:
        tz = ZoneInfo(timezone) if timezone else UTC
    except Exception:
        tz = UTC
    local_day = scheduled_for.astimezone(tz).date()
    local_dt = datetime.combine(local_day, time(hour=settings.REMINDER_HOUR_LOCAL), tzinfo=tz)
    return local_dt.astimezone(UTC)


# --- generation ----------------------------------------------------------


def _member_ids(db: Session, couple_id: str) -> list[str]:
    return list(
        db.scalars(select(CoupleMember.user_id).where(CoupleMember.couple_id == couple_id))
    )


def _add_if_absent(
    db: Session,
    *,
    user_id: str,
    type: str,
    title: str,
    body: str | None,
    payload: dict,
    trigger_at: datetime,
    dedup_key: str,
) -> bool:
    """Stage a notification unless one with the same (user, dedup_key) exists.

    Returns True if a new row was staged. The caller commits.
    """
    exists = db.scalar(
        select(Notification.id).where(
            Notification.user_id == user_id, Notification.dedup_key == dedup_key
        )
    )
    if exists is not None:
        return False
    db.add(
        Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            payload=payload,
            trigger_at=trigger_at,
            dedup_key=dedup_key,
        )
    )
    return True


def _format_lead(days: int) -> str:
    if days <= 0:
        return "today"
    if days == 1:
        return "tomorrow"
    return f"in {days} days"


def generate_visit_reminders(db: Session, now: datetime) -> int:
    """Create a reminder per partner for each upcoming planned visit."""
    created = 0
    visits = db.scalars(select(Visit).where(Visit.status == "planned"))
    for visit in visits:
        if visit.start_date < now.date():
            continue
        for user_id in _member_ids(db, visit.couple_id):
            prefs = _effective_preference(db, user_id)
            if not (prefs.visit_reminders_enabled and prefs.in_app_enabled):
                continue
            days = prefs.visit_reminder_days
            lead = _format_lead(days)
            created += _add_if_absent(
                db,
                user_id=user_id,
                type="visit_reminder",
                title=f"Visit {lead}",
                body=f"Your visit to {visit.location} is on {visit.start_date.isoformat()}.",
                payload={
                    "visit_id": visit.id,
                    "location": visit.location,
                    "start_date": visit.start_date.isoformat(),
                    "days_before": days,
                },
                trigger_at=visit_reminder_trigger(visit.start_date, days),
                dedup_key=f"visit_reminder:{visit.id}:{days}",
            )
    return created


def generate_ritual_reminders(db: Session, now: datetime) -> int:
    """Create a same-day reminder per partner for each active ritual's next
    occurrence, materializing the occurrence if needed."""
    created = 0
    rituals = db.scalars(select(CoupleRitual).where(CoupleRitual.status == "active"))
    for ritual in rituals:
        instance = ritual_service.ensure_next_instance(db, ritual)
        if instance is None:
            continue
        trigger_at = ritual_reminder_trigger(instance.scheduled_for, ritual.timezone)
        for user_id in _member_ids(db, ritual.couple_id):
            prefs = _effective_preference(db, user_id)
            if not (prefs.ritual_reminders_enabled and prefs.in_app_enabled):
                continue
            created += _add_if_absent(
                db,
                user_id=user_id,
                type="ritual_reminder",
                title=f"{ritual.title} today",
                body="Your shared ritual is happening today — make time for each other.",
                payload={
                    "ritual_id": ritual.id,
                    "instance_id": instance.id,
                    "title": ritual.title,
                    "scheduled_for": instance.scheduled_for.isoformat(),
                },
                trigger_at=trigger_at,
                dedup_key=f"ritual_reminder:{instance.id}",
            )
    return created


def generate(db: Session, now: datetime | None = None) -> int:
    """Run every reminder generator and commit. Returns the number created."""
    now = now or datetime.now(UTC)
    created = generate_visit_reminders(db, now) + generate_ritual_reminders(db, now)
    db.commit()
    return created
