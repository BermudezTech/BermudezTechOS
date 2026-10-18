import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.categories import Category
from app.db.models.users import User
from tests.conftest import FakeClock
from tests.factories import register_user


async def _categories_of(session: AsyncSession, user: User) -> list[Category]:
    result = await session.scalars(select(Category).where(Category.user_id == user.id))
    return list(result)


async def test_register_creates_user_with_default_categories(
    db_session: AsyncSession, frozen_clock: FakeClock
) -> None:
    user = await register_user(db_session, frozen_clock, email="  Nuevo@Test.DEV ")
    assert user.email == "nuevo@test.dev"
    categories = await _categories_of(db_session, user)
    assert len(categories) == 15
    assert {category.created_at for category in categories} == {frozen_clock.now()}


async def test_each_user_gets_its_own_categories(
    db_session: AsyncSession, frozen_clock: FakeClock
) -> None:
    first = await register_user(db_session, frozen_clock, email="uno@test.dev")
    first_ids = {category.id for category in await _categories_of(db_session, first)}
    second = await register_user(db_session, frozen_clock, email="dos@test.dev")
    second_ids = {category.id for category in await _categories_of(db_session, second)}
    assert len(second_ids) == 15
    assert first_ids.isdisjoint(second_ids)
    assert {c.id for c in await _categories_of(db_session, first)} == first_ids


async def test_registration_is_all_or_nothing(
    db_session: AsyncSession, frozen_clock: FakeClock, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.modules.users import user_registration_service

    def _fail(*_: object, **__: object) -> list[Category]:
        raise RuntimeError("fallo al crear categorías")

    monkeypatch.setattr(user_registration_service, "build_default_categories", _fail)
    with pytest.raises(RuntimeError):
        await register_user(db_session, frozen_clock, email="falla@test.dev")
    count = await db_session.scalar(
        select(func.count()).select_from(User).where(User.email == "falla@test.dev")
    )
    assert count == 0
