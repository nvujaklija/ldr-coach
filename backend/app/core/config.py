"""Application configuration.

12-factor: every value comes from the environment. Defaults here are
dev-friendly only — production MUST override JWT_SECRET and DATABASE_URL
via real environment variables (see .env.example).
"""

from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Runtime
    ENV: str = "development"
    # Versioned, stable API mount point. Nginx proxies all of /api/ to the
    # backend, so bumping the version here is the only server-side change needed.
    API_PREFIX: str = "/api/v1"

    # Database — overridden to Postgres in docker-compose
    DATABASE_URL: str = "sqlite:///./dev.db"

    # Auth
    JWT_SECRET: str = "dev-insecure-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24

    # Onboarding — partner invites
    INVITE_EXPIRE_DAYS: int = 14
    # Base URL the frontend serves the join page from; used to build the
    # shareable invite link returned to the first partner.
    FRONTEND_URL: str = "http://localhost:3000"

    # Notifications / reminders worker
    # How often the worker scans for due reminders, in seconds.
    NOTIFICATIONS_POLL_SECONDS: int = 60
    # Default lead time for a "your visit is coming up" reminder; users can
    # override this in their per-user preferences.
    VISIT_REMINDER_DEFAULT_DAYS: int = 3
    # Local wall-clock hour (in the relevant timezone) reminders fire at.
    REMINDER_HOUR_LOCAL: int = 9
    # Master switch for the (future) email channel. In-app always works; email
    # delivery is additionally gated per-user by NotificationPreference.
    EMAIL_ENABLED: bool = False

    # CORS — comma-separated list of allowed origins. NoDecode stops
    # pydantic-settings from JSON-parsing the env value so the validator
    # below can split a plain "a,b,c" string.
    CORS_ORIGINS: Annotated[list[str], NoDecode] = [
        "http://localhost",
        "http://localhost:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


settings = Settings()
