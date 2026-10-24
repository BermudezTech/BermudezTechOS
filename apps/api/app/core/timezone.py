"""Zona horaria única del MVP (spec 007, FR-023).

Todo cálculo que dependa del día, mes, año u hora local pasa por aquí. Nunca `date.today()` ni
`datetime.now()` sin zona: el resultado no puede depender de la zona del servidor (FR-024).
"""

from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo

from app.core.clock import Clock

# Base IANA, no un desfase fijo de −5 h (FR-029).
APP_TIME_ZONE = ZoneInfo("America/Bogota")


def today_local(clock: Clock) -> date:
    return clock.now().astimezone(APP_TIME_ZONE).date()


def local_midnight_utc(day: date) -> datetime:
    """Instante UTC de las 00:00 de `day` en Bogotá."""
    return datetime.combine(day, time(0), APP_TIME_ZONE).astimezone(UTC)
