"""Notification endpoints + reminder generation: prefs, due-gating, dedup."""

from datetime import UTC, date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Couple,
    CoupleMember,
    Notification,
    User,
    Visit,
)
from app.services import notifications as svc
from tests.conftest import register_and_login

NOTIFS = "/api/notifications"
PREFS = "/api/notifications/preferences"


# --- helpers -------------------------------------------------------------


def _make_couple(db: Session, *emails: str) -> tuple[Couple, list[User]]:
    """Create a couple with one member per email; return (couple, users)."""
    couple = Couple(name="Us")
    db.add(couple)
    db.flush()
    users = []
    for email in emails:
        user = User(email=email, hashed_password="x", display_name=email[:4])
        db.add(user)
        db.flush()
        db.add(CoupleMember(couple_id=couple.id, user_id=user.id, role="partner"))
        users.append(user)
    db.commit()
    return couple, users


def _user_id(db: Session, email: str) -> str:
    return db.scalar(select(User.id).where(User.email == email))


# --- pure trigger-time helpers -------------------------------------------


def test_visit_reminder_trigger_is_n_days_before() -> None:
    trigger = svc.visit_reminder_trigger(date(2026, 6, 20), 3)
    assert trigger.date() == date(2026, 6, 17)
    assert trigger.tzinfo is not None


def test_ritual_reminder_trigger_lands_on_occurrence_day() -> None:
    # 21:00 UTC on the 5th is still the 5th in Rome (23:00 local).
    scheduled = datetime(2026, 6, 5, 21, 0, tzinfo=UTC)
    trigger = svc.ritual_reminder_trigger(scheduled, "Europe/Rome")
    # Reminder fires the morning of the same local day.
    assert trigger.astimezone(UTC) < scheduled
    assert trigger.tzinfo is not None


def test_ritual_reminder_trigger_bad_timezone_falls_back() -> None:
    scheduled = datetime(2026, 6, 5, 12, 0, tzinfo=UTC)
    trigger = svc.ritual_reminder_trigger(scheduled, "Mars/Phobos")
    assert trigger.date() == date(2026, 6, 5)


# --- preferences ---------------------------------------------------------


def test_preferences_require_auth(client: TestClient) -> None:
    assert client.get(PREFS).status_code == 401


