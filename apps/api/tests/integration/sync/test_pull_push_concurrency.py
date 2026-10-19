"""Ningún cambio confirmado queda detrás de un cursor entregado (FR-019, SC-004).

Usa una base aparte y dos conexiones reales con commits de verdad: el `db_session` compartido de
las demás pruebas no puede reproducir la concurrencia.
"""

import asyncio
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.clock import SystemClock
from app.db.models.accounts import Account
from app.modules.sync.core.sync_repository import SyncRepository
from app.modules.sync.entities.accounts.schemas import AccountRecord
from app.modules.sync.schemas import PullRequest, PullResponse
from app.modules.sync.sync_service import SyncService
from tests.factories import register_user

Sessions = async_sessionmaker[AsyncSession]


@pytest.fixture
async def sessions(
    fresh_database: str, migrate: Callable[[str], Awaitable[None]]
) -> AsyncIterator[Sessions]:
    await migrate(fresh_database)
    engine = create_async_engine(fresh_database, poolclass=NullPool)
    yield async_sessionmaker(engine, expire_on_commit=False)
    await engine.dispose()


@pytest.fixture
async def user_id(sessions: Sessions) -> uuid.UUID:
    async with sessions() as session:
        user = await register_user(session, SystemClock(), email="c@test.dev")
        await session.commit()
        return user.id


def _account_values() -> dict[str, Any]:
    now = datetime.now(UTC)
    record = AccountRecord.model_validate(
        {
            "id": uuid.uuid4(),
            "createdAt": now,
            "updatedAt": now,
            "name": "Concurrente",
            "type": "CASH",
            "nature": "ASSET",
        }
    )
    return record.model_dump(exclude={"server_updated_at"}, by_alias=False)


async def _pull(
    sessions: Sessions, user_id: uuid.UUID, cursors: dict[str, str | None] | None = None
) -> PullResponse:
    async with sessions() as session:
        service = SyncService(SyncRepository(session, user_id), SystemClock())
        response = await service.pull(PullRequest(cursors=cursors or {}))  # type: ignore[arg-type]
        await session.commit()
        return response


def _account_ids(response: PullResponse) -> set[str]:
    return {record["id"] for record in response.changes["accounts"].records}


async def test_pull_waits_for_an_uncommitted_push(sessions: Sessions, user_id: uuid.UUID) -> None:
    values = _account_values()
    async with sessions() as push_session:
        repository = SyncRepository(push_session, user_id)
        await repository.lock(shared=False)
        assert await repository.upsert_lww(Account, values)

        pending_pull = asyncio.create_task(_pull(sessions, user_id))
        await asyncio.sleep(0.3)
        assert not pending_pull.done(), "el PULL no debe leer mientras el PUSH no confirma"

        await push_session.commit()

    response = await asyncio.wait_for(pending_pull, timeout=10)
    assert str(values["id"]) in _account_ids(response)


async def test_push_after_a_pull_appears_after_its_cursor(
    sessions: Sessions, user_id: uuid.UUID
) -> None:
    first = await _pull(sessions, user_id)
    cursors = {table: page.cursor for table, page in first.changes.items()}

    values = _account_values()
    async with sessions() as push_session:
        repository = SyncRepository(push_session, user_id)
        await repository.lock(shared=False)
        assert await repository.upsert_lww(Account, values)
        await push_session.commit()

    second = await _pull(sessions, user_id, cursors)  # type: ignore[arg-type]
    assert _account_ids(second) == {str(values["id"])}
