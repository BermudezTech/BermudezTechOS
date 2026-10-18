"""Los cambios se confirman ANTES de enviar la respuesta.

Si el commit ocurriera después (scope "request" de FastAPI), un cliente rápido podría usar un token
recién revocado. Esta prueba usa sesiones reales (sin la transacción de rollback de las demás).
"""

from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from tests.factories import auth_headers, create_user, login


async def test_logout_commits_before_the_response_is_sent(
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

    events: list[str] = []
    event.listen(engine.sync_engine, "commit", lambda _: events.append("commit"))

    application = create_app()

    async def _session() -> AsyncIterator[AsyncSession]:
        async with sessionmaker() as session:
            yield session
            await session.commit()

    application.dependency_overrides[get_session] = _session

    async def recording_app(scope: Any, receive: Any, send: Any) -> None:
        async def _send(message: Any) -> None:
            if message["type"] == "http.response.start":
                events.append("response")
            await send(message)

        await application(scope, receive, _send)

    transport = ASGITransport(app=recording_app, raise_app_exceptions=False)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            tokens = await login(client)
            events.clear()
            response = await client.post(
                "/api/v1/auth/logout",
                json={"refreshToken": tokens["refreshToken"]},
                headers=auth_headers(tokens["accessToken"]),
            )
            assert response.status_code == 204
            assert "commit" in events
            assert events.index("commit") < events.index("response"), events
    finally:
        await engine.dispose()
