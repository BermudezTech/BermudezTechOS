"""Una ejecución con 10.000 suscripciones activas termina en menos de 1 minuto (SC-005)."""

import time
import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import func, insert, select

from app.db.models.subscriptions import Subscription
from app.db.models.transactions import Transaction
from app.modules.subscription_debits.service import SubscriptionDebitService
from tests.conftest import FakeClock
from tests.integration.subscription_debits.factories import (
    STAMP,
    Sessions,
    make_account,
    make_user,
)

USERS = 10
PER_USER = 1000  # > BATCH_SIZE: ejercita los bloques


@pytest.mark.slow
async def test_ten_thousand_subscriptions(sessions: Sessions, clock: FakeClock) -> None:
    for _ in range(USERS):
        user = await make_user(sessions)
        account = await make_account(sessions, user)
        rows = [
            {
                "id": uuid.uuid4(),
                "user_id": user,
                "account_id": account,
                "name": "Plan",
                "amount": Decimal("9900.00"),
                "billing_cycle": "MONTHLY",
                "billing_day": 15,
                "start_date": date(2026, 1, 1),
                "status": "ACTIVE",
                "created_at": STAMP,
                "updated_at": STAMP,
            }
            for _ in range(PER_USER)
        ]
        async with sessions() as session:
            await session.execute(insert(Subscription), rows)
            await session.commit()

    service = SubscriptionDebitService(sessions, clock, date(2026, 10, 1))
    started = time.monotonic()
    summary = await service.run_for_date(date(2026, 10, 15), "manual")
    elapsed = time.monotonic() - started

    assert summary.created == USERS * PER_USER
    async with sessions() as session:
        assert await session.scalar(select(func.count()).select_from(Transaction)) == 10_000
    assert elapsed < 60, f"tardó {elapsed:.1f} s"
