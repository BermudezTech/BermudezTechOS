from datetime import timedelta

import jwt
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.auth import RefreshToken
from tests.conftest import FakeClock
from tests.factories import DEFAULT_PASSWORD, create_user, login


async def test_login_returns_token_pair(
    client: AsyncClient, db_session: AsyncSession, frozen_clock: FakeClock
) -> None:
    user = await create_user(db_session)
    body = await login(client)

    assert body["tokenType"] == "bearer"
    assert body["expiresIn"] == 900
    assert body["refreshExpiresIn"] == 604800
    claims = jwt.decode(body["accessToken"], options={"verify_signature": False})
    assert claims["typ"] == "access"
    assert claims["sub"] == str(user.id)

    token = (await db_session.scalars(select(RefreshToken))).one()
    assert token.user_id == user.id
    assert token.session_id is not None
    assert token.expires_at == frozen_clock.now() + timedelta(days=7)


async def test_login_normalizes_email(client: AsyncClient, db_session: AsyncSession) -> None:
    await create_user(db_session, email="a@test.dev")
    await login(client, email="  A@Test.DEV ")


async def test_invalid_credentials_are_indistinguishable(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session)
    wrong_password = await client.post(
        "/api/v1/auth/login", json={"email": "a@test.dev", "password": "incorrecta"}
    )
    unknown_email = await client.post(
        "/api/v1/auth/login", json={"email": "nadie@test.dev", "password": "incorrecta"}
    )
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.content == unknown_email.content
    assert wrong_password.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_password_longer_than_128_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login", json={"email": "a@test.dev", "password": "x" * 129}
    )
    assert response.status_code == 422


async def test_each_login_creates_an_independent_session(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session)
    await login(client, password=DEFAULT_PASSWORD)
    await login(client, password=DEFAULT_PASSWORD)
    sessions = {token.session_id for token in await db_session.scalars(select(RefreshToken))}
    assert len(sessions) == 2
