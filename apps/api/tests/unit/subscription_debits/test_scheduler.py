import os
import time as system_time
from collections.abc import Iterator
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path

import pytest

from app.modules.subscription_debits.scheduler import (
    Scheduler,
    is_heartbeat_fresh,
    next_run_at,
)
from app.modules.subscription_debits.service import RunSummary
from tests.conftest import FakeClock

RUN_TIME = time(0, 5)


@pytest.fixture(params=["UTC", "Asia/Tokyo", "Pacific/Honolulu"])
def system_zone(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> Iterator[str]:
    monkeypatch.setenv("TZ", request.param)
    system_time.tzset()
    yield request.param
    monkeypatch.undo()
    system_time.tzset()


def _clock(moment: datetime) -> FakeClock:
    clock = FakeClock()
    clock.current = moment
    return clock


def test_next_run_same_day(system_zone: str) -> None:
    now = datetime(2026, 10, 24, 5, 4, tzinfo=UTC)  # 00:04 en Bogotá
    assert next_run_at(now, RUN_TIME) == datetime(2026, 10, 24, 5, 5, tzinfo=UTC)


def test_next_run_next_day(system_zone: str) -> None:
    now = datetime(2026, 10, 24, 5, 6, tzinfo=UTC)
    assert next_run_at(now, RUN_TIME) == datetime(2026, 10, 25, 5, 5, tzinfo=UTC)


def test_next_run_late_evening_in_bogota(system_zone: str) -> None:
    # 23:30 del 24 en Bogotá = 04:30Z del 25: la siguiente es el 25 a las 00:05 de Bogotá.
    now = datetime(2026, 10, 25, 4, 30, tzinfo=UTC)
    assert next_run_at(now, RUN_TIME) == datetime(2026, 10, 25, 5, 5, tzinfo=UTC)


def test_heartbeat_freshness(tmp_path: Path) -> None:
    path = tmp_path / "heartbeat"
    now = datetime.now(UTC)
    assert not is_heartbeat_fresh(path, now)
    path.touch()
    recent = (now - timedelta(seconds=60)).timestamp()
    os.utime(path, (recent, recent))
    assert is_heartbeat_fresh(path, now)
    old = (now - timedelta(seconds=200)).timestamp()
    os.utime(path, (old, old))
    assert not is_heartbeat_fresh(path, now)


class _FakeService:
    def __init__(self) -> None:
        self.calls: list[tuple[date, str]] = []

    async def run_for_date(self, d: date, trigger: str) -> RunSummary:
        self.calls.append((d, trigger))
        return RunSummary(run_date=d, trigger=trigger)


async def _schema_ok() -> str | None:
    return None


async def test_startup_then_daily(tmp_path: Path) -> None:
    # 23:00 del 24 en Bogotá.
    clock = _clock(datetime(2026, 10, 25, 4, 0, tzinfo=UTC))
    service = _FakeService()

    async def sleep(seconds: float) -> None:
        clock.advance(timedelta(seconds=seconds))

    scheduler = Scheduler(
        service, _schema_ok, clock, RUN_TIME, heartbeat=tmp_path / "hb", sleep=sleep
    )
    # Dos horas de ticks de 60 s: cruza las 00:05 del 25 en Bogotá una sola vez.
    await scheduler.serve(max_ticks=120)

    assert service.calls == [(date(2026, 10, 24), "startup"), (date(2026, 10, 25), "scheduled")]
    assert (tmp_path / "hb").exists()


async def test_schema_mismatch_skips_run(tmp_path: Path) -> None:
    clock = _clock(datetime(2026, 10, 25, 4, 0, tzinfo=UTC))
    service = _FakeService()

    async def bad_schema() -> str | None:
        return "Esquema inesperado"

    async def sleep(seconds: float) -> None:
        clock.advance(timedelta(seconds=seconds))

    scheduler = Scheduler(
        service, bad_schema, clock, RUN_TIME, heartbeat=tmp_path / "hb", sleep=sleep
    )
    await scheduler.serve(max_ticks=1)

    assert service.calls == []


async def test_run_retries_after_failure(tmp_path: Path) -> None:
    clock = _clock(datetime(2026, 10, 25, 4, 0, tzinfo=UTC))
    attempts: list[str] = []

    class Flaky(_FakeService):
        async def run_for_date(self, d: date, trigger: str) -> RunSummary:
            attempts.append(trigger)
            if len(attempts) < 3:
                raise OSError("sin base")
            return await super().run_for_date(d, trigger)

    slept: list[float] = []

    async def sleep(seconds: float) -> None:
        slept.append(seconds)
        clock.advance(timedelta(seconds=seconds))

    service = Flaky()
    scheduler = Scheduler(
        service, _schema_ok, clock, RUN_TIME, heartbeat=tmp_path / "hb", sleep=sleep
    )
    summary = await scheduler.run_once("startup")

    assert summary is not None
    assert len(attempts) == 3
    # 1 min y 5 min de espera, en ticks que mantienen vivo el latido.
    assert sum(slept) == 60 + 300
