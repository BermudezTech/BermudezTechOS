"""Cobro del día (US1)."""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.users import User
from app.modules.subscription_debits import repository
from app.modules.subscription_debits.debit_ids import debit_id
from app.modules.subscription_debits.service import SubscriptionDebitService
from tests.conftest import FakeClock
from tests.integration.subscription_debits.factories import (
    Sessions,
    debits,
    make_account,
    make_category,
    make_subscription,
    make_user,
)

TODAY = date(2026, 10, 15)
ACTIVATION = date(2026, 10, 1)
START = date(2026, 1, 1)


def _service(sessions: Sessions, clock: FakeClock) -> SubscriptionDebitService:
    return SubscriptionDebitService(sessions, clock, ACTIVATION)


async def test_monthly_debit_is_created(sessions: Sessions, clock: FakeClock) -> None:
    user = await make_user(sessions)
    account = await make_account(sessions, user)
    category = await make_category(sessions, user)
    sub = await make_subscription(
        sessions, user, account, day=15, start_date=START, category_id=category
    )

    summary = await _service(sessions, clock).run_for_date(TODAY, "manual")

    [debit] = await debits(sessions, sub)
    assert debit.id == debit_id(sub, "2026-10")
    assert debit.user_id == user
    assert debit.account_id == account
    assert debit.counter_account_id is None
    assert debit.type == "EXPENSE"
    assert debit.amount == Decimal("44900.00")
    assert isinstance(debit.amount, Decimal)
    assert debit.category_id == category
    assert debit.category_source == "MANUAL"
    assert debit.description == "Netflix"
    assert debit.occurred_at == datetime(2026, 10, 15, 5, 0, tzinfo=UTC)
    assert debit.subscription_period == "2026-10"
    assert debit.deleted_at is None
    assert debit.created_at == debit.updated_at == clock.now()
    assert summary.created == 1


async def test_yearly_debit_only_in_its_month(sessions: Sessions, clock: FakeClock) -> None:
    user = await make_user(sessions)
    account = await make_account(sessions, user)
    october = await make_subscription(
        sessions, user, account, day=15, start_date=START, cycle="YEARLY", month=10
    )
    november = await make_subscription(
        sessions, user, account, day=15, start_date=START, cycle="YEARLY", month=11
    )

    await _service(sessions, clock).run_for_date(TODAY, "manual")

    [debit] = await debits(sessions, october)
    assert debit.subscription_period == "2026"
    assert await debits(sessions, november) == []


async def test_each_user_gets_own_debit(sessions: Sessions, clock: FakeClock) -> None:
    users = [await make_user(sessions) for _ in range(2)]
    accounts = [await make_account(sessions, user) for user in users]
    subs = [
        await make_subscription(sessions, user, account, day=15, start_date=START)
        for user, account in zip(users, accounts, strict=True)
    ]

    summary = await _service(sessions, clock).run_for_date(TODAY, "manual")

    for user, account, sub in zip(users, accounts, subs, strict=True):
        [debit] = await debits(sessions, sub)
        assert (debit.user_id, debit.account_id) == (user, account)
    assert summary.created == 2
    assert summary.users == 2


async def test_future_billing_day_is_not_charged(sessions: Sessions, clock: FakeClock) -> None:
    user = await make_user(sessions)
    account = await make_account(sessions, user)
    sub = await make_subscription(sessions, user, account, day=20, start_date=START)

    summary = await _service(sessions, clock).run_for_date(TODAY, "manual")

    assert await debits(sessions, sub) == []
    assert summary.not_due == 1


async def test_inactive_subscriptions_are_not_charged(sessions: Sessions, clock: FakeClock) -> None:
    user = await make_user(sessions)
    account = await make_account(sessions, user)
    subs = [
        await make_subscription(sessions, user, account, day=15, start_date=START, status="PAUSED"),
        await make_subscription(
            sessions, user, account, day=15, start_date=START, status="CANCELLED"
        ),
        await make_subscription(sessions, user, account, day=15, start_date=START, deleted=True),
        await make_subscription(sessions, user, account, day=15, start_date=date(2026, 10, 20)),
    ]

    summary = await _service(sessions, clock).run_for_date(TODAY, "manual")

    for sub in subs:
        assert await debits(sessions, sub) == []
    assert summary.created == 0
    assert summary.not_due == 1  # solo la de inicio futuro llega a evaluarse


async def test_deleted_account_is_skipped(sessions: Sessions, clock: FakeClock) -> None:
    user = await make_user(sessions)
    deleted = await make_account(sessions, user, deleted=True)
    archived = await make_account(sessions, user, archived=True)
    on_deleted = await make_subscription(sessions, user, deleted, day=15, start_date=START)
    on_archived = await make_subscription(sessions, user, archived, day=15, start_date=START)

    summary = await _service(sessions, clock).run_for_date(TODAY, "manual")

    assert await debits(sessions, on_deleted) == []
    assert len(await debits(sessions, on_archived)) == 1
    assert summary.skipped_account == 1


async def test_invalid_category_is_dropped(sessions: Sessions, clock: FakeClock) -> None:
    user = await make_user(sessions)
    account = await make_account(sessions, user)
    deleted = await make_category(sessions, user, deleted=True)
    income = await make_category(sessions, user, kind="INCOME")
    subs = [
        await make_subscription(
            sessions, user, account, day=15, start_date=START, category_id=deleted
        ),
        await make_subscription(
            sessions, user, account, day=15, start_date=START, category_id=income
        ),
        await make_subscription(sessions, user, account, day=15, start_date=START),
    ]

    await _service(sessions, clock).run_for_date(TODAY, "manual")

    for sub in subs:
        [debit] = await debits(sessions, sub)
        assert debit.category_id is None


async def test_overdue_in_period_keeps_billing_date(sessions: Sessions, clock: FakeClock) -> None:
    user = await make_user(sessions)
    account = await make_account(sessions, user)
    sub = await make_subscription(sessions, user, account, day=15, start_date=START)

    await _service(sessions, clock).run_for_date(date(2026, 10, 17), "manual")

    [debit] = await debits(sessions, sub)
    assert debit.occurred_at == datetime(2026, 10, 15, 5, 0, tzinfo=UTC)


async def test_before_activation_is_not_charged(sessions: Sessions, clock: FakeClock) -> None:
    user = await make_user(sessions)
    account = await make_account(sessions, user)
    sub = await make_subscription(sessions, user, account, day=15, start_date=START)
    service = SubscriptionDebitService(sessions, clock, date(2026, 10, 24))

    summary = await service.run_for_date(date(2026, 10, 24), "manual")

    assert await debits(sessions, sub) == []
    assert summary.not_due == 1


async def test_user_deleted_during_run(
    sessions: Sessions, clock: FakeClock, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await make_user(sessions)
    account = await make_account(sessions, user)
    sub = await make_subscription(sessions, user, account, day=15, start_date=START)
    original = repository.candidate_user_ids

    async def then_delete(session: AsyncSession) -> list[uuid.UUID]:
        ids = await original(session)
        async with sessions() as other:
            await other.execute(delete(User).where(User.id == user))
            await other.commit()
        return ids

    monkeypatch.setattr(repository, "candidate_user_ids", then_delete)

    summary = await _service(sessions, clock).run_for_date(TODAY, "manual")

    assert await debits(sessions, sub) == []
    assert summary.failed == 0
