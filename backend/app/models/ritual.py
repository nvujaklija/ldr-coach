"""Shared rituals: recurring virtual dates a couple schedules together.

Three tables model the feature:

* ``RitualTemplate`` — a small, seeded catalog of suggestions (Movie Night,
  Game Night, …). Templates are referenced by a stable ``key`` rather than a
  foreign key so re-seeding in a fresh environment can't break existing rows.
* ``CoupleRitual`` — a couple's recurring ritual with its schedule. Reuses the
  original ``rituals`` table, extended with scheduling columns.
* ``RitualInstance`` — a concrete occurrence (this week's movie night) that can
  be marked done. Instances are generated lazily as a ritual is listed or its
  current occurrence is completed.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

# How often a ritual repeats. "weekly" is the common case (weekly movie night).
RITUAL_CADENCES = ("daily", "weekly", "monthly")
# Lifecycle of a couple's ritual.
COUPLE_RITUAL_STATUSES = ("active", "paused", "cancelled")
# Lifecycle of a single scheduled occurrence.
RITUAL_INSTANCE_STATUSES = ("planned", "done", "cancelled")


class RitualTemplate(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "ritual_templates"

    # Stable, human-readable identifier (e.g. "movie_night"); how rituals
    # reference the catalog without depending on the random primary key.
    key: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_cadence: Mapped[str] = mapped_column(String(40), default="weekly", nullable=False)
    # Optional emoji shown in the UI.
    icon: Mapped[str | None] = mapped_column(String(8), nullable=True)


class CoupleRitual(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "rituals"

    couple_id: Mapped[str] = mapped_column(
        ForeignKey("couples.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Catalog key this ritual was created from; null for fully custom rituals.
    template_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    cadence: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Schedule. day_of_week (0=Mon … 6=Sun) drives weekly cadence; day_of_month
    # (1-31, clamped to month length) drives monthly; both are ignored for daily.
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    day_of_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Local wall-clock time as "HH:MM" (24h), interpreted in ``timezone``.
    time_of_day: Mapped[str | None] = mapped_column(String(5), nullable=True)
    # IANA timezone the schedule is expressed in (e.g. "Europe/Rome").
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)


class RitualInstance(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "ritual_instances"

    ritual_id: Mapped[str] = mapped_column(
        ForeignKey("rituals.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Denormalized for couple-scoped queries and access checks.
    couple_id: Mapped[str] = mapped_column(
        ForeignKey("couples.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # The occurrence moment, stored as an aware UTC datetime.
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="planned", nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