def test_get_preferences_returns_defaults(client: TestClient) -> None:
    headers = register_and_login(client, "alex@example.com", "Alex", with_couple=False)
    r = client.get(PREFS, headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["visit_reminders_enabled"] is True
    assert body["ritual_reminders_enabled"] is True
    assert body["visit_reminder_days"] == 3


def test_update_preferences(client: TestClient) -> None:
    headers = register_and_login(client, "alex@example.com", "Alex", with_couple=False)
    r = client.patch(
        PREFS,
        json={"visit_reminder_days": 7, "ritual_reminders_enabled": False},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["visit_reminder_days"] == 7
    assert body["ritual_reminders_enabled"] is False
    # Unspecified fields are untouched.
    assert body["visit_reminders_enabled"] is True


def test_update_preferences_rejects_out_of_range_days(client: TestClient) -> None:
    headers = register_and_login(client, "alex@example.com", "Alex", with_couple=False)
    r = client.patch(PREFS, json={"visit_reminder_days": 999}, headers=headers)
    assert r.status_code == 422


# --- generation ----------------------------------------------------------


def test_generate_visit_reminders_one_per_partner(db: Session) -> None:
    couple, _ = _make_couple(db, "a@x.com", "b@x.com")
    db.add(
        Visit(
            couple_id=couple.id,
            location="Rome",
            start_date=date.today() + timedelta(days=10),
            status="planned",
        )
    )
    db.commit()

    created = svc.generate(db)
    assert created == 2  # one reminder per partner
    rows = list(db.scalars(select(Notification).where(Notification.type == "visit_reminder")))
    assert len(rows) == 2
    assert rows[0].payload["location"] == "Rome"


def test_generation_is_idempotent(db: Session) -> None:
    couple, _ = _make_couple(db, "a@x.com", "b@x.com")
    db.add(
        Visit(
            couple_id=couple.id,
            location="Rome",
            start_date=date.today() + timedelta(days=10),
            status="planned",
        )
    )
    db.commit()

    assert svc.generate(db) == 2
    # A second pass produces nothing new thanks to the dedup key.
    assert svc.generate(db) == 0


def test_disabled_visit_reminders_are_skipped(db: Session) -> None:
    couple, users = _make_couple(db, "a@x.com", "b@x.com")
    prefs = svc.get_or_create_preference(db, users[0].id)
    prefs.visit_reminders_enabled = False
    db.commit()
    db.add(
        Visit(
            couple_id=couple.id,
            location="Rome",
            start_date=date.today() + timedelta(days=10),
            status="planned",
        )
    )
    db.commit()

    assert svc.generate(db) == 1  # only the partner who left them enabled


def test_generate_ritual_reminders(client: TestClient, db: Session) -> None:
    # Create a ritual through the API so an instance is materialized.
    headers = register_and_login(client, "alex@example.com", "Alex")
    client.post(
        "/api/rituals",
        json={
            "title": "Movie Night", "cadence": "daily",
            "time_of_day": "20:00", "timezone": "UTC",
        },
        headers=headers,
    )
    created = svc.generate(db)
    assert created >= 1
    rows = list(db.scalars(select(Notification).where(Notification.type == "ritual_reminder")))
    assert rows
    assert rows[0].payload["title"] == "Movie Night"


# --- listing, due-gating, read state -------------------------------------


def _seed_notification(db: Session, user_id: str, **over) -> Notification:
    defaults = dict(
        user_id=user_id,
        type="visit_reminder",
        title="Visit soon",
        body=None,
        payload={},
        trigger_at=datetime.now(UTC) - timedelta(hours=1),
        dedup_key=None,
    )
    defaults.update(over)
    n = Notification(**defaults)
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


def test_list_requires_auth(client: TestClient) -> None:
    assert client.get(NOTIFS).status_code == 401


def test_list_returns_only_due_notifications(client: TestClient, db: Session) -> None:
    headers = register_and_login(client, "alex@example.com", "Alex", with_couple=False)
    uid = _user_id(db, "alex@example.com")
    _seed_notification(db, uid, title="Due now", dedup_key="a")
    _seed_notification(
        db, uid, title="Future", dedup_key="b",
        trigger_at=datetime.now(UTC) + timedelta(days=1),
    )

    body = client.get(NOTIFS, headers=headers).json()
    titles = [n["title"] for n in body["notifications"]]
    assert titles == ["Due now"]
    assert body["unread_count"] == 1


def test_mark_one_read(client: TestClient, db: Session) -> None:
    headers = register_and_login(client, "alex@example.com", "Alex", with_couple=False)
    uid = _user_id(db, "alex@example.com")
    n = _seed_notification(db, uid, dedup_key="a")

    r = client.post(f"{NOTIFS}/{n.id}/read", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["read_at"] is not None
    assert client.get(NOTIFS, headers=headers).json()["unread_count"] == 0


def test_mark_all_read(client: TestClient, db: Session) -> None:
    headers = register_and_login(client, "alex@example.com", "Alex", with_couple=False)
    uid = _user_id(db, "alex@example.com")
    _seed_notification(db, uid, dedup_key="a")
    _seed_notification(db, uid, dedup_key="b")

    r = client.post(f"{NOTIFS}/read-all", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["unread_count"] == 0


def test_user_isolation(client: TestClient, db: Session) -> None:
    register_and_login(client, "alex@example.com", "Alex", with_couple=False)
    other = register_and_login(client, "sam@example.com", "Sam", with_couple=False)
    alex_id = _user_id(db, "alex@example.com")
    n = _seed_notification(db, alex_id, dedup_key="a")

    # Sam can neither see nor mark Alex's notification.
    assert client.get(NOTIFS, headers=other).json()["notifications"] == []
    assert client.post(f"{NOTIFS}/{n.id}/read", headers=other).status_code == 404
