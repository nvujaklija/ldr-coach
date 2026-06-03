"""Application configuration.

12-factor: every value comes from the environment. Defaults here are
dev-friendly only — production MUST override JWT_SECRET and DATABASE_URL
via real environment variables (see .env.example).
"""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # CORS — comma-separated list of allowed origins
    CORS_ORIGINS: list[str] = ["http://localhost", "http://localhost:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


settings = Settings()
