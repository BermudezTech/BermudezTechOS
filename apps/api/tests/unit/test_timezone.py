"""Zona única del MVP: el resultado no depende de la zona del sistema (spec 007, FR-024)."""

import os
import time
from collections.abc import Iterator
from datetime import UTC, date, datetime

import pytest

from app.core.timezone import local_midnight_utc, today_local
from tests.conftest import FakeClock

SYSTEM_ZONES = ["UTC", "Asia/Tokyo", "Pacific/Honolulu"]


@pytest.fixture(params=SYSTEM_ZONES)
def system_zone(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> Iterator[str]:
    monkeypatch.setenv("TZ", request.param)
    time.tzset()
    yield request.param
    monkeypatch.undo()
    time.tzset()
    assert os.environ.get("TZ") != request.param or request.param == "UTC"


def _at(moment: datetime) -> FakeClock:
    clock = FakeClock()
    clock.current = moment
    return clock


def test_today_before_midnight_in_bogota(system_zone: str) -> None:
    # 04:30Z = 23:30 del día anterior en Bogotá.
    assert today_local(_at(datetime(2026, 10, 25, 4, 30, tzinfo=UTC))) == date(2026, 10, 24)


def test_today_at_midnight_in_bogota(system_zone: str) -> None:
    assert today_local(_at(datetime(2026, 10, 25, 5, 0, tzinfo=UTC))) == date(2026, 10, 25)


def test_local_midnight_utc(system_zone: str) -> None:
    assert local_midnight_utc(date(2026, 10, 15)) == datetime(2026, 10, 15, 5, 0, tzinfo=UTC)
