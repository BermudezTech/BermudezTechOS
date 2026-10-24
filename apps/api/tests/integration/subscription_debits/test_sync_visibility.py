"""Los cobros generados llegan a la app por el PULL normal (FR-016, SC-004)."""

import asyncio
import uuid
from datetime import date
from typing import Any

from app.core.clock import SystemClock
from app.modules.subscription_debits.service import SubscriptionDebitService
from app.modules.sync.core.sync_repository import SyncRepository
from app.modules.sync.schemas import PullRequest, PullResponse
from app.modules.sync.sync_service import SyncService
from tests.conftest import FakeClock
from tests.integration.subscription_debits.factories import (
    Sessions,
    make_account,
    make_subscription,
    make_user,
)

TODAY = date(2026, 10, 15)


async def _pull(sessions: Sessions, user_id: uuid.UUID, cursor: str | None) -> PullResponse:
    async with sessions() as session:
        service = SyncService(SyncRepository(session, user_id), SystemClock())
        request = PullRequest(cursors={"transactions": cursor})
        response = await service.pull(request)
        await session.commit()
        return response


def _records(response: PullResponse) -> list[dict[str, Any]]:
    return response.changes["transactions"].records


async def test_pull_delivers_generated_debit(sessions: Sessions, clock: FakeClock) -> None:
    user = await make_user(sessions)
    other = await make_user(sessions)
    account = await make_account(sessions, user)
    sub = await make_subscription(sessions, user, account, day=15, start_date=date(2026, 1, 1))
    before = await _pull(sessions, user, None)
    other_before = await _pull(sessions, other, None)

    await SubscriptionDebitService(sessions, clock, date(2026, 10, 1)).run_for_date(TODAY, "manual")

    after = await _pull(sessions, user, before.changes["transactions"].cursor)
    [record] = _records(after)
    assert record["subscriptionId"] == str(sub)
    assert record["amount"] == "44900.00"
    assert record["type"] == "EXPENSE"

    other_after = await _pull(sessions, other, other_before.changes["transactions"].cursor)
    assert _records(other_after) == []


async def test_run_waits_for_open_pull(sessions: Sessions, clock: FakeClock) -> None:
    """Un PULL en curso (lock compartido) hace esperar al cobro; el siguiente PULL lo recibe."""
    user = await make_user(sessions)
    account = await make_account(sessions, user)
    await make_subscription(sessions, user, account, day=15, start_date=date(2026, 1, 1))
    service = SubscriptionDebitService(sessions, clock, date(2026, 10, 1))

    async with sessions() as pull_session:
        pull_service = SyncService(SyncRepository(pull_session, user), SystemClock())
        open_pull = await pull_service.pull(PullRequest())  # toma el lock compartido
        run = asyncio.create_task(service.run_for_date(TODAY, "manual"))
        await asyncio.sleep(0.5)
        assert not run.done()
        assert _records(open_pull) == []
        await pull_session.commit()  # libera el lock

    summary = await asyncio.wait_for(run, timeout=10)
    assert summary.created == 1
    after = await _pull(sessions, user, open_pull.changes["transactions"].cursor)
    assert len(_records(after)) == 1
