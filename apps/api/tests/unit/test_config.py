import pytest

from app.core.config import ConfigError, load_settings

VALID = {
    "DATABASE_URL": "postgresql+asyncpg://u:p@localhost/db",
    "JWT_SECRET": "j" * 40,
    "PASSWORD_RESET_PEPPER": "p" * 40,
}


@pytest.fixture
def env(monkeypatch: pytest.MonkeyPatch, tmp_path):  # type: ignore[no-untyped-def]
    monkeypatch.chdir(tmp_path)  # sin .env
    for key in (
        "DATABASE_URL",
        "JWT_SECRET",
        "PASSWORD_RESET_PEPPER",
        "RESEND_API_KEY",
        "MAIL_FROM",
    ):
        monkeypatch.delenv(key, raising=False)

    def _set(**values: str) -> None:
        for key, value in {**VALID, **values}.items():
            if value:
                monkeypatch.setenv(key, value)

    return _set


def test_missing_jwt_secret(env, monkeypatch: pytest.MonkeyPatch) -> None:  # type: ignore[no-untyped-def]
    env(JWT_SECRET="")
    with pytest.raises(ConfigError, match="JWT_SECRET es obligatoria"):
        load_settings()


def test_short_jwt_secret_does_not_leak_value(env) -> None:  # type: ignore[no-untyped-def]
    secret = "s" * 31
    env(JWT_SECRET=secret)
    with pytest.raises(ConfigError) as error:
        load_settings()
    assert "JWT_SECRET" in str(error.value)
    assert secret not in str(error.value)


def test_resend_without_mail_from_is_invalid(env) -> None:  # type: ignore[no-untyped-def]
    env(RESEND_API_KEY="re_test")
    with pytest.raises(ConfigError, match="MAIL_FROM"):
        load_settings()


def test_mail_is_optional(env) -> None:  # type: ignore[no-untyped-def]
    env()
    settings = load_settings()
    assert not settings.mail_configured


def test_cors_origins_are_split(env) -> None:  # type: ignore[no-untyped-def]
    env(CORS_ORIGINS="http://a.test, http://b.test")
    assert load_settings().cors_origins == ["http://a.test", "http://b.test"]
