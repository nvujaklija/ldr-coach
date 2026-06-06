"""BeReal feature: overlap maths, random selection, endpoints, visibility."""

import random
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import BeRealMoment
from app.services.be_real import (
    DAY_END_HOUR,
    DAY_START_HOUR,
    compute_overlap_window,
    pick_moment_time,
)
from tests.conftest import register_and_login

BASE = "/api/be-real"


def _in_daytime(instant: datetime, tz_name: str) -> bool:
    local = instant.astimezone(ZoneInfo(tz_name))
    return DAY_START_HOUR <= local.hour < DAY_END_HOUR


# --- overlap maths (pure, deterministic) ---------------------------------


def test_overlap_same_timezone_is_full_daytime() -> None:
    after = datetime(2026, 6, 6, 0, 0, tzinfo=UTC)
    window = compute_overlap_window("UTC", "UTC", after)
    assert window is not None
    start, end = window
    assert start.hour == DAY_START_HOUR
    assert end.hour == DAY_END_HOUR
    assert _in_daytime(start, "UTC")


def test_overlap_partial_between_offset_zones() -> None:
    after = datetime(2026, 6, 6, 0, 0, tzinfo=UTC)
    window = compute_overlap_window("UTC", "America/New_York", after)
    assert window is not None
    start, end = window
    # The chosen window must sit inside both partners' daytime hours.
    assert _in_daytime(start, "UTC") and _in_daytime(start, "America/New_York")
    just_before_end = end - timedelta(minutes=1)
    assert _in_daytime(just_before_end, "UTC")
    assert _in_daytime(just_before_end, "America/New_York")


def test_overlap_none_when_zones_are_twelve_hours_apart() -> None:
    after = datetime(2026, 6, 6, 0, 0, tzinfo=UTC)
    # UTC daytime and UTC+12 daytime only ever touch at the boundary.
    assert compute_overlap_window("UTC", "Etc/GMT-12", after) is None


def test_overlap_invalid_timezone_returns_none() -> None:
    after = datetime(2026, 6, 6, 0, 0, tzinfo=UTC)
    assert compute_overlap_window("UTC", "Mars/Phobos", after) is None


def test_overlap_clamps_start_to_after() -> None:
    after = datetime(2026, 6, 6, 12, 0, tzinfo=UTC)  # inside today's UTC window
    window = compute_overlap_window("UTC", "UTC", after)
    assert window is not None
    assert window[0] == after


# --- random selection within the window ----------------------------------


def test_pick_moment_time_always_inside_both_daytimes() -> None:
    window = compute_overlap_window("UTC", "America/New_York", datetime(2026, 6, 6, tzinfo=UTC))
    assert window is not None
    rng = random.Random(1234)
    start, end = window
    for _ in range(200):
        instant = pick_moment_time(window, rng=rng)
        assert start <= instant < end
        assert _in_daytime(instant, "UTC")
        assert _in_daytime(instant, "America/New_York")


def test_pick_moment_time_endpoints() -> None:
    window = (datetime(2026, 6, 6, 9, tzinfo=UTC), datetime(2026, 6, 6, 21, tzinfo=UTC))

    class _Zero:
        def random(self) -> float:
            return 0.0

    class _Almost:
        def random(self) -> float:
            return 0.999999

    assert pick_moment_time(window, rng=_Zero()) == window[0]
    assert pick_moment_time(window, rng=_Almost()) < window[1]


# --- endpoints -----------------------------------------------------------


def test_be_real_requires_auth(client: TestClient) -> None:
    assert client.get(f"{BASE}/status").status_code == 401
    assert client.post(f"{BASE}/enable", json={}).status_code == 401


