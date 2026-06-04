"""Memory timeline: manual entries, paging, isolation, and auto-recording.

The auto-recording tests double as integration coverage of the shared
``memories`` service that the visits/milestones/rituals slices write through.
"""

from datetime import UTC, date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import MemoryItem
from tests.conftest import register_and_login

MEMORIES = "/api/memories"
VISITS = "/api/visits"
MILESTONES = "/api/milestones"
RITUALS = "/api/rituals"


def test_memories_require_auth(client: TestClient) -> None:
    assert client.get(MEMORIES).status_code == 401
    assert client.post(MEMORIES, json={"type": "note"}).status_code == 401


def test_create_and_list_memory(client: TestClient, auth_headers: dict) -> None:
    r = client.post(
        MEMORIES,
        json={"type": "note", "data": {"title": "First call", "note": "3 hours!"}},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["type"] == "note"
    assert body["data"]["title"] == "First call"
    assert body["created_by_id"] is not None

    listed = client.get(MEMORIES, headers=auth_headers).json()
    assert [m["id"] for m in listed] == [body["id"]]


def test_invalid_type_rejected(client: TestClient, auth_headers: dict) -> None:
    assert (
        client.post(MEMORIES, json={"type": "voicemail"}, headers=auth_headers).status_code
        == 422
    )


def test_list_is_newest_first_and_paged(
    client: TestClient, db: Session, auth_headers: dict
) -> None:
    # Seed rows with distinct, increasing created_at so newest-first ordering
    # is unambiguous (CURRENT_TIMESTAMP alone ties at one-second granularity).
    couple_id = client.get("/api/auth/me", headers=auth_headers).json()["couple"]["id"]
    base = datetime(2026, 1, 1, tzinfo=UTC)
    for i in range(5):
        db.add(
            MemoryItem(
                couple_id=couple_id,
                type="note",
                data={"title": f"m{i}"},
                created_at=base + timedelta(minutes=i),
            )
        )
    db.commit()

    page = client.get(f"{MEMORIES}?limit=2&offset=0", headers=auth_headers).json()
    assert [m["data"]["title"] for m in page] == ["m4", "m3"]
    page2 = client.get(f"{MEMORIES}?limit=2&offset=2", headers=auth_headers).json()
    assert [m["data"]["title"] for m in page2] == ["m2", "m1"]


def test_couple_isolation(client: TestClient, auth_headers: dict) -> None:
    client.post(MEMORIES, json={"type": "note", "data": {}}, headers=auth_headers)
    other = register_and_login(client, "sam@example.com", "Sam")
    assert client.get(MEMORIES, headers=other).json() == []


# --- auto-recording from other slices ------------------------------------


def test_completed_visit_creates_a_memory(client: TestClient, auth_headers: dict) -> None:
    vid = client.post(
        VISITS,
        json={"location": "Lisbon", "start_date": date.today().isoformat()},
        headers=auth_headers,
    ).json()["id"]
    client.patch(f"{VISITS}/{vid}", json={"status": "completed"}, headers=auth_headers)

    mems = client.get(MEMORIES, headers=auth_headers).json()
    assert len(mems) == 1
    assert mems[0]["type"] == "visit"
    assert mems[0]["data"]["source"] == "visit"
    assert "Lisbon" in mems[0]["data"]["title"]
    # Auto-recorded memories have no author.
    assert mems[0]["created_by_id"] is None


def test_completing_visit_twice_records_one_memory(
    client: TestClient, auth_headers: dict
) -> None:
    vid = client.post(
        VISITS,
        json={"location": "Lisbon", "start_date": date.today().isoformat()},
        headers=auth_headers,
    ).json()["id"]
    client.patch(f"{VISITS}/{vid}", json={"status": "completed"}, headers=auth_headers)
    # A no-op re-patch to the same status must not duplicate the memory.
    client.patch(f"{VISITS}/{vid}", json={"notes": "great trip"}, headers=auth_headers)
    assert len(client.get(MEMORIES, headers=auth_headers).json()) == 1


def test_done_milestone_creates_a_memory(client: TestClient, auth_headers: dict) -> None:
    mid = client.post(
        MILESTONES, json={"title": "Book flights"}, headers=auth_headers
    ).json()["id"]
    client.patch(f"{MILESTONES}/{mid}", json={"status": "done"}, headers=auth_headers)

    mems = client.get(MEMORIES, headers=auth_headers).json()
    assert len(mems) == 1
    assert mems[0]["type"] == "note"
    assert mems[0]["data"]["source"] == "milestone"
    assert "Book flights" in mems[0]["data"]["title"]


def test_done_ritual_occurrence_creates_a_memory(
    client: TestClient, auth_headers: dict
) -> None:
    created = client.post(
        RITUALS,
        json={"title": "Movie Night", "cadence": "daily",
              "time_of_day": "20:00", "timezone": "UTC"},
        headers=auth_headers,
    ).json()
    rid, iid = created["id"], created["next_instance"]["id"]
    client.patch(
        f"{RITUALS}/{rid}/instances/{iid}", json={"status": "done"}, headers=auth_headers
    )

    mems = client.get(MEMORIES, headers=auth_headers).json()
    assert len(mems) == 1
    assert mems[0]["type"] == "ritual"
    assert mems[0]["data"]["title"] == "Movie Night"
