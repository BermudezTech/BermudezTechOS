"""Base aparte con commits reales: el servicio abre y confirma su propia transacción por usuario,
algo que el `db_session` compartido (con rollback) no permite."""

from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from tests.conftest import FakeClock


@pytest.fixture
async def sessions(
    fresh_database: str, migrate: Callable[[str], Awaitable[None]]
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    await migrate(fresh_database)
    engine = create_async_engine(fresh_database, poolclass=NullPool)
    yield async_sessionmaker(engine, expire_on_commit=False)
    await engine.dispose()


@pytest.fixture
def clock() -> FakeClock:
    """15 de octubre de 2026, 10:00 en Bogotá."""
    fake = FakeClock()
    fake.current = datetime(2026, 10, 15, 15, 0, tzinfo=UTC)
    return fake