def test_enable_activates_and_schedules(client: TestClient, auth_headers: dict) -> None:
    r = client.post(f"{BASE}/enable", json={"timezone": "Europe/Rome"}, headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["is_active"] is True
    assert body["next_utc"] is not None
    assert body["current_moment"] is not None
    assert body["current_moment"]["status"] == "waiting"
    assert body["partners"][0]["timezone"] == "Europe/Rome"
    assert body["partners"][0]["local_time"] is not None
    # The scheduled instant must fall inside the partner's daytime hours.
    scheduled = datetime.fromisoformat(body["current_moment"]["scheduled_utc"])
    assert _in_daytime(scheduled, "Europe/Rome")


def test_disable_clears_schedule(client: TestClient, auth_headers: dict) -> None:
    client.post(f"{BASE}/enable", json={}, headers=auth_headers)
    r = client.post(f"{BASE}/disable", headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["is_active"] is False
    assert body["next_utc"] is None
    assert body["current_moment"] is None


def test_status_reports_both_partner_timezones(client: TestClient, db: Session) -> None:
    a = register_and_login(client, "a@example.com", "A")
    client.post(f"{BASE}/enable", json={"timezone": "America/New_York"}, headers=a)
    code = client.post("/api/couples/invites", headers=a).json()["code"]
    b = register_and_login(client, "b@example.com", "B", with_couple=False)
    client.post("/api/couples/join", json={"code": code}, headers=b)
    client.post(f"{BASE}/enable", json={"timezone": "Europe/Rome"}, headers=b)

    body = client.get(f"{BASE}/status", headers=a).json()
    zones = {p["timezone"] for p in body["partners"]}
    assert zones == {"America/New_York", "Europe/Rome"}


# --- photo upload + visibility -------------------------------------------


def _two_member_couple(client: TestClient) -> tuple[dict, dict, str]:
    a = register_and_login(client, "a@example.com", "A")
    couple_id = client.get("/api/auth/me", headers=a).json()["couple"]["id"]
    code = client.post("/api/couples/invites", headers=a).json()["code"]
    b = register_and_login(client, "b@example.com", "B", with_couple=False)
    client.post("/api/couples/join", json={"code": code}, headers=b)
    return a, b, couple_id


def _open_moment(db: Session, couple_id: str) -> BeRealMoment:
    moment = BeRealMoment(
        couple_id=couple_id,
        scheduled_utc=datetime.now(UTC) - timedelta(minutes=1),
        status="waiting",
    )
    db.add(moment)
    db.commit()
    db.refresh(moment)
    return moment


def _jpeg() -> dict:
    return {"image": ("me.jpg", b"\xff\xd8\xff\xe0fake-jpeg-bytes", "image/jpeg")}


def _post(client: TestClient, moment_id: str, headers: dict, files: dict | None = None) -> int:
    files = files or _jpeg()
    return client.post(f"{BASE}/moments/{moment_id}/post", files=files, headers=headers).status_code


def test_post_photo_and_reciprocal_visibility(
    client: TestClient, db: Session, tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    a, b, couple_id = _two_member_couple(client)
    moment = _open_moment(db, couple_id)

    # A posts. A sees only their own photo; the partner hasn't posted.
    r = client.post(f"{BASE}/moments/{moment.id}/post", files=_jpeg(), headers=a)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["you_posted"] is True
    assert body["partner_posted"] is False
    assert len(body["posts"]) == 1

    # B has not posted yet, so B cannot see A's photo.
    seen_by_b = client.get(f"{BASE}/moments/{moment.id}", headers=b).json()
    assert seen_by_b["you_posted"] is False
    assert seen_by_b["posts"] == []

    # B posts — both have now posted, so the moment completes and unlocks.
    r = client.post(f"{BASE}/moments/{moment.id}/post", files=_jpeg(), headers=b)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "completed"

    both = client.get(f"{BASE}/moments/{moment.id}", headers=a).json()
    assert both["status"] == "completed"
    assert len(both["posts"]) == 2


def test_post_photo_rejects_double_and_bad_type(
    client: TestClient, db: Session, tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    a, _b, couple_id = _two_member_couple(client)
    moment = _open_moment(db, couple_id)

    assert _post(client, moment.id, a) == 200
    # Second post by the same partner is rejected.
    assert _post(client, moment.id, a) == 409
    # Non-image upload is rejected.
    bad = {"image": ("notes.txt", b"hello", "text/plain")}
    a2 = register_and_login(client, "c@example.com", "C")  # fresh couple to avoid double-post
    cid = client.get("/api/auth/me", headers=a2).json()["couple"]["id"]
    other_moment = _open_moment(db, cid)
    assert _post(client, other_moment.id, a2, files=bad) == 415


def test_post_photo_closed_moment_rejected(
    client: TestClient, db: Session, tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    a, _b, couple_id = _two_member_couple(client)
    # Scheduled far in the future — not open for posting yet.
    moment = BeRealMoment(
        couple_id=couple_id,
        scheduled_utc=datetime.now(UTC) + timedelta(days=1),
        status="waiting",
    )
    db.add(moment)
    db.commit()
    db.refresh(moment)
    assert _post(client, moment.id, a) == 409


def test_moments_pagination(client: TestClient, db: Session, auth_headers: dict) -> None:
    couple_id = client.get("/api/auth/me", headers=auth_headers).json()["couple"]["id"]
    base = datetime(2026, 6, 1, 12, tzinfo=UTC)
    for i in range(5):
        db.add(
            BeRealMoment(
                couple_id=couple_id,
                scheduled_utc=base + timedelta(days=i),
                status="completed",
            )
        )
    db.commit()

    page = client.get(f"{BASE}/moments?limit=2&offset=0", headers=auth_headers).json()
    assert page["total"] == 5
    assert len(page["moments"]) == 2
    # Newest first.
    assert page["moments"][0]["scheduled_utc"] > page["moments"][1]["scheduled_utc"]
    page2 = client.get(f"{BASE}/moments?limit=2&offset=4", headers=auth_headers).json()
    assert len(page2["moments"]) == 1


def test_couple_isolation(client: TestClient, db: Session, auth_headers: dict) -> None:
    couple_id = client.get("/api/auth/me", headers=auth_headers).json()["couple"]["id"]
    moment = _open_moment(db, couple_id)
    other = register_and_login(client, "z@example.com", "Z")
    assert client.get(f"{BASE}/moments/{moment.id}", headers=other).status_code == 404
