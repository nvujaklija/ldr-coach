"""Bucket-list endpoints: create/list/update, visit linking, auth, isolation."""

from datetime import date, timedelta

from fastapi.testclient import TestClient

from tests.conftest import register_and_login

VISITS = "/api/v1/visits"
BUCKET = "/api/v1/bucket-items"


def _make_visit(client: TestClient, headers: dict) -> str:
    payload = {
        "location": "Lake Como",
        "start_date": (date.today() + timedelta(days=60)).isoformat(),
    }
    return client.post(VISITS, json=payload, headers=headers).json()["id"]


def test_bucket_items_require_auth(client: TestClient) -> None:
    assert client.get(BUCKET).status_code == 401
    assert client.post(BUCKET, json={"title": "x"}).status_code == 401


def test_create_list_and_default_status(client: TestClient, auth_headers: dict) -> None:
    r = client.post(
        BUCKET,
        json={"title": "Hot air balloon ride", "category": "Experience"},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "planned"
    assert body["category"] == "Experience"
    assert body["target_visit_id"] is None

    items = client.get(BUCKET, headers=auth_headers).json()
    assert [i["title"] for i in items] == ["Hot air balloon ride"]


def test_link_to_visit_on_create(client: TestClient, auth_headers: dict) -> None:
    visit_id = _make_visit(client, auth_headers)
    r = client.post(
        BUCKET,
        json={"title": "Lake Como day", "target_visit_id": visit_id},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["target_visit_id"] == visit_id


def test_progress_through_statuses(client: TestClient, auth_headers: dict) -> None:
    created = client.post(BUCKET, json={"title": "Learn to surf"}, headers=auth_headers)
    item_id = created.json()["id"]

    r = client.patch(f"{BUCKET}/{item_id}", json={"status": "in_progress"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "in_progress"

    r = client.patch(f"{BUCKET}/{item_id}", json={"status": "done"}, headers=auth_headers)
    assert r.json()["status"] == "done"


def test_invalid_status_rejected(client: TestClient, auth_headers: dict) -> None:
    item_id = client.post(BUCKET, json={"title": "x"}, headers=auth_headers).json()["id"]
    assert (
        client.patch(
            f"{BUCKET}/{item_id}", json={"status": "bogus"}, headers=auth_headers
        ).status_code
        == 422
    )


def test_cannot_link_to_another_couples_visit(client: TestClient, auth_headers: dict) -> None:
    visit_id = _make_visit(client, auth_headers)
    other = register_and_login(client, "sam@example.com", "Sam")
    r = client.post(BUCKET, json={"title": "sneaky", "target_visit_id": visit_id}, headers=other)
    assert r.status_code == 404


def test_couple_isolation(client: TestClient, auth_headers: dict) -> None:
    item_id = client.post(BUCKET, json={"title": "Mine"}, headers=auth_headers).json()["id"]
    other = register_and_login(client, "sam@example.com", "Sam")
    assert (
        client.patch(f"{BUCKET}/{item_id}", json={"status": "done"}, headers=other).status_code
        == 404
    )
    assert client.get(BUCKET, headers=other).json() == []
