"""FastAPI application factory for the LDR Coach API."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api.routes import (
    auth,
    be_real,
    checkins,
    couples,
    health,
    milestones,
    rituals,
    visits,
)
from app.core.config import settings
from app.core.logging import configure_logging


def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(
        title="LDR Coach API",
        version=__version__,
        docs_url=f"{settings.API_PREFIX}/docs",
        openapi_url=f"{settings.API_PREFIX}/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, prefix=settings.API_PREFIX)
    app.include_router(auth.router, prefix=settings.API_PREFIX)
    app.include_router(couples.router, prefix=settings.API_PREFIX)
    app.include_router(visits.router, prefix=settings.API_PREFIX)
    app.include_router(milestones.router, prefix=settings.API_PREFIX)
    app.include_router(checkins.router, prefix=settings.API_PREFIX)
    app.include_router(rituals.router, prefix=settings.API_PREFIX)
    app.include_router(be_real.router, prefix=settings.API_PREFIX)

    # Serve uploaded BeReal photos. Created up front so the mount has a dir.
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount(
        f"{settings.API_PREFIX}/media",
        StaticFiles(directory=upload_dir),
        name="media",
    )

    return app


app = create_app()
