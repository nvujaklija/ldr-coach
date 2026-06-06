"""A "BeReal for couples" photo moment.

Once a day (while enabled) the system picks a single shared instant that falls
inside both partners' daytime hours and prompts them to post a photo at the
same time. Three tables model it:

* ``BeRealSchedule`` — one row per couple holding the on/off switch and the UTC
  instant of the couple's next moment.
* ``BeRealMoment`` — a concrete prompt at a scheduled instant; partners post
  against it until it completes or its posting window closes.
* ``BeRealPost`` — a single partner's photo for a moment.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

# Lifecycle of a single moment. "waiting" covers both the pre-prompt countdown
# and the open posting window; the route layer derives "open" from the clock.
BE_REAL_MOMENT_STATUSES = ("waiting", "completed", "expired")


class BeRealSchedule(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "be_real_schedules"

    couple_id: Mapped[str] = mapped_column(
        ForeignKey("couples.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # The couple's next moment as an aware UTC datetime; null when none is queued.
    next_utc: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class BeRealMoment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "be_real_moments"

    couple_id: Mapped[str] = mapped_column(
        ForeignKey("couples.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # The shared instant both partners are prompted at, stored as aware UTC.
    scheduled_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="waiting", nullable=False)


class BeRealPost(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "be_real_posts"
    # A partner posts at most once per moment.
    __table_args__ = (UniqueConstraint("moment_id", "user_id", name="uq_be_real_post_moment_user"),)

    moment_id: Mapped[str] = mapped_column(
        ForeignKey("be_real_moments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
