"""Lecturas de suscripciones candidatas e inserción idempotente del débito (data-model.md)."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import and_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timezone import local_midnight_utc
from app.db.models.accounts import Account
from app.db.models.categories import Category
from app.db.models.subscriptions import Subscription
from app.db.models.transactions import Transaction
from app.db.models.users import User
from app.modules.subscription_debits.debit_ids import debit_id
from app.modules.subscription_debits.periods import BillingCycle


@dataclass(frozen=True)
class SubscriptionRow:
    id: uuid.UUID
    user_id: uuid.UUID
    account_id: uuid.UUID
    name: str
    amount: Decimal
    billing_cycle: BillingCycle
    billing_day: int
    billing_month: int | None
    start_date: date
    # La cuenta existe y no está borrada. Archivada sí cuenta como disponible (FR-011).
    account_ok: bool
    # `category_id` si es de gasto y no está borrada; si no, None (FR-012).
    valid_category_id: uuid.UUID | None


_ACTIVE = and_(Subscription.status == "ACTIVE", Subscription.deleted_at.is_(None))


async def candidate_user_ids(session: AsyncSession) -> list[uuid.UUID]:
    query = (
        select(Subscription.user_id)
        .join(User, User.id == Subscription.user_id)
        .where(_ACTIVE)
        .distinct()
        .order_by(Subscription.user_id)
    )
    return list(await session.scalars(query))


async def candidate_subscriptions(
    session: AsyncSession, user_id: uuid.UUID
) -> list[SubscriptionRow]:
    account_ok = and_(Account.id.is_not(None), Account.deleted_at.is_(None))
    valid_category = and_(Category.kind == "EXPENSE", Category.deleted_at.is_(None))
    query = (
        select(
            Subscription.id,
            Subscription.user_id,
            Subscription.account_id,
            Subscription.name,
            Subscription.amount,
            Subscription.billing_cycle,
            Subscription.billing_day,
            Subscription.billing_month,
            Subscription.start_date,
            account_ok.label("account_ok"),
            Category.id.label("category_id"),
            valid_category.label("category_ok"),
        )
        .outerjoin(
            Account,
            and_(Account.user_id == Subscription.user_id, Account.id == Subscription.account_id),
        )
        .outerjoin(
            Category,
            and_(Category.user_id == Subscription.user_id, Category.id == Subscription.category_id),
        )
        .where(Subscription.user_id == user_id, _ACTIVE)
        .order_by(Subscription.id)
    )
    return [
        SubscriptionRow(
            id=row.id,
            user_id=row.user_id,
            account_id=row.account_id,
            name=row.name,
            amount=row.amount,
            billing_cycle=row.billing_cycle,
            billing_day=row.billing_day,
            billing_month=row.billing_month,
            start_date=row.start_date,
            account_ok=bool(row.account_ok),
            valid_category_id=row.category_id if row.category_ok else None,
        )
        for row in await session.execute(query)
    ]


@dataclass(frozen=True)
class PendingDebit:
    row: SubscriptionRow
    period: str
    billing_date: date


def _values(debit: PendingDebit, now: datetime) -> dict[str, object]:
    row = debit.row
    return {
        "id": debit_id(row.id, debit.period),
        "user_id": row.user_id,
        "account_id": row.account_id,
        "type": "EXPENSE",
        "amount": row.amount,
        "category_id": row.valid_category_id,
        "category_source": "MANUAL",
        "occurred_at": local_midnight_utc(debit.billing_date),
        "description": row.name,
        "subscription_id": row.id,
        "subscription_period": debit.period,
        "created_at": now,
        "updated_at": now,
    }


async def _insert(session: AsyncSession, debits: list[PendingDebit], now: datetime) -> int:
    statement = (
        insert(Transaction)
        .values([_values(debit, now) for debit in debits])
        # Sin objetivo: cubre la PK (mismo UUIDv5) y UNIQUE (subscription_id, subscription_period).
        .on_conflict_do_nothing()
        .returning(Transaction.id)
    )
    return len((await session.execute(statement)).all())


async def insert_debits(session: AsyncSession, debits: list[PendingDebit], now: datetime) -> int:
    """Inserta los débitos que falten; devuelve cuántos creó. Los que ya existían (también
    borrados o editados: FR-014) no se tocan."""
    return await _insert(session, debits, now)


async def insert_debit(
    session: AsyncSession,
    row: SubscriptionRow,
    period: str,
    billing_date: date,
    now: datetime,
) -> bool:
    """Un solo débito; False si ya existía."""
    return await _insert(session, [PendingDebit(row, period, billing_date)], now) == 1
