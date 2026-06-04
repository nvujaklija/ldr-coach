"""Letter endpoints: compose, future-unlock gatekeeping, inbox/sent, opening."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from tests.conftest import register_and_login

LETTERS = "/api/v1/letters"


def _pair(client: TestClient) -> tuple[dict, dict]:
    """Register two partners in one couple; return (alex_headers, sam_headers)."""
    alex = register_and_login(client, "alex@example.com", "Alex")
    sam = register_and_login(client, "sam@example.com", "Sam", with_couple=False)
    code = client.post("/api/v1/couples/invites", headers=alex).json()["code"]
    client.post("/api/v1/couples/join", json={"code": code}, headers=sam)
    return alex, sam


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def test_letters_require_auth(client: TestClient) -> None:
    assert client.get(LETTERS).status_code == 401
    assert client.post(LETTERS, json={"title": "x", "body": "y"}).status_code == 401


def test_letters_require_a_couple(client: TestClient) -> None:
    solo = register_and_login(client, "solo@example.com", "Solo", with_couple=False)
    assert client.get(LETTERS, headers=solo).status_code == 400


def test_letter_defaults_to_partner_and_unlocked_now(client: TestClient) -> None:
    alex, sam = _pair(client)
    r = client.post(LETTERS, json={"title": "Hello", "body": "Thinking of you"}, headers=alex)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["direction"] == "sent"
    assert body["from_name"] == "Alex"
    assert body["to_name"] == "Sam"
    assert body["is_locked"] is False
    # Sender always sees their own body.
    assert body["body"] == "Thinking of you"

    # It lands in Sam's inbox, unlocked, with the body visible.
    inbox = client.get(LETTERS, headers=sam).json()
    assert len(inbox) == 1
    assert inbox[0]["direction"] == "received"
    assert inbox[0]["is_locked"] is False
    assert inbox[0]["body"] == "Thinking of you"


def test_locked_letter_hides_body_from_recipient_only(client: TestClient) -> None:
    alex, sam = _pair(client)
    future = datetime.now(UTC) + timedelta(days=30)
    client.post(
        LETTERS,
        json={"title": "Future", "body": "secret words", "visible_from": _iso(future)},
        headers=alex,
    )

    # Recipient sees the locked teaser but never the body.
    inbox = client.get(LETTERS, headers=sam).json()
    assert inbox[0]["is_locked"] is True
    assert inbox[0]["body"] is None
    assert inbox[0]["title"] == "Future"

    # Sender still sees their own body in the sent box.
    sent = client.get(f"{LETTERS}?box=sent", headers=alex).json()
    assert sent[0]["body"] == "secret words"
    assert sent[0]["is_locked"] is True


def test_cannot_open_locked_letter(client: TestClient) -> None:
    alex, sam = _pair(client)
    future = datetime.now(UTC) + timedelta(days=1)
    lid = client.post(
        LETTERS,
        json={"title": "Soon", "body": "patience", "visible_from": _iso(future)},
        headers=alex,
    ).json()["id"]

    r = client.post(f"{LETTERS}/{lid}/open", headers=sam)
    assert r.status_code == 403


def test_open_unlocked_letter_marks_it_opened(client: TestClient) -> None:
    alex, sam = _pair(client)
    lid = client.post(LETTERS, json={"title": "Hi", "body": "open me"}, headers=alex).json()["id"]

    r = client.post(f"{LETTERS}/{lid}/open", headers=sam)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["is_opened"] is True
    assert body["body"] == "open me"
    # Reflected in the inbox afterwards.
    assert client.get(LETTERS, headers=sam).json()[0]["is_opened"] is True


def test_only_recipient_can_open(client: TestClient) -> None:
    alex, sam = _pair(client)
    lid = client.post(LETTERS, json={"title": "Hi", "body": "mine"}, headers=alex).json()["id"]
    # The sender is not the recipient; opening 404s rather than leaking state.
    assert client.post(f"{LETTERS}/{lid}/open", headers=alex).status_code == 404


def test_explicit_recipient_must_be_in_couple(client: TestClient) -> None:
    alex, _sam = _pair(client)
    outsider = register_and_login(client, "pat@example.com", "Pat")
    me = client.get("/api/v1/auth/me", headers=outsider).json()
    r = client.post(
        LETTERS,
        json={"title": "x", "body": "y", "to_user_id": me["id"]},
        headers=alex,
    )
    assert r.status_code == 400


def test_couple_isolation(client: TestClient) -> None:
    alex, _sam = _pair(client)
    client.post(LETTERS, json={"title": "private", "body": "ours"}, headers=alex)

    other = register_and_login(client, "ina@example.com", "Ina")
    assert client.get(LETTERS, headers=other).json() == []
    assert client.get(f"{LETTERS}?box=sent", headers=other).json() == []
