"""Daily mood/connection check-ins: submit, idempotency, range, scoping."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Couple, CoupleMember, User

REGISTER = "/api/auth/register"
LOGIN = "/api/auth/login"
TODAY = "/api/checkins/today"
LIST = "/api/checkins"


def _auth(client: TestClient, email: str) -> dict[str, str]:
    """Register + login a user, returning an Authorization header."""
    creds = {"email": email, "password": "supersecret", "display_name": email[:5]}
    client.post(REGISTER, json=creds)
    token = client.post(
        LOGIN, data={"username": email, "password": "supersecret"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_submit_today_creates_check_in(client: TestClient) -> None:
    headers = _auth(client, "sam@example.com")
    r = client.post(
        TODAY,
        json={"mood_score": 4, "connection_score": 5, "tags": ["happy"], "note": "good day"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["mood_score"] == 4
    assert body["connection_score"] == 5
    assert body["tags"] == ["happy"]
    assert body["note"] == "good day"
    assert body["couple_id"] is None  # not matched into a couple yet
    assert body["date"]


def test_submit_today_is_idempotent_per_day(client: TestClient) -> None:
    headers = _auth(client, "sam@example.com")
    first = client.post(TODAY, json={"mood_score": 2, "connection_score": 2}, headers=headers)
    assert first.status_code == 201
    # Re-submitting the same day updates rather than duplicating.
    second = client.post(TODAY, json={"mood_score": 5, "connection_score": 4}, headers=headers)
    assert second.status_code == 200, second.text
    assert second.json()["id"] == first.json()["id"]

    listed = client.get(LIST, headers=headers).json()
    assert len(listed["check_ins"]) == 1
    assert listed["check_ins"][0]["mood_score"] == 5


def test_list_returns_averages(client: TestClient) -> None:
    headers = _auth(client, "sam@example.com")
    client.post(TODAY, json={"mood_score": 3, "connection_score": 5}, headers=headers)

    body = client.get(LIST, headers=headers).json()
    assert body["averages"]["count"] == 1
    assert body["averages"]["mood_score"] == 3.0
    assert body["averages"]["connection_score"] == 5.0


def test_score_out_of_range_is_rejected(client: TestClient) -> None:
    headers = _auth(client, "sam@example.com")
    r = client.post(TODAY, json={"mood_score": 9, "connection_score": 3}, headers=headers)
    assert r.status_code == 422


def test_check_ins_require_auth(client: TestClient) -> None:
    assert client.post(TODAY, json={"mood_score": 3, "connection_score": 3}).status_code == 401
    assert client.get(LIST).status_code == 401


def test_list_is_scoped_to_the_couple(client: TestClient, db: Session) -> None:
    sam_headers = _auth(client, "sam@example.com")
    alex_headers = _auth(client, "alex@example.com")

    # Put both partners in one couple (no public endpoint for this yet).
    sam = db.query(User).filter(User.email == "sam@example.com").one()
    alex = db.query(User).filter(User.email == "alex@example.com").one()
    couple = Couple(name="Sam & Alex")
    db.add(couple)
    db.flush()
    db.add_all(
        [
            CoupleMember(couple_id=couple.id, user_id=sam.id),
            CoupleMember(couple_id=couple.id, user_id=alex.id),
        ]
    )
    db.commit()

    client.post(TODAY, json={"mood_score": 4, "connection_score": 4}, headers=sam_headers)
    client.post(TODAY, json={"mood_score": 2, "connection_score": 2}, headers=alex_headers)

    # Sam sees both partners' check-ins, with couple_id backfilled.
    body = client.get(LIST, headers=sam_headers).json()
    assert body["averages"]["count"] == 2
    assert {c["couple_id"] for c in body["check_ins"]} == {couple.id}
    assert {c["user_id"] for c in body["check_ins"]} == {sam.id, alex.id}


def test_list_excludes_other_uncoupled_users(client: TestClient) -> None:
    sam_headers = _auth(client, "sam@example.com")
    alex_headers = _auth(client, "alex@example.com")
    client.post(TODAY, json={"mood_score": 4, "connection_score": 4}, headers=sam_headers)
    client.post(TODAY, json={"mood_score": 1, "connection_score": 1}, headers=alex_headers)

    # With no couple, each user only sees their own check-in.
    body = client.get(LIST, headers=sam_headers).json()
    assert body["averages"]["count"] == 1
    assert body["check_ins"][0]["mood_score"] == 4
