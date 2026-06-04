"""Ritual endpoints + scheduling logic: templates, CRUD, occurrences, isolation."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import CoupleRitual
from app.services.rituals import compute_next_occurrence, seed_default_templates
from tests.conftest import register_and_login

RITUALS = "/api/v1/rituals"


# --- scheduling unit tests (pure, deterministic) -------------------------


def test_compute_next_occurrence_weekly_lands_on_target_weekday() -> None:
    ritual = CoupleRitual(
        couple_id="c", title="t", cadence="weekly",
        day_of_week=0, time_of_day="09:00", timezone="UTC",  # Monday 09:00
    )
    after = datetime(2026, 6, 3, 12, 0, tzinfo=UTC)  # a Wednesday
    nxt = compute_next_occurrence(ritual, after=after)
    assert nxt is not None
    assert nxt > after
    assert nxt.weekday() == 0
    assert (nxt.hour, nxt.minute) == (9, 0)


def test_compute_next_occurrence_daily_within_a_day() -> None:
    ritual = CoupleRitual(
        couple_id="c", title="t", cadence="daily", time_of_day="00:00", timezone="UTC"
    )
    after = datetime(2026, 6, 3, 12, 0, tzinfo=UTC)
    nxt = compute_next_occurrence(ritual, after=after)
    assert nxt is not None
    assert after < nxt <= after + timedelta(days=1)


def test_compute_next_occurrence_bad_timezone_returns_none() -> None:
    ritual = CoupleRitual(
        couple_id="c", title="t", cadence="daily", time_of_day="08:00", timezone="Mars/Phobos"
    )
    assert compute_next_occurrence(ritual, after=datetime.now(UTC)) is None


# --- endpoint tests ------------------------------------------------------


def test_rituals_require_auth(client: TestClient) -> None:
    assert client.get(RITUALS).status_code == 401
    assert client.get(f"{RITUALS}/templates").status_code == 401
    assert client.post(RITUALS, json={"title": "x", "cadence": "weekly"}).status_code == 401


def test_list_templates(client: TestClient, db: Session, auth_headers: dict) -> None:
    seed_default_templates(db)
    r = client.get(f"{RITUALS}/templates", headers=auth_headers)
    assert r.status_code == 200, r.text
    keys = {t["key"] for t in r.json()}
    assert {"movie_night", "game_night", "parallel_walk"} <= keys


def test_create_from_template_materializes_next_instance(
    client: TestClient, db: Session, auth_headers: dict
) -> None:
    seed_default_templates(db)
    payload = {
        "template_key": "movie_night",
        "title": "Movie Night",
        "cadence": "weekly",
        "day_of_week": 5,
        "time_of_day": "20:00",
        "timezone": "Europe/Rome",
    }
    r = client.post(RITUALS, json=payload, headers=auth_headers)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "active"
    assert body["template_key"] == "movie_night"
    assert body["next_instance"] is not None
    assert body["next_instance"]["status"] == "planned"


def test_create_custom_ritual_without_template(client: TestClient, auth_headers: dict) -> None:
    r = client.post(
        RITUALS,
        json={
            "title": "Sunday call", "cadence": "weekly",
            "day_of_week": 6, "time_of_day": "09:00", "timezone": "UTC",
        },
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["template_key"] is None


def test_unknown_template_rejected(client: TestClient, auth_headers: dict) -> None:
    r = client.post(
        RITUALS,
        json={"template_key": "does_not_exist", "title": "x", "cadence": "weekly"},
        headers=auth_headers,
    )
    assert r.status_code == 404


def test_invalid_fields_rejected(client: TestClient, auth_headers: dict) -> None:
    bad_payloads = [
        {"title": "x", "cadence": "yearly"},
        {"title": "x", "cadence": "weekly", "time_of_day": "25:00"},
        {"title": "x", "cadence": "weekly", "timezone": "Nowhere/Land"},
        {"title": "x", "cadence": "weekly", "day_of_week": 9},
    ]
    for payload in bad_payloads:
        assert client.post(RITUALS, json=payload, headers=auth_headers).status_code == 422, payload


def test_list_returns_active_rituals_in_order(client: TestClient, auth_headers: dict) -> None:
    client.post(
        RITUALS,
        json={"title": "A", "cadence": "daily", "time_of_day": "08:00", "timezone": "UTC"},
        headers=auth_headers,
    )
    client.post(
        RITUALS,
        json={"title": "B", "cadence": "weekly", "day_of_week": 2,
              "time_of_day": "19:00", "timezone": "UTC"},
        headers=auth_headers,
    )
    r = client.get(RITUALS, headers=auth_headers)
    assert r.status_code == 200
    assert [x["title"] for x in r.json()] == ["A", "B"]


def test_pause_clears_next_instance_and_cancel_hides_ritual(
    client: TestClient, auth_headers: dict
) -> None:
    rid = client.post(
        RITUALS,
        json={"title": "A", "cadence": "daily", "time_of_day": "08:00", "timezone": "UTC"},
        headers=auth_headers,
    ).json()["id"]

    paused = client.patch(f"{RITUALS}/{rid}", json={"status": "paused"}, headers=auth_headers)
    assert paused.status_code == 200
    assert paused.json()["next_instance"] is None

    client.patch(f"{RITUALS}/{rid}", json={"status": "cancelled"}, headers=auth_headers)
    assert client.get(RITUALS, headers=auth_headers).json() == []


def test_mark_instance_done_rolls_schedule_forward(
    client: TestClient, auth_headers: dict
) -> None:
    created = client.post(
        RITUALS,
        json={"title": "Daily", "cadence": "daily", "time_of_day": "08:00", "timezone": "UTC"},
        headers=auth_headers,
    ).json()
    rid, iid = created["id"], created["next_instance"]["id"]

    r = client.patch(
        f"{RITUALS}/{rid}/instances/{iid}", json={"status": "done"}, headers=auth_headers
    )
    assert r.status_code == 200, r.text
    nxt = r.json()["next_instance"]
    assert nxt is not None
    assert nxt["id"] != iid


def test_couple_isolation(client: TestClient, auth_headers: dict) -> None:
    rid = client.post(
        RITUALS,
        json={"title": "Mine", "cadence": "daily", "time_of_day": "08:00", "timezone": "UTC"},
        headers=auth_headers,
    ).json()["id"]

    other = register_and_login(client, "sam@example.com", "Sam")
    assert client.patch(
        f"{RITUALS}/{rid}", json={"status": "paused"}, headers=other
    ).status_code == 404
    assert client.get(RITUALS, headers=other).json() == []
