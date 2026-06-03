"""Health endpoints must respond without any backing services."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_ping() -> None:
    resp = client.get("/api/ping")
    assert resp.status_code == 200
    assert resp.json() == {"message": "pong"}
