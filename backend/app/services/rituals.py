"""Ritual domain logic: the template catalog and occurrence scheduling.

Kept out of the route module so it can be unit-tested directly and reused by
the seed migration and (later) a reminders worker.
"""

import calendar
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CoupleRitual, RitualInstance, RitualTemplate


@dataclass(frozen=True)
class TemplateSeed:
    key: str
    title: str
    description: str
    default_cadence: str
    icon: str


# The starter catalog surfaced in the "add a ritual" dropdown. Edits here are
# picked up by both the seed migration and the test fixture via the same list.
DEFAULT_RITUAL_TEMPLATES: tuple[TemplateSeed, ...] = (
    TemplateSeed(
        "movie_night",
        "Movie Night",
        "Press play at the same time and watch a film together.",
        "weekly",
        "🎬",
    ),
    TemplateSeed(
        "game_night",
        "Game Night",
        "Hop on a call and play your favourite online game.",
        "weekly",
        "🎮",
    ),
    TemplateSeed(
        "parallel_walk",
        "Parallel Walk",
        "Go for a walk at the same time and talk along the way.",
        "weekly",
        "🚶",
    ),
    TemplateSeed(
        "cook_together",
        "Cook Together",
        "Make the same recipe over video and eat together.",
        "weekly",
        "🍳",
    ),
    TemplateSeed(
        "morning_coffee",
        "Morning Coffee",
        "Start the day with a shared coffee on video.",
        "daily",
        "☕",
    ),
    TemplateSeed(
        "monthly_date",
        "Monthly Date Night",
        "A dressed-up virtual date to look forward to each month.",
        "monthly",
        "🌹",
    ),
)


def seed_default_templates(db: Session) -> None:
    """Insert any missing default templates. Idempotent — safe to call twice."""
    existing = set(db.scalars(select(RitualTemplate.key)))
    for t in DEFAULT_RITUAL_TEMPLATES:
        if t.key not in existing:
            db.add(
                RitualTemplate(
                    key=t.key,
                    title=t.title,
                    description=t.description,
                    default_cadence=t.default_cadence,
                    icon=t.icon,
                )
            )
    db.commit()


def _parse_time(time_of_day: str | None) -> tuple[int, int]:
    """Return (hour, minute) from "HH:MM", defaulting to noon when unset."""
    if not time_of_day:
        return 12, 0
    hour, minute = time_of_day.split(":")
    return int(hour), int(minute)


def _with_day(dt: datetime, day: int) -> datetime:
    """Return ``dt`` moved to ``day`` of its month, clamped to the month length."""
    last = calendar.monthrange(dt.year, dt.month)[1]
    return dt.replace(day=min(day, last))


def _add_one_month(dt: datetime) -> datetime:
    year, month = (dt.year + 1, 1) if dt.month == 12 else (dt.year, dt.month + 1)
    last = calendar.monthrange(year, month)[1]
    return dt.replace(year=year, month=month, day=min(dt.day, last))


def compute_next_occurrence(ritual: CoupleRitual, *, after: datetime) -> datetime | None:
    """Next occurrence strictly after ``after``, as an aware UTC datetime.

    Returns None for unschedulable rituals (unknown cadence or bad timezone).
    """
    try:
        tz = ZoneInfo(ritual.timezone) if ritual.timezone else UTC
    except Exception:
        return None

    hour, minute = _parse_time(ritual.time_of_day)
    now_local = after.astimezone(tz)
    base = now_local.replace(hour=hour, minute=minute, second=0, microsecond=0)

    if ritual.cadence == "daily":
        candidate = base
        if candidate <= now_local:
            candidate += timedelta(days=1)
    elif ritual.cadence == "weekly":
        target = ritual.day_of_week if ritual.day_of_week is not None else now_local.weekday()
        days_ahead = (target - now_local.weekday()) % 7
        candidate = base + timedelta(days=days_ahead)
        if candidate <= now_local:
            candidate += timedelta(days=7)
    elif ritual.cadence == "monthly":
        dom = ritual.day_of_month or now_local.day
        candidate = _with_day(base, dom)
        if candidate <= now_local:
            candidate = _with_day(_add_one_month(base), dom)
    else:
        return None

    return candidate.astimezone(UTC)


def ensure_next_instance(db: Session, ritual: CoupleRitual) -> RitualInstance | None:
    """Return the ritual's next planned occurrence, materializing it if needed.

    Paused/cancelled rituals don't generate occurrences. The instance row is
    persisted so it can later be marked done; only one upcoming planned
    instance exists per ritual at a time.
    """
    if ritual.status != "active":
        return None

    now = datetime.now(UTC)
    upcoming = db.scalars(
        select(RitualInstance)
        .where(
            RitualInstance.ritual_id == ritual.id,
            RitualInstance.status == "planned",
            RitualInstance.scheduled_for > now,
        )
        .order_by(RitualInstance.scheduled_for.asc())
    ).first()
    if upcoming is not None:
        return upcoming

    when = compute_next_occurrence(ritual, after=now)
    if when is None:
        return None
    instance = RitualInstance(
        ritual_id=ritual.id, couple_id=ritual.couple_id, scheduled_for=when, status="planned"
    )
    db.add(instance)
    db.commit()
    db.refresh(instance)
    return instance
