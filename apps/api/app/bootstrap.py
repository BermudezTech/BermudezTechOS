"""Arranque del contenedor: migraciones y seed, antes de levantar uvicorn.

Uso: `python -m app.bootstrap`. Devuelve un código de salida distinto de 0 ante cualquier error,
para que el contenedor no arranque.
"""

import asyncio
import logging
import os
import sys

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.clock import SystemClock
from app.core.config import ConfigError, Settings, load_settings
from app.core.logging import configure_logging
from app.modules.seed.seed_service import SeedConfigError, SeedService
from app.modules.users.user_registration_service import UserRegistrationService
from app.modules.users.users_repository import UsersRepository

logger = logging.getLogger("app.bootstrap")

# Lock de sesión de PostgreSQL: evita que dos instancias migren o creen el usuario a la vez.
BOOTSTRAP_LOCK_ID = 0x4254_4F53_0001

_ALEMBIC_INI = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")


def _upgrade(connection: Connection) -> None:
    config = Config(_ALEMBIC_INI)
    config.attributes["connection"] = connection
    config.attributes["configure_logger"] = False
    command.upgrade(config, "head")


async def run_bootstrap(settings: Settings) -> int:
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    try:
        async with engine.connect() as lock_connection:
            await lock_connection.execute(
                text("SELECT pg_advisory_lock(:id)"), {"id": BOOTSTRAP_LOCK_ID}
            )
            await lock_connection.commit()
            try:
                try:
                    await lock_connection.run_sync(_upgrade)
                    await lock_connection.commit()
                except Exception:
                    logger.exception("Error aplicando las migraciones")
                    return 1
                logger.info("Migraciones aplicadas")

                async with AsyncSession(engine, expire_on_commit=False) as session:
                    users = UsersRepository(session)
                    registration = UserRegistrationService(session, users, SystemClock())
                    try:
                        await SeedService(users, registration, settings).run()
                        await session.commit()
                    except SeedConfigError as error:
                        await session.rollback()
                        logger.error("Seed abortada: %s", error)
                        return 1
            finally:
                await lock_connection.execute(
                    text("SELECT pg_advisory_unlock(:id)"), {"id": BOOTSTRAP_LOCK_ID}
                )
                await lock_connection.commit()
    finally:
        await engine.dispose()
    return 0


def main() -> int:
    try:
        settings = load_settings()
    except ConfigError as error:
        configure_logging()
        logger.error("%s", error)
        return 1
    configure_logging(settings.log_level)
    return asyncio.run(run_bootstrap(settings))


if __name__ == "__main__":
    sys.exit(main())
