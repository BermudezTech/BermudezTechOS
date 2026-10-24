"""El fallo de una suscripción no impide procesar las demás (FR-015)."""

from datetime import date, datetime
from typing import Any

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.subscription_debits import repository
from app.modules.subscription_debits.repository import SubscriptionRow
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


async def test_one_failure_does_not_stop_others(
    sessions: Sessions, clock: FakeClock, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await make_user(sessions)
    account = await make_account(sessions, user)
    subs = sorted(
        [
            await make_subscription(sessions, user, account, day=15, start_date=date(2026, 1, 1))
            for _ in range(2)
        ]
    )
    failing = subs[0]
    original = repository.insert_debit

    async def flaky(
        session: AsyncSession, row: SubscriptionRow, period: str, due: date, now: datetime
    ) -> Any:
        if row.id == failing:
            # Error real de la base dentro del savepoint, no solo una excepción de Python.
            await session.execute(text("SELECT 1/0"))
        return await original(session, row, period, due, now)

    async def batch_fails(session: AsyncSession, pending: object, now: datetime) -> int:
        await session.execute(text("SELECT 1/0"))
        return 0

    # El lote falla y obliga a reintentar uno por uno; ahí solo falla `failing`.
    monkeypatch.setattr(repository, "insert_debits", batch_fails)
    monkeypatch.setattr(repository, "insert_debit", flaky)
    service = SubscriptionDebitService(sessions, clock, date(2026, 10, 1))

    summary = await service.run_for_date(TODAY, "manual")

    assert await debits(sessions, failing) == []
    assert len(await debits(sessions, subs[1])) == 1
    assert summary.failed == 1
    assert summary.failures[0][0] == failing

    monkeypatch.undo()
    retry = await service.run_for_date(TODAY, "manual")

    assert len(await debits(sessions, failing)) == 1
    assert (retry.created, retry.existing, retry.failed) == (1, 1, 0)
