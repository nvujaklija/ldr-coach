"""Liveness and readiness endpoints."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness probe — returns ok if the process is serving."""
    return {"status": "ok"}


@router.get("/ping")
def ping() -> dict[str, str]:
    """Simple connectivity check."""
    return {"message": "pong"}
