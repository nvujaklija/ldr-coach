"""Visit endpoints: countdown, the one-active-visit rule, auth, isolation."""

from datetime import date, timedelta

from fastapi.testclient import TestClient

from tests.conftest import register_and_login

VISITS = "/api/visits"
NEXT = "/api/visits/next"


def _future_visit(days: int = 30) -> dict[str, str]:
    return {
        "location": "Lisbon",
        "start_date": (date.today() + timedelta(days=days)).isoformat(),
        "end_date": (date.today() + timedelta(days=days + 5)).isoformat(),
    }


def test_visits_require_auth(client: TestClient) -> None:
    assert client.get(NEXT).status_code == 401
    assert client.post(VISITS, json=_future_visit()).status_code == 401


def test_next_is_null_before_any_visit(client: TestClient, auth_headers: dict) -> None:
    r = client.get(NEXT, headers=auth_headers)
    assert r.status_code == 200
    assert r.json() is None


def test_create_and_countdown(client: TestClient, auth_headers: dict) -> None:
    r = client.post(VISITS, json=_future_visit(days=10), headers=auth_headers)
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "planned"

    r = client.get(NEXT, headers=auth_headers)
    body = r.json()
    assert body["location"] == "Lisbon"
    assert body["days_until"] == 10


def test_only_one_active_visit(client: TestClient, auth_headers: dict) -> None:
    assert client.post(VISITS, json=_future_visit(20), headers=auth_headers).status_code == 201
    # A second planned visit is rejected while one is active.
    r = client.post(VISITS, json=_future_visit(40), headers=auth_headers)
    assert r.status_code == 409


def test_completing_a_visit_frees_the_slot(client: TestClient, auth_headers: dict) -> None:
    visit_id = client.post(VISITS, json=_future_visit(20), headers=auth_headers).json()["id"]

    # Mark it completed, then a new next visit can be created.
    r = client.patch(
        f"{VISITS}/{visit_id}", json={"status": "completed"}, headers=auth_headers
    )
    assert r.status_code == 200
    assert r.json()["status"] == "completed"
    assert client.get(NEXT, headers=auth_headers).json() is None

    assert client.post(VISITS, json=_future_visit(50), headers=auth_headers).status_code == 201


def test_end_before_start_rejected(client: TestClient, auth_headers: dict) -> None:
    payload = {
        "location": "Oslo",
        "start_date": date.today().isoformat(),
        "end_date": (date.today() - timedelta(days=1)).isoformat(),
    }
    assert client.post(VISITS, json=payload, headers=auth_headers).status_code == 422


def test_visits_are_couple_scoped(client: TestClient, auth_headers: dict) -> None:
    visit_id = client.post(VISITS, json=_future_visit(15), headers=auth_headers).json()["id"]

    other = register_and_login(client, "sam@example.com", "Sam")
    # A different couple sees no next visit and cannot patch the first couple's.
    assert client.get(NEXT, headers=other).json() is None
    assert client.patch(
        f"{VISITS}/{visit_id}", json={"location": "hacked"}, headers=other
    ).status_code == 404
