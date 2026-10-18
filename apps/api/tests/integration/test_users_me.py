from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import auth_headers, create_user, login


async def test_me_returns_profile(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await create_user(db_session, display_name="Juan")
    tokens = await login(client)

    response = await client.get("/api/v1/users/me", headers=auth_headers(tokens["accessToken"]))

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"id", "email", "displayName", "createdAt"}
    assert body["id"] == str(user.id)
    assert body["email"] == "a@test.dev"
    assert body["displayName"] == "Juan"
    assert body["createdAt"].endswith("Z")


async def test_me_requires_session(client: AsyncClient) -> None:
    response = await client.get("/api/v1/users/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"
