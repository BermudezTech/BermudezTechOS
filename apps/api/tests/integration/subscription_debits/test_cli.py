"""Interfaz de línea de comandos (contracts/billing-service.md)."""

import logging
from datetime import date, timedelta
from pathlib import Path

import pytest
from sqlalchemy import text

from app.core.clock import SystemClock
from app.core.timezone import today_local
from app.modules.subscription_debits import __main__ as cli
from app.modules.subscription_debits import scheduler
from tests.integration.subscription_debits.factories import (
    Sessions,
    debits,
    make_account,
    make_subscription,
    make_user,
)

TODAY = today_local(SystemClock())


@pytest.fixture
def env(
    fresh_database: str,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.chdir(tmp_path)  # sin .env
    monkeypatch.setenv("DATABASE_URL", fresh_database)
    monkeypatch.setenv("BILLING_ACTIVATION_DATE", TODAY.replace(day=1).isoformat())
    # configure_logging reemplaza los handlers del root y dejaría a caplog sin registros.
    monkeypatch.setattr(cli, "configure_logging", lambda *args, **kwargs: None)


async def _subscription(sessions: Sessions) -> object:
    user = await make_user(sessions)
    account = await make_account(sessions, user)
    return await make_subscription(
        sessions,
        user,
        account,
        day=TODAY.day,
        start_date=TODAY - timedelta(days=400),
        name="Nombre privado",
    )


async def test_run_creates_and_logs_summary(
    env: None, sessions: Sessions, caplog: pytest.LogCaptureFixture
) -> None:
    sub = await _subscription(sessions)
    caplog.set_level(logging.INFO, logger="app.subscription_debits")

    assert await cli.async_main(["run"]) == 0

    assert len(await debits(sessions, sub)) == 1  # type: ignore[arg-type]
    [summary] = [r.getMessage() for r in caplog.records if "Resumen de cobros" in r.getMessage()]
    for key in (
        "fecha=",
        "trigger=manual",
        "usuarios=1",
        "suscripciones=1",
        "creados=1",
        "existentes=0",
        "no_vencidos=0",
        "omitidos=0",
        "fallidos=0",
        "duracion_ms=",
    ):
        assert key in summary
    logged = caplog.text
    assert "Nombre privado" not in logged
    assert "44900" not in logged


async def test_run_with_past_date(env: None, sessions: Sessions) -> None:
    await _subscription(sessions)
    assert await cli.async_main(["run", "--date", TODAY.isoformat()]) == 0


async def test_future_date_is_rejected(env: None, sessions: Sessions) -> None:
    sub = await _subscription(sessions)
    tomorrow = (TODAY + timedelta(days=1)).isoformat()

    assert await cli.async_main(["run", "--date", tomorrow]) == 2
    assert await debits(sessions, sub) == []  # type: ignore[arg-type]


async def test_malformed_date_is_rejected(env: None) -> None:
    assert await cli.async_main(["run", "--date", "2026-13-01"]) == 2


async def test_missing_activation_date(
    env: None, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.delenv("BILLING_ACTIVATION_DATE")

    assert await cli.async_main(["run"]) == 1
    assert "BILLING_ACTIVATION_DATE es obligatoria" in caplog.text


async def test_unexpected_schema(
    env: None, sessions: Sessions, caplog: pytest.LogCaptureFixture
) -> None:
    sub = await _subscription(sessions)
    async with sessions() as session:
        await session.execute(text("UPDATE alembic_version SET version_num = '0000'"))
        await session.commit()

    assert await cli.async_main(["run"]) == 1
    assert "Esquema inesperado" in caplog.text
    assert await debits(sessions, sub) == []  # type: ignore[arg-type]


def test_health_without_heartbeat(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(scheduler, "HEARTBEAT_PATH", tmp_path / "hb")
    assert cli.main(["health"]) == 1
    (tmp_path / "hb").touch()
    assert cli.main(["health"]) == 0


def test_today_is_bogota_date() -> None:
    assert isinstance(TODAY, date)
