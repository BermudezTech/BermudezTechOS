"""Reloj inyectable: toda la lógica de vencimientos usa `Clock.now()` para poder probarla."""

from datetime import UTC, datetime
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime: ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


_system_clock = SystemClock()


def get_clock() -> Clock:
    return _system_clock
