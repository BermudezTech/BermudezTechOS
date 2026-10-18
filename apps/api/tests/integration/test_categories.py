import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.categories import Category
from tests.conftest import FakeClock
from tests.factories import auth_headers, login, register_user

CATEGORIES = "/api/v1/categories"
KEYS = {
    "id",
    "name",
    "kind",
    "icon",
    "color",
    "sortOrder",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "serverUpdatedAt",
}


async def test_lists_own_categories_in_order(
    client: AsyncClient, db_session: AsyncSession, frozen_clock: FakeClock
) -> None:
    await register_user(db_session, frozen_clock)
    tokens = await login(client)

    response = await client.get(CATEGORIES, headers=auth_headers(tokens["accessToken"]))

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 15
    assert [item["kind"] for item in items] == ["EXPENSE"] * 12 + ["INCOME"] * 3
    assert [item["name"] for item in items[:2]] == ["Transporte", "Alimentación"]
    assert items[-1]["name"] == "Otros ingresos"
    for item in items:
        assert set(item) == KEYS
        assert item["deletedAt"] is None
        assert item["createdAt"].endswith("Z")


async def test_excludes_deleted_and_ignores_user_id_param(
    client: AsyncClient, db_session: AsyncSession, frozen_clock: FakeClock
) -> None:
    user = await register_user(db_session, frozen_clock)
    deleted = (
        await db_session.scalars(
            select(Category).where(Category.user_id == user.id, Category.name == "Ropa")
        )
    ).one()
    deleted.deleted_at = frozen_clock.now()
    await db_session.flush()
    tokens = await login(client)

    response = await client.get(
        CATEGORIES,
        params={"userId": str(uuid.uuid4())},
        headers=auth_headers(tokens["accessToken"]),
    )

    names = [item["name"] for item in response.json()["items"]]
    assert len(names) == 14
    assert "Ropa" not in names
