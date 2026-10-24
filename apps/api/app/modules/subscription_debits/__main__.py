"""Servicio de cobros (contracts/billing-service.md).

Uso: `python -m app.modules.subscription_debits serve | run [--date YYYY-MM-DD] | health`.

Códigos de salida: 0 éxito; 1 configuración, base o esquema; 2 argumentos inválidos.
"""

import argparse
import asyncio
import logging
import sys
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfoNotFoundError

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.clock import SystemClock
from app.core.config import ConfigError
from app.core.logging import configure_logging
from app.core.timezone import today_local
from app.modules.subscription_debits import scheduler
from app.modules.subscription_debits.config import BillingSettings, load_billing_settings
from app.modules.subscription_debits.schema_check import check_schema
from app.modules.subscription_debits.service import SubscriptionDebitService

logger = logging.getLogger("app.subscription_debits")


class _ArgumentError(Exception):
    pass


class _Parser(argparse.ArgumentParser):
    def error(self, message: str) -> None:  # type: ignore[override]
        raise _ArgumentError(message)


def _iso_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"fecha inválida: {value} (formato YYYY-MM-DD)") from None


def _parser() -> argparse.ArgumentParser:
    parser = _Parser(prog="python -m app.modules.subscription_debits")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("serve", help="Ejecuta al arrancar y luego cada día.")
    run = commands.add_parser("run", help="Una ejecución para una fecha (por defecto, hoy).")
    run.add_argument("--date", type=_iso_date, default=None)
    commands.add_parser("health", help="0 si el latido es reciente.")
    return parser


def _schema_check(sessions: async_sessionmaker[AsyncSession]) -> scheduler.SchemaCheck:
    async def check() -> str | None:
        async with sessions() as session:
            return await check_schema(session)

    return check


async def _run(engine: AsyncEngine, settings: BillingSettings, d: date) -> int:
    await scheduler.wait_for_database(engine)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    error = await _schema_check(sessions)()
    if error:
        logger.error("%s", error)
        return 1
    service = SubscriptionDebitService(sessions, SystemClock(), settings.billing_activation_date)
    await service.run_for_date(d, "manual")
    return 0


async def _serve(engine: AsyncEngine, settings: BillingSettings) -> int:
    await scheduler.wait_for_database(engine)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    clock = SystemClock()
    service = SubscriptionDebitService(sessions, clock, settings.billing_activation_date)
    await scheduler.Scheduler(
        service,
        _schema_check(sessions),
        clock,
        settings.billing_run_time,
        activation_date=settings.billing_activation_date,
    ).serve()
    return 0


def _health() -> int:
    return 0 if scheduler.is_heartbeat_fresh(scheduler.HEARTBEAT_PATH, datetime.now(UTC)) else 1


async def async_main(argv: list[str]) -> int:
    try:
        args = _parser().parse_args(argv)
    except _ArgumentError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    if args.command == "health":
        return _health()

    try:
        settings = load_billing_settings()
    except ConfigError as error:
        configure_logging()
        logger.error("%s", error)
        return 1
    configure_logging(settings.log_level)

    try:
        today = today_local(SystemClock())
    except ZoneInfoNotFoundError:
        logger.error("Zona horaria America/Bogota no disponible en el sistema")
        return 1
    if args.command == "run" and args.date is not None and args.date > today:
        print(f"error: --date {args.date} es posterior a hoy ({today}) en Bogotá", file=sys.stderr)
        return 2

    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    try:
        if args.command == "serve":
            return await _serve(engine, settings)
        return await _run(engine, settings, args.date or today)
    except Exception as error:
        logger.error("Error del servicio de cobros: %s", type(error).__name__)
        return 1
    finally:
        await engine.dispose()


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if args[:1] == ["health"]:
        # Sin bucle de eventos ni configuración: lo ejecuta el healthcheck cada minuto.
        return _health()
    return asyncio.run(async_main(args))


if __name__ == "__main__":
    sys.exit(main())
