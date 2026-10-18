from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import auth_headers, create_user, login

LOGOUT = "/api/v1/auth/logout"
REFRESH = "/api/v1/auth/refresh"


async def _refresh_status(client: AsyncClient, token: str) -> int:
    return (await client.post(REFRESH, json={"refreshToken": token})).status_code


async def test_logout_closes_only_the_current_session(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session)
    session_a = await login(client)
    session_b = await login(client)
    headers = auth_headers(session_a["accessToken"])

    response = await client.post(
        LOGOUT, json={"refreshToken": session_a["refreshToken"]}, headers=headers
    )
    again = await client.post(
        LOGOUT, json={"refreshToken": session_a["refreshToken"]}, headers=headers
    )

    assert response.status_code == 204
    assert again.status_code == 204
    assert await _refresh_status(client, session_a["refreshToken"]) == 401
    assert await _refresh_status(client, session_b["refreshToken"]) == 200


async def test_logout_with_another_users_token_revokes_nothing(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session, email="a@test.dev")
    await create_user(db_session, email="b@test.dev")
    a = await login(client, email="a@test.dev")
    b = await login(client, email="b@test.dev")

    response = await client.post(
        LOGOUT, json={"refreshToken": b["refreshToken"]}, headers=auth_headers(a["accessToken"])
    )

    assert response.status_code == 204
    assert await _refresh_status(client, b["refreshToken"]) == 200


async def test_logout_requires_session(client: AsyncClient) -> None:
    response = await client.post(LOGOUT, json={"refreshToken": "x"})
    assert response.status_code == 401
