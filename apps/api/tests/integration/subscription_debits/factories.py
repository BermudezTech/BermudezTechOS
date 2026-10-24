"""Atajos para preparar usuarios, cuentas, categorías y suscripciones con commit real."""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models.accounts import Account
from app.db.models.categories import Category
from app.db.models.subscriptions import Subscription
from app.db.models.transactions import Transaction
from app.db.models.users import User

Sessions = async_sessionmaker[AsyncSession]

STAMP = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)


def _sync_columns(deleted: bool) -> dict[str, Any]:
    return {"created_at": STAMP, "updated_at": STAMP, "deleted_at": STAMP if deleted else None}


async def _add(sessions: Sessions, row: Any) -> Any:
    async with sessions() as session:
        session.add(row)
        await session.commit()
        return row


async def make_user(sessions: Sessions, email: str | None = None) -> uuid.UUID:
    # Sin pasar por el registro oficial: el hash de contraseña no importa aquí.
    user = User(email=email or f"{uuid.uuid4().hex[:8]}@test.dev", password_hash="x")
    await _add(sessions, user)
    return user.id


async def make_account(
    sessions: Sessions, user_id: uuid.UUID, *, deleted: bool = False, archived: bool = False
) -> uuid.UUID:
    account = Account(
        id=uuid.uuid4(),
        user_id=user_id,
        name="Tarjeta",
        type="SAVINGS",
        nature="ASSET",
        is_archived=archived,
        **_sync_columns(deleted),
    )
    await _add(sessions, account)
    return account.id


async def make_category(
    sessions: Sessions, user_id: uuid.UUID, *, kind: str = "EXPENSE", deleted: bool = False
) -> uuid.UUID:
    category = Category(
        id=uuid.uuid4(),
        user_id=user_id,
        name=f"Cat {uuid.uuid4().hex[:6]}",
        kind=kind,
        **_sync_columns(deleted),
    )
    await _add(sessions, category)
    return category.id


async def make_subscription(
    sessions: Sessions,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    *,
    day: int,
    start_date: date,
    cycle: str = "MONTHLY",
    month: int | None = None,
    status: str = "ACTIVE",
    amount: Decimal = Decimal("44900.00"),
    category_id: uuid.UUID | None = None,
    name: str = "Netflix",
    deleted: bool = False,
) -> uuid.UUID:
    subscription = Subscription(
        id=uuid.uuid4(),
        user_id=user_id,
        account_id=account_id,
        category_id=category_id,
        name=name,
        amount=amount,
        billing_cycle=cycle,
        billing_day=day,
        billing_month=month,
        start_date=start_date,
        status=status,
        **_sync_columns(deleted),
    )
    await _add(sessions, subscription)
    return subscription.id


async def debits(sessions: Sessions, subscription_id: uuid.UUID) -> list[Transaction]:
    async with sessions() as session:
        result = await session.scalars(
            select(Transaction).where(Transaction.subscription_id == subscription_id)
        )
        return list(result)
