"""User account and per-user preferences."""

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

# Display themes a user can pick for the app shell.
USER_THEMES = ("system", "light", "dark")


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)

    # --- preferences -----------------------------------------------------
    # IANA timezone used to render times across the app (e.g. "Europe/Rome");
    # also drives the BeReal daytime overlap.
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    # Display option for the app shell; one of USER_THEMES.
    theme: Mapped[str] = mapped_column(String(20), default="system", nullable=False)
    # Notification toggles. There is no delivery channel yet, but the
    # preferences are captured now so the toggles surface in settings.
    notify_checkin_reminders: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_visit_reminders: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_ritual_reminders: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
