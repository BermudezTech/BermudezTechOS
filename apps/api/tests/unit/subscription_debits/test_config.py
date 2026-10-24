from datetime import date, time
from pathlib import Path

import pytest

from app.core.config import ConfigError
from app.modules.subscription_debits.config import load_billing_settings

URL = "postgresql+asyncpg://u:p@localhost/db"


@pytest.fixture(autouse=True)
def _env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)  # sin .env
    # El worker no maneja tokens: no debe exigir los secretos de la API.
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("PASSWORD_RESET_PEPPER", raising=False)
    monkeypatch.delenv("BILLING_RUN_TIME", raising=False)
    monkeypatch.setenv("DATABASE_URL", URL)
    monkeypatch.setenv("BILLING_ACTIVATION_DATE", "2026-10-24")


def test_loads_with_defaults() -> None:
    settings = load_billing_settings()
    assert settings.billing_activation_date == date(2026, 10, 24)
    assert settings.billing_run_time == time(0, 5)
    assert settings.log_level == "INFO"


def test_empty_run_time_uses_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BILLING_RUN_TIME", "")
    assert load_billing_settings().billing_run_time == time(0, 5)


def test_custom_run_time(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BILLING_RUN_TIME", "03:30")
    assert load_billing_settings().billing_run_time == time(3, 30)


@pytest.mark.parametrize("value", ["25:00", "3:30", "03:30:00", "mañana"])
def test_invalid_run_time(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    monkeypatch.setenv("BILLING_RUN_TIME", value)
    with pytest.raises(ConfigError, match="BILLING_RUN_TIME"):
        load_billing_settings()


def test_activation_date_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BILLING_ACTIVATION_DATE")
    with pytest.raises(ConfigError, match="BILLING_ACTIVATION_DATE es obligatoria"):
        load_billing_settings()


def test_invalid_activation_date_hides_value(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BILLING_ACTIVATION_DATE", "secreto-2026")
    with pytest.raises(ConfigError, match="BILLING_ACTIVATION_DATE") as error:
        load_billing_settings()
    assert "secreto-2026" not in str(error.value)


def test_database_url_prefix(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost/db")
    with pytest.raises(ConfigError, match="DATABASE_URL"):
        load_billing_settings()
