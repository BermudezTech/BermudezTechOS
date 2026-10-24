"""Programación diaria propia, sin librería de cron (research R2 y R7).

Ejecuta al arrancar (recupera lo vencido del periodo actual si el contenedor estuvo caído) y luego
cada día a `BILLING_RUN_TIME` en hora de Bogotá. Cada 60 s actualiza el latido que lee el
healthcheck; el resultado de la última ejecución no influye en él (FR-018).
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from typing import Protocol

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.clock import Clock
from app.core.timezone import APP_TIME_ZONE, today_local
from app.modules.subscription_debits.service import RunSummary

logger = logging.getLogger("app.subscription_debits")

HEARTBEAT_PATH = Path("/tmp/billing-heartbeat")  # noqa: S108 (contenedor sin volúmenes)
HEARTBEAT_MAX_AGE = timedelta(seconds=180)
TICK_SECONDS = 60
# Reintentos de una ejecución fallida; después se espera a la siguiente hora programada.
RETRY_DELAYS = (60, 300, 900)
# Espera de la base al arrancar: 5, 10, 20, 40 y luego 60 s, hasta 10 minutos.
DB_WAIT_MAX = timedelta(minutes=10)

Sleep = Callable[[float], Awaitable[None]]
SchemaCheck = Callable[[], Awaitable[str | None]]


class DebitRunner(Protocol):
    async def run_for_date(self, d: date, trigger: str) -> RunSummary: ...


def next_run_at(now: datetime, run_time: time) -> datetime:
    """Siguiente `run_time` de Bogotá estrictamente posterior a `now`, en UTC."""
    local = now.astimezone(APP_TIME_ZONE)
    candidate = datetime.combine(local.date(), run_time, APP_TIME_ZONE)
    if candidate <= now:
        candidate = datetime.combine(local.date() + timedelta(days=1), run_time, APP_TIME_ZONE)
    return candidate.astimezone(UTC)


def is_heartbeat_fresh(path: Path, now: datetime, max_age: timedelta = HEARTBEAT_MAX_AGE) -> bool:
    try:
        modified = path.stat().st_mtime
    except FileNotFoundError:
        return False
    return now.timestamp() - modified < max_age.total_seconds()


async def wait_for_database(engine: AsyncEngine, sleep: Sleep = asyncio.sleep) -> None:
    """Reintenta con espera creciente; lanza la última excepción al agotar la ventana."""
    delay, waited, attempts = 5.0, 0.0, 0
    while True:
        attempts += 1
        try:
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
            return
        except Exception as error:
            if waited + delay > DB_WAIT_MAX.total_seconds():
                logger.error("No se pudo conectar a la base tras %s intentos", attempts)
                raise
            logger.warning(
                "Base no disponible (%s); reintento en %s s", type(error).__name__, int(delay)
            )
            await sleep(delay)
            waited += delay
            delay = min(delay * 2, 60.0)


class Scheduler:
    def __init__(
        self,
        service: DebitRunner,
        check_schema: SchemaCheck,
        clock: Clock,
        run_time: time,
        *,
        heartbeat: Path | None = None,
        sleep: Sleep = asyncio.sleep,
        activation_date: date | None = None,
    ) -> None:
        self._service = service
        self._check_schema = check_schema
        self._clock = clock
        self._run_time = run_time
        self._heartbeat = heartbeat or HEARTBEAT_PATH
        self._sleep = sleep
        self._activation_date = activation_date

    def beat(self) -> None:
        self._heartbeat.touch()

    async def _pause(self, seconds: float) -> None:
        """Espera en ticks para no dejar caducar el latido durante un reintento largo."""
        remaining = seconds
        while remaining > 0:
            step = min(TICK_SECONDS, remaining)
            await self._sleep(step)
            remaining -= step
            self.beat()

    async def run_once(self, trigger: str) -> RunSummary | None:
        d = today_local(self._clock)
        for attempt, delay in enumerate((*RETRY_DELAYS, None), start=1):
            try:
                error = await self._check_schema()
                if error:
                    logger.error("%s", error)
                    return None
                return await self._service.run_for_date(d, trigger)
            except Exception as failure:
                if delay is None:
                    logger.error(
                        "Ejecución de cobros fallida tras %s intentos: fecha=%s motivo=%s",
                        attempt,
                        d,
                        type(failure).__name__,
                    )
                    return None
                logger.warning(
                    "Ejecución de cobros fallida: fecha=%s motivo=%s; reintento en %s s",
                    d,
                    type(failure).__name__,
                    delay,
                )
                await self._pause(delay)
        return None

    async def serve(self, *, max_ticks: int | None = None) -> None:
        """Bucle del servicio. `max_ticks` solo existe para las pruebas."""
        self.beat()
        upcoming = next_run_at(self._clock.now(), self._run_time)
        logger.info(
            "Servicio de cobros iniciado: activación=%s, hora=%s %s, próxima=%s",
            self._activation_date,
            self._run_time.strftime("%H:%M"),
            APP_TIME_ZONE.key,
            upcoming.astimezone(APP_TIME_ZONE).isoformat(),
        )
        await self.run_once("startup")
        ticks = 0
        while max_ticks is None or ticks < max_ticks:
            self.beat()
            if self._clock.now() >= upcoming:
                await self.run_once("scheduled")
                upcoming = next_run_at(self._clock.now(), self._run_time)
            await self._sleep(TICK_SECONDS)
            ticks += 1
