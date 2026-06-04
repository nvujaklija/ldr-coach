"""Shared pytest fixtures: an isolated in-memory DB and API client."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    # One shared in-memory SQLite DB for the duration of the test.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def register_and_login(
    client: TestClient, email: str, display_name: str, *, with_couple: bool = True
) -> dict[str, str]:
    """Register a fresh user, log in, optionally onboard a couple, and return headers.

    Each call creates a distinct user; with_couple=True also creates a fresh
    couple for them, which is what couple-scoped endpoints (visits, milestones)
    require. Pass with_couple=False to exercise the not-onboarded path.
    """
    client.post(
        "/api/auth/register",
        json={"email": email, "password": "supersecret", "display_name": display_name},
    )
    token = client.post(
        "/api/auth/login", data={"username": email, "password": "supersecret"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    if with_couple:
        client.post("/api/couples", json={"name": f"{display_name}'s couple"}, headers=headers)
    return headers


@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    """Authorization headers for a default logged-in, onboarded user (Alex)."""
    return register_and_login(client, "alex@example.com", "Alex")
