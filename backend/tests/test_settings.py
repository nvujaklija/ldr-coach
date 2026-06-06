"""Settings endpoints: defaults, user + couple updates, validation, isolation."""

from fastapi.testclient import TestClient

from tests.conftest import register_and_login

SETTINGS = "/api/v1/settings"


def test_settings_require_auth(client: TestClient) -> None:
    assert client.get(SETTINGS).status_code == 401
    assert client.put(SETTINGS, json={}).status_code == 401


def test_get_returns_defaults(client: TestClient, auth_headers: dict) -> None:
    r = client.get(SETTINGS, headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"] == {
        "timezone": "UTC",
        "theme": "system",
        "notify_checkin_reminders": True,
        "notify_visit_reminders": True,
        "notify_ritual_reminders": True,
    }
    assert body["couple"] == {
        "relationship_start_date": None,
        "show_visits": True,
        "show_rituals": True,
        "show_checkins": True,
    }


def test_solo_user_has_no_couple_settings(client: TestClient) -> None:
    headers = register_and_login(client, "solo@example.com", "Solo", with_couple=False)
    body = client.get(SETTINGS, headers=headers).json()
    assert body["couple"] is None


def test_update_user_preferences(client: TestClient, auth_headers: dict) -> None:
    r = client.put(
        SETTINGS,
        json={
            "user": {"timezone": "Europe/Rome", "theme": "dark", "notify_visit_reminders": False}
        },
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    user = r.json()["user"]
    assert user["timezone"] == "Europe/Rome"
    assert user["theme"] == "dark"
    assert user["notify_visit_reminders"] is False
    # Untouched fields keep their defaults.
    assert user["notify_checkin_reminders"] is True
    # Persisted across requests.
    assert client.get(SETTINGS, headers=auth_headers).json()["user"]["theme"] == "dark"


def test_update_couple_settings(client: TestClient, auth_headers: dict) -> None:
    r = client.put(
        SETTINGS,
        json={"couple": {"relationship_start_date": "2020-02-14", "show_rituals": False}},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    couple = r.json()["couple"]
    assert couple["relationship_start_date"] == "2020-02-14"
    assert couple["show_rituals"] is False
    assert couple["show_visits"] is True


def test_partner_sees_shared_couple_settings(client: TestClient, auth_headers: dict) -> None:
    # First partner records the relationship start date.
    client.put(
        SETTINGS,
        json={"couple": {"relationship_start_date": "2019-07-01"}},
        headers=auth_headers,
    )
    # Second partner joins the same couple via an invite.
    code = client.post("/api/v1/couples/invites", headers=auth_headers).json()["code"]
    partner = register_and_login(client, "sam@example.com", "Sam", with_couple=False)
    client.post("/api/v1/couples/join", json={"code": code}, headers=partner)

    body = client.get(SETTINGS, headers=partner).json()
    assert body["couple"]["relationship_start_date"] == "2019-07-01"


def test_solo_user_cannot_set_couple_settings(client: TestClient) -> None:
    headers = register_and_login(client, "solo@example.com", "Solo", with_couple=False)
    r = client.put(SETTINGS, json={"couple": {"show_visits": False}}, headers=headers)
    assert r.status_code == 400


def test_invalid_values_rejected(client: TestClient, auth_headers: dict) -> None:
    bad = [
        {"user": {"timezone": "Nowhere/Land"}},
        {"user": {"theme": "neon"}},
        {"couple": {"relationship_start_date": "2999-01-01"}},
    ]
    for payload in bad:
        assert client.put(SETTINGS, json=payload, headers=auth_headers).status_code == 422, payload


def test_clearing_relationship_start_date(client: TestClient, auth_headers: dict) -> None:
    client.put(
        SETTINGS,
        json={"couple": {"relationship_start_date": "2020-01-01"}},
        headers=auth_headers,
    )
    r = client.put(
        SETTINGS,
        json={"couple": {"relationship_start_date": None}},
        headers=auth_headers,
    )
    assert r.json()["couple"]["relationship_start_date"] is None
