"""SC-003: un usuario nunca lee, modifica ni referencia datos de otro."""

import uuid
from collections.abc import Callable
from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base
from app.db.models.accounts import Account
from app.db.models.categories import Category
from app.db.models.subscriptions import Subscription
from app.db.models.transactions import Transaction
from app.db.models.users import User
from app.modules.categories.categories_repository import CategoriesRepository
from tests.conftest import FakeClock
from tests.factories import auth_headers, login, register_user


@pytest.fixture
async def users(db_session: AsyncSession, frozen_clock: FakeClock) -> tuple[User, User]:
    a = await register_user(db_session, frozen_clock, email="a@test.dev")
    b = await register_user(db_session, frozen_clock, email="b@test.dev")
    return a, b


def _account(user: User, clock: FakeClock, **values: object) -> Account:
    now = clock.now()
    return Account(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Cuenta",
        type="SAVINGS",
        nature="ASSET",
        created_at=now,
        updated_at=now,
        **values,
    )


async def _category_of(session: AsyncSession, user: User) -> Category:
    query = select(Category).where(Category.user_id == user.id).limit(1)
    return (await session.scalars(query)).one()


async def test_each_user_lists_only_their_categories(
    client: AsyncClient, db_session: AsyncSession, users: tuple[User, User]
) -> None:
    a, b = users
    for user in (a, b):
        tokens = await login(client, email=user.email)
        response = await client.get(
            "/api/v1/categories", headers=auth_headers(tokens["accessToken"])
        )
        ids = {uuid.UUID(item["id"]) for item in response.json()["items"]}
        owned = {
            category.id
            for category in await db_session.scalars(
                select(Category).where(Category.user_id == user.id)
            )
        }
        assert ids == owned
        assert len(ids) == 15


async def test_repository_never_returns_or_writes_other_users_rows(
    db_session: AsyncSession, frozen_clock: FakeClock, users: tuple[User, User]
) -> None:
    a, b = users
    repository = CategoriesRepository(db_session, a.id, frozen_clock)
    foreign = await _category_of(db_session, b)
    assert await repository.get(foreign.id) is None

    now = frozen_clock.now()
    smuggled = Category(
        id=uuid.uuid4(), user_id=b.id, name="Nueva", kind="EXPENSE", created_at=now, updated_at=now
    )
    await repository.add(smuggled)
    assert smuggled.user_id == a.id


async def _expect_integrity_error(session: AsyncSession, row: Base) -> None:
    savepoint = await session.begin_nested()
    session.add(row)
    with pytest.raises(IntegrityError):
        await session.flush()
    await savepoint.rollback()


@pytest.mark.parametrize("own_reference", [False, True], ids=["cross-user", "same-user"])
async def test_database_rejects_cross_user_references(
    db_session: AsyncSession,
    frozen_clock: FakeClock,
    users: tuple[User, User],
    own_reference: bool,
) -> None:
    a, b = users
    owner_of_references = a if own_reference else b
    target_account = _account(owner_of_references, frozen_clock)
    db_session.add(target_account)
    await db_session.flush()
    target_category = await _category_of(db_session, owner_of_references)
    now = frozen_clock.now()

    rows: list[Callable[[], Base]] = [
        lambda: _account(a, frozen_clock, parent_account_id=target_account.id),
        lambda: Transaction(
            id=uuid.uuid4(),
            user_id=a.id,
            account_id=target_account.id,
            type="EXPENSE",
            amount=Decimal("1000.00"),
            category_id=target_category.id,
            occurred_at=now,
            created_at=now,
            updated_at=now,
        ),
        lambda: Subscription(
            id=uuid.uuid4(),
            user_id=a.id,
            account_id=target_account.id,
            name="Netflix",
            amount=Decimal("38900.00"),
            billing_day=5,
            start_date=date(2026, 10, 1),
            created_at=now,
            updated_at=now,
        ),
    ]
    for build in rows:
        if own_reference:
            db_session.add(build())
            await db_session.flush()
        else:
            await _expect_integrity_error(db_session, build())
