"""Shared pytest fixtures: an isolated in-memory DB and API client.

The ``client`` and ``db`` fixtures share one in-memory SQLite database for
the duration of a test, so a test can seed rows directly (e.g. couple
membership, which has no public endpoint yet) and see them through the API.
"""

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
def session_factory() -> sessionmaker:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture
def db(session_factory: sessionmaker) -> Generator[Session, None, None]:
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(session_factory: sessionmaker) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

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
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret", "display_name": display_name},
    )
    token = client.post(
        "/api/v1/auth/login", data={"username": email, "password": "supersecret"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    if with_couple:
        client.post("/api/v1/couples", json={"name": f"{display_name}'s couple"}, headers=headers)
    return headers


@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    """Authorization headers for a default logged-in, onboarded user (Alex)."""
    return register_and_login(client, "alex@example.com", "Alex")
