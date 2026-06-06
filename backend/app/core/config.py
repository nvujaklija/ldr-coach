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
    API_PREFIX: str = "/api"

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

    # BeReal — uploaded photos live here and are served under {API_PREFIX}/media.
    UPLOAD_DIR: str = "uploads"
    # How long after a moment fires partners may still post.
    BE_REAL_POST_WINDOW_MINUTES: int = 120
    # Largest accepted photo upload, in bytes (default 10 MiB).
    BE_REAL_MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024

    # Notifications — keep email off unless a provider is wired up.
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
