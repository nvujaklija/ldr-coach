"""Config parses env values the way docker-compose supplies them."""

from app.core.config import Settings


def test_cors_origins_from_comma_separated_env(monkeypatch) -> None:
    # docker-compose passes a bare comma-separated string, not JSON.
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost, http://example.com")
    settings = Settings()
    assert settings.CORS_ORIGINS == ["http://localhost", "http://example.com"]


def test_cors_origins_default_is_a_list() -> None:
    assert isinstance(Settings().CORS_ORIGINS, list)
