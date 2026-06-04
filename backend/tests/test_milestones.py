"""Milestone endpoints: create/list/update, visit filtering, auth, isolation."""

from datetime import date, timedelta

from fastapi.testclient import TestClient

from tests.conftest import register_and_login

VISITS = "/api/visits"
MILESTONES = "/api/milestones"


def _make_visit(client: TestClient, headers: dict) -> str:
    payload = {
        "location": "Lisbon",
        "start_date": (date.today() + timedelta(days=30)).isoformat(),
    }
    return client.post(VISITS, json=payload, headers=headers).json()["id"]


def test_milestones_require_auth(client: TestClient) -> None:
    assert client.get(MILESTONES).status_code == 401
    assert client.post(MILESTONES, json={"title": "x"}).status_code == 401


def test_create_list_and_filter_by_visit(client: TestClient, auth_headers: dict) -> None:
    visit_id = _make_visit(client, auth_headers)

    r = client.post(
        MILESTONES,
        json={"title": "book flights", "visit_id": visit_id},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "todo"

    # A couple-level milestone (no visit) should not appear in the visit filter.
    client.post(MILESTONES, json={"title": "renew passport"}, headers=auth_headers)

    filtered = client.get(
        MILESTONES, params={"visitId": visit_id}, headers=auth_headers
    ).json()
    assert [m["title"] for m in filtered] == ["book flights"]

    assert len(client.get(MILESTONES, headers=auth_headers).json()) == 2


def test_update_status_to_done(client: TestClient, auth_headers: dict) -> None:
    visit_id = _make_visit(client, auth_headers)
    mid = client.post(
        MILESTONES, json={"title": "finalize itinerary", "visit_id": visit_id}, headers=auth_headers
    ).json()["id"]

    r = client.patch(f"{MILESTONES}/{mid}", json={"status": "done"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "done"


def test_invalid_status_rejected(client: TestClient, auth_headers: dict) -> None:
    mid = client.post(MILESTONES, json={"title": "x"}, headers=auth_headers).json()["id"]
    assert client.patch(
        f"{MILESTONES}/{mid}", json={"status": "bogus"}, headers=auth_headers
    ).status_code == 422


def test_cannot_attach_milestone_to_another_couples_visit(
    client: TestClient, auth_headers: dict
) -> None:
    visit_id = _make_visit(client, auth_headers)
    other = register_and_login(client, "sam@example.com", "Sam")
    r = client.post(
        MILESTONES, json={"title": "sneaky", "visit_id": visit_id}, headers=other
    )
    assert r.status_code == 404
