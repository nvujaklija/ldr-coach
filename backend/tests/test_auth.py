"""Register -> login -> access a protected route."""

from fastapi.testclient import TestClient

REGISTER = "/api/auth/register"
LOGIN = "/api/auth/login"
ME = "/api/auth/me"

CREDS = {"email": "sam@example.com", "password": "supersecret", "display_name": "Sam"}


def test_register_login_me(client: TestClient) -> None:
    # Register
    r = client.post(REGISTER, json=CREDS)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == CREDS["email"]
    assert "id" in body
    assert "hashed_password" not in body  # never leak the hash

    # Duplicate registration is rejected
    assert client.post(REGISTER, json=CREDS).status_code == 409

    # Login (OAuth2 form: username == email)
    r = client.post(LOGIN, data={"username": CREDS["email"], "password": CREDS["password"]})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    assert token

    # Protected route with the token
    r = client.get(ME, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == CREDS["email"]


def test_me_requires_auth(client: TestClient) -> None:
    assert client.get(ME).status_code == 401


def test_login_wrong_password(client: TestClient) -> None:
    client.post(REGISTER, json=CREDS)
    r = client.post(LOGIN, data={"username": CREDS["email"], "password": "wrong"})
    assert r.status_code == 401
