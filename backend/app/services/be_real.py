"""BeReal-for-couples domain logic.

The heart of the feature is picking a single UTC instant that lands inside both
partners' daytime hours (09:00–21:00 local). This module computes that overlap,
draws a random instant inside it, and persists the resulting moment. It's kept
free of FastAPI types so the overlap maths can be unit-tested directly.
"""

import random
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import (
    BeRealMoment,
    BeRealPost,
    BeRealSchedule,
    Couple,
    CoupleMember,
    User,
)
from app.services import notifications

# Daytime window, in each partner's local wall clock, a moment may fall within.
DAY_START_HOUR = 9
DAY_END_HOUR = 21


def _local_window_utc(tz: ZoneInfo, local_date: date) -> tuple[datetime, datetime]:
    """The 09:00–21:00 window on ``local_date`` for ``tz``, expressed in UTC."""
    start = datetime.combine(local_date, time(DAY_START_HOUR), tzinfo=tz).astimezone(UTC)
    end = datetime.combine(local_date, time(DAY_END_HOUR), tzinfo=tz).astimezone(UTC)
    return start, end


def compute_overlap_window(
    tz_a_name: str, tz_b_name: str, after: datetime, *, horizon_days: int = 3
) -> tuple[datetime, datetime] | None:
    """Earliest UTC window where both timezones are within daytime hours.

    Scans each partner's daily daytime window over a few days and returns the
    soonest intersection that ends after ``after`` (clamped so it never starts
    in the past). Returns None when the two daytimes never overlap — e.g. when
    the zones are exactly 12h apart — or when a timezone name is invalid.
    """
    try:
        tz_a = ZoneInfo(tz_a_name)
        tz_b = ZoneInfo(tz_b_name)
    except Exception:
        return None

    after = after.astimezone(UTC)
    base_a = after.astimezone(tz_a).date()
    base_b = after.astimezone(tz_b).date()
    # Include the previous local day so a window still in progress is considered.
    offsets = range(-1, horizon_days + 1)
    windows_a = [_local_window_utc(tz_a, base_a + timedelta(days=d)) for d in offsets]
    windows_b = [_local_window_utc(tz_b, base_b + timedelta(days=d)) for d in offsets]

    best: tuple[datetime, datetime] | None = None
    for a_start, a_end in windows_a:
        for b_start, b_end in windows_b:
            start = max(a_start, b_start, after)
            end = min(a_end, b_end)
            if start < end and (best is None or start < best[0]):
                best = (start, end)
    return best


def pick_moment_time(
    window: tuple[datetime, datetime], *, rng: random.Random | None = None
) -> datetime:
    """Draw a uniform random UTC instant inside ``window`` (start inclusive)."""
    start, end = window
    rng = rng or random.Random()
    span = (end - start).total_seconds()
    return start + timedelta(seconds=rng.random() * span)


def _member_timezones(db: Session, couple_id: str) -> tuple[str, str] | None:
    """The couple's two timezones. A solo couple uses its one zone for both."""
    tzs = list(
        db.scalars(
            select(User.timezone)
            .join(CoupleMember, CoupleMember.user_id == User.id)
            .where(CoupleMember.couple_id == couple_id)
            .order_by(CoupleMember.created_at)
        )
    )
    tzs = [tz or "UTC" for tz in tzs]
    if not tzs:
        return None
    if len(tzs) == 1:
        return tzs[0], tzs[0]
    return tzs[0], tzs[1]


def _member_emails(db: Session, couple_id: str) -> list[str]:
    return list(
        db.scalars(
            select(User.email)
            .join(CoupleMember, CoupleMember.user_id == User.id)
            .where(CoupleMember.couple_id == couple_id)
        )
    )


def get_or_create_schedule(db: Session, couple_id: str) -> BeRealSchedule:
    schedule = db.scalar(select(BeRealSchedule).where(BeRealSchedule.couple_id == couple_id))
    if schedule is None:
        schedule = BeRealSchedule(couple_id=couple_id, is_active=False)
        db.add(schedule)
        db.commit()
        db.refresh(schedule)
    return schedule


def _post_window() -> timedelta:
    return timedelta(minutes=settings.BE_REAL_POST_WINDOW_MINUTES)


def moment_is_open(moment: BeRealMoment, *, now: datetime | None = None) -> bool:
    """True when ``moment`` is currently accepting posts."""
    if moment.status != "waiting":
        return False
    now = now or datetime.now(UTC)
    scheduled = _as_utc(moment.scheduled_utc)
    return scheduled <= now < scheduled + _post_window()


def _as_utc(dt: datetime) -> datetime:
    """SQLite hands back naive datetimes; treat those as UTC."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def schedule_next_moment(
    db: Session,
    couple: Couple,
    *,
    after: datetime | None = None,
    rng: random.Random | None = None,
) -> BeRealMoment | None:
    """Queue the couple's next moment inside the partners' daytime overlap.

    Returns None (scheduling nothing) when the couple is inactive, has no
    members, or the two timezones never share daytime hours.
    """
    after = after or datetime.now(UTC)
    schedule = get_or_create_schedule(db, couple.id)
    if not schedule.is_active:
        return None
    tzs = _member_timezones(db, couple.id)
    if tzs is None:
        return None
    window = compute_overlap_window(tzs[0], tzs[1], after)
    if window is None:
        return None

    when = pick_moment_time(window, rng=rng)
    schedule.next_utc = when
    moment = BeRealMoment(couple_id=couple.id, scheduled_utc=when, status="waiting")
    db.add(moment)
    db.commit()
    db.refresh(moment)

    notifications.notify_moment_scheduled(_member_emails(db, couple.id), when.isoformat())
    return moment


def current_moment(db: Session, couple_id: str) -> BeRealMoment | None:
    """The couple's latest still-relevant moment (waiting or recently open)."""
    return db.scalars(
        select(BeRealMoment)
        .where(
            BeRealMoment.couple_id == couple_id,
            BeRealMoment.status == "waiting",
        )
        .order_by(BeRealMoment.scheduled_utc.desc())
    ).first()


def ensure_upcoming_moment(
    db: Session, couple: Couple, *, now: datetime | None = None
) -> BeRealMoment | None:
    """Return the couple's pending moment, queuing or expiring as needed.

    Mirrors the rituals pattern of materialising lazily on read: an active
    couple always has one upcoming/open moment; a moment whose posting window
    has elapsed is marked expired and replaced.
    """
    schedule = get_or_create_schedule(db, couple.id)
    if not schedule.is_active:
        return None
    now = now or datetime.now(UTC)

    moment = current_moment(db, couple.id)
    if moment is not None:
        scheduled = _as_utc(moment.scheduled_utc)
        if now < scheduled + _post_window():
            return moment
        # Posting window elapsed without completion — retire it and roll forward.
        moment.status = "expired"
        db.commit()

    return schedule_next_moment(db, couple, after=now)


def posts_for_moment(db: Session, moment_id: str) -> list[BeRealPost]:
    return list(
        db.scalars(
            select(BeRealPost)
            .where(BeRealPost.moment_id == moment_id)
            .order_by(BeRealPost.posted_at)
        )
    )


def visible_posts(
    moment: BeRealMoment, posts: list[BeRealPost], viewer_id: str
) -> list[BeRealPost]:
    """Apply BeReal's reciprocity rule.

    A viewer always sees their own post. They see a partner's post only once
    they've posted themselves, or once the moment is completed.
    """
    viewer_posted = any(p.user_id == viewer_id for p in posts)
    if moment.status == "completed" or viewer_posted:
        return posts
    return [p for p in posts if p.user_id == viewer_id]
