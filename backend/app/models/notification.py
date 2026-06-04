"""In-app notifications and per-user delivery preferences.

Two tables model the feature:

* ``Notification`` — a single per-user notification. ``trigger_at`` is the
  moment it should become visible (a reminder may be generated days ahead of
  time); the notification center only surfaces rows whose ``trigger_at`` has
  passed. ``read_at`` tracks read state and ``payload`` carries structured
  data (e.g. the visit or ritual it refers to) for the client to deep-link.
  ``dedup_key`` is unique per user so the reminder worker can regenerate on
  every poll without creating duplicates.
* ``NotificationPreference`` — one row per user controlling which reminders
  they receive and how (in-app now; email later, behind config).
"""

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

# Known notification types. Kept open-ended (plain strings) so new reminder
# kinds — e.g. "bucket_nudge" once the bucket-list feature lands — can be added
# without a schema change.
NOTIFICATION_TYPES = ("visit_reminder", "ritual_reminder")


class Notification(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = (
        # The worker recomputes reminders on every poll; this keeps generation
        # idempotent without an extra read-modify-write per candidate.
        UniqueConstraint("user_id", "dedup_key", name="uq_notification_user_dedup"),
    )

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Structured context (visit_id, ritual_id, days_until, …) for deep-linking.
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # When the notification should become visible, as an aware UTC datetime.
    trigger_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Stable key the generator uses to avoid duplicating a reminder.
    dedup_key: Mapped[str | None] = mapped_column(String(200), nullable=True)


class NotificationPreference(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "notification_preferences"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    # How many days before a planned visit the reminder fires.
    visit_reminder_days: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    visit_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ritual_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # In-app is the only channel for now; email is wired but off by default and
    # additionally gated by the EMAIL_ENABLED server setting.
    in_app_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
