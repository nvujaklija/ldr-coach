"""Couple onboarding: create a couple, invite a partner, join via the code."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings

REGISTER = "/api/auth/register"
LOGIN = "/api/auth/login"
ME = "/api/auth/me"
COUPLES = "/api/couples"
INVITES = "/api/couples/invites"
JOIN = "/api/couples/join"


def _auth(client: TestClient, email: str, name: str) -> dict[str, str]:
    """Register + login a user, returning an Authorization header dict."""
    client.post(REGISTER, json={"email": email, "password": "supersecret", "display_name": name})
    token = client.post(LOGIN, data={"username": email, "password": "supersecret"}).json()[
        "access_token"
    ]
    return {"Authorization": f"Bearer {token}"}


def test_me_has_no_couple_before_onboarding(client: TestClient) -> None:
    headers = _auth(client, "alex@example.com", "Alex")
    body = client.get(ME, headers=headers).json()
    assert body["couple"] is None


def test_full_invite_and_join_flow(client: TestClient) -> None:
    alex = _auth(client, "alex@example.com", "Alex")
    sam = _auth(client, "sam@example.com", "Sam")

    # Alex creates the couple and is its first member.
    r = client.post(COUPLES, json={"name": "Alex & Sam"}, headers=alex)
    assert r.status_code == 201, r.text
    couple = r.json()
    assert couple["name"] == "Alex & Sam"
    assert [m["display_name"] for m in couple["members"]] == ["Alex"]

    # Alex generates an invite to share.
    r = client.post(INVITES, headers=alex)
    assert r.status_code == 201, r.text
    invite = r.json()
    assert invite["accepted"] is False
    assert invite["code"]
    assert invite["code"] in invite["invite_url"]

    # Sam joins with the code; the couple now has both partners.
    r = client.post(JOIN, json={"code": invite["code"]}, headers=sam)
    assert r.status_code == 200, r.text
    names = sorted(m["display_name"] for m in r.json()["members"])
    assert names == ["Alex", "Sam"]

    # /me reflects the couple for both partners.
    assert client.get(ME, headers=alex).json()["couple"]["name"] == "Alex & Sam"
    assert client.get(ME, headers=sam).json()["couple"]["id"] == couple["id"]


def test_cannot_create_second_couple(client: TestClient) -> None:
    alex = _auth(client, "alex@example.com", "Alex")
    assert client.post(COUPLES, json={"name": "A & S"}, headers=alex).status_code == 201
    assert client.post(COUPLES, json={"name": "Other"}, headers=alex).status_code == 409


def test_join_with_invalid_code(client: TestClient) -> None:
    sam = _auth(client, "sam@example.com", "Sam")
    assert client.post(JOIN, json={"code": "NOPENOPE"}, headers=sam).status_code == 404


def test_invite_is_single_use(client: TestClient) -> None:
    alex = _auth(client, "alex@example.com", "Alex")
    sam = _auth(client, "sam@example.com", "Sam")
    pat = _auth(client, "pat@example.com", "Pat")

    client.post(COUPLES, json={"name": "Alex & Sam"}, headers=alex)
    code = client.post(INVITES, headers=alex).json()["code"]

    assert client.post(JOIN, json={"code": code}, headers=sam).status_code == 200
    # Re-using the same code is rejected.
    assert client.post(JOIN, json={"code": code}, headers=pat).status_code == 409


def test_cannot_join_when_already_in_a_couple(client: TestClient) -> None:
    alex = _auth(client, "alex@example.com", "Alex")
    sam = _auth(client, "sam@example.com", "Sam")

    client.post(COUPLES, json={"name": "Alex solo"}, headers=alex)
    client.post(COUPLES, json={"name": "Sam solo"}, headers=sam)
    code = client.post(INVITES, headers=alex).json()["code"]

    # Sam already belongs to a couple, so joining Alex's is rejected.
    assert client.post(JOIN, json={"code": code}, headers=sam).status_code == 409


def test_expired_invite_is_rejected(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    alex = _auth(client, "alex@example.com", "Alex")
    sam = _auth(client, "sam@example.com", "Sam")
    client.post(COUPLES, json={"name": "Alex & Sam"}, headers=alex)

    # Mint an invite that is already past its expiry.
    monkeypatch.setattr(settings, "INVITE_EXPIRE_DAYS", -1)
    code = client.post(INVITES, headers=alex).json()["code"]

    assert client.post(JOIN, json={"code": code}, headers=sam).status_code == 410


def test_invite_requires_a_couple(client: TestClient) -> None:
    alex = _auth(client, "alex@example.com", "Alex")
    assert client.post(INVITES, headers=alex).status_code == 404


def test_couple_endpoints_require_auth(client: TestClient) -> None:
    assert client.post(COUPLES, json={"name": "x"}).status_code == 401
    assert client.post(INVITES).status_code == 401
    assert client.post(JOIN, json={"code": "x"}).status_code == 401
