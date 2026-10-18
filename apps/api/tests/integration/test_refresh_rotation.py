"""US3: renovación con rotación por sesión; reutilizar un token cierra solo esa sesión (SC-005)."""

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import timedelta

from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.security import sha256_hex
from app.db.models.auth import RefreshToken
from tests.conftest import FakeClock
from tests.factories import create_user, login

REFRESH = "/api/v1/auth/refresh"


async def _refresh(client: AsyncClient, token: str) -> tuple[int, dict]:  # type: ignore[type-arg]
    response = await client.post(REFRESH, json={"refreshToken": token})
    return response.status_code, response.json()


async def _row(session: AsyncSession, token: str) -> RefreshToken:
    query = select(RefreshToken).where(RefreshToken.token_hash == sha256_hex(token))
    return (await session.scalars(query)).one()


async def test_refresh_rotates_within_the_same_session(
    client: AsyncClient, db_session: AsyncSession, frozen_clock: FakeClock
) -> None:
    await create_user(db_session)
    first = await login(client)
    frozen_clock.advance(timedelta(hours=1))

    status, second = await _refresh(client, first["refreshToken"])

    assert status == 200
    assert second["refreshToken"] != first["refreshToken"]
    assert second["accessToken"] != first["accessToken"]
    old, new = (
        await _row(db_session, first["refreshToken"]),
        await _row(db_session, second["refreshToken"]),
    )
    assert old.revoked_at is not None
    assert old.replaced_by_id == new.id
    assert new.session_id == old.session_id
    assert new.expires_at == frozen_clock.now() + timedelta(days=7)


async def test_reuse_closes_only_that_session(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session)
    device_a = await login(client)
    device_b = await login(client)
    _, rotated_a = await _refresh(client, device_a["refreshToken"])

    status, body = await _refresh(client, device_a["refreshToken"])

    assert status == 401
    assert body["error"]["code"] == "INVALID_REFRESH_TOKEN"
    # El sucesor de A también quedó revocado.
    assert (await _refresh(client, rotated_a["refreshToken"]))[0] == 401
    # El dispositivo B sigue funcionando.
    assert (await _refresh(client, device_b["refreshToken"]))[0] == 200


async def test_expired_and_unknown_tokens_are_rejected(
    client: AsyncClient, db_session: AsyncSession, frozen_clock: FakeClock
) -> None:
    await create_user(db_session)
    tokens = await login(client)
    assert (await _refresh(client, "no-existe"))[0] == 401

    frozen_clock.advance(timedelta(days=7, seconds=1))
    assert (await _refresh(client, tokens["refreshToken"]))[0] == 401


async def test_concurrent_refreshes_only_one_succeeds(
    fresh_database: str, migrate: Callable[[str], Awaitable[None]]
) -> None:
    from app.core.database import get_session
    from app.main import create_app

    await migrate(fresh_database)
    engine = create_async_engine(fresh_database, poolclass=NullPool)
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
    async with sessionmaker() as session:
        await create_user(session)
        await session.commit()

    application = create_app()

    async def _session() -> AsyncIterator[AsyncSession]:
        async with sessionmaker() as session:
            try:
                yield session
                await session.commit()
            except BaseException:
                await session.rollback()
                raise

    application.dependency_overrides[get_session] = _session
    transport = ASGITransport(app=application, raise_app_exceptions=False)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            tokens = await login(client)
            results = await asyncio.gather(
                _refresh(client, tokens["refreshToken"]), _refresh(client, tokens["refreshToken"])
            )
            statuses = sorted(status for status, _ in results)
            assert statuses == [200, 401]
            # La reutilización cerró la sesión: el token ganador tampoco sirve.
            winner = next(body for status, body in results if status == 200)
            assert (await _refresh(client, winner["refreshToken"]))[0] == 401
    finally:
        await engine.dispose()
