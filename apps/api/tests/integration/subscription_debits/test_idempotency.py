"""Nunca se cobra dos veces el mismo periodo (US2, FR-013, FR-014, SC-002)."""

import asyncio
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import update

from app.db.models.transactions import Transaction
from app.modules.subscription_debits.service import SubscriptionDebitService
from tests.conftest import FakeClock
from tests.integration.subscription_debits.factories import (
    Sessions,
    debits,
    make_account,
    make_subscription,
    make_user,
)

TODAY = date(2026, 10, 15)
EDITED_AT = datetime(2026, 10, 15, 16, 0, tzinfo=UTC)


async def _setup(sessions: Sessions) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    user = await make_user(sessions)
    account = await make_account(sessions, user)
    sub = await make_subscription(sessions, user, account, day=15, start_date=date(2026, 1, 1))
    return user, account, sub


def _service(sessions: Sessions, clock: FakeClock) -> SubscriptionDebitService:
    return SubscriptionDebitService(sessions, clock, date(2026, 10, 1))


async def test_repeated_run_creates_once(sessions: Sessions, clock: FakeClock) -> None:
    _, _, sub = await _setup(sessions)
    service = _service(sessions, clock)

    first = await service.run_for_date(TODAY, "manual")
    second = await service.run_for_date(TODAY, "manual")

    assert len(await debits(sessions, sub)) == 1
    assert (first.created, first.existing) == (1, 0)
    assert (second.created, second.existing) == (0, 1)


async def test_parallel_runs_create_once(sessions: Sessions, clock: FakeClock) -> None:
    _, _, sub = await _setup(sessions)
    service = _service(sessions, clock)

    summaries = await asyncio.gather(*(service.run_for_date(TODAY, "manual") for _ in range(10)))

    assert len(await debits(sessions, sub)) == 1
    assert sum(s.created for s in summaries) == 1
    assert sum(s.existing for s in summaries) == 9


async def _edit(sessions: Sessions, sub: uuid.UUID, **values: object) -> None:
    async with sessions() as session:
        await session.execute(
            update(Transaction).where(Transaction.subscription_id == sub).values(**values)
        )
        await session.commit()


async def test_deleted_debit_is_not_recreated(sessions: Sessions, clock: FakeClock) -> None:
    _, _, sub = await _setup(sessions)
    service = _service(sessions, clock)
    await service.run_for_date(TODAY, "manual")
    await _edit(sessions, sub, deleted_at=EDITED_AT, updated_at=EDITED_AT)

    summary = await service.run_for_date(TODAY, "manual")

    [debit] = await debits(sessions, sub)
    assert debit.deleted_at == EDITED_AT
    assert debit.updated_at == EDITED_AT
    assert summary.existing == 1


async def test_edited_debit_is_kept(sessions: Sessions, clock: FakeClock) -> None:
    _, _, sub = await _setup(sessions)
    service = _service(sessions, clock)
    await service.run_for_date(TODAY, "manual")
    await _edit(sessions, sub, amount=Decimal("50000.00"), updated_at=EDITED_AT)

    await service.run_for_date(TODAY, "manual")

    [debit] = await debits(sessions, sub)
    assert debit.amount == Decimal("50000.00")


async def test_debit_with_other_id_for_same_period(sessions: Sessions, clock: FakeClock) -> None:
    user, account, sub = await _setup(sessions)
    async with sessions() as session:
        session.add(
            Transaction(
                id=uuid.uuid4(),
                user_id=user,
                account_id=account,
                type="EXPENSE",
                amount=Decimal("44900.00"),
                occurred_at=EDITED_AT,
                subscription_id=sub,
                subscription_period="2026-10",
                created_at=EDITED_AT,
                updated_at=EDITED_AT,
            )
        )
        await session.commit()

    summary = await _service(sessions, clock).run_for_date(TODAY, "manual")

    assert len(await debits(sessions, sub)) == 1
    assert summary.existing == 1
