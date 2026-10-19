"""Last-write-wins, idempotencia y borrado lógico en el PUSH (US1, FR-006, FR-012, FR-015)."""

import uuid
from datetime import timedelta
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.accounts import Account
from tests.integration.sync.conftest import Records, push_ok, statuses


async def _account(session: AsyncSession, record_id: str) -> Account:
    session.expire_all()
    return (await session.scalars(select(Account).where(Account.id == uuid.UUID(record_id)))).one()


async def test_new_record_is_applied(
    client: AsyncClient, token: str, records: Records, db_session: AsyncSession
) -> None:
    account = records.account()
    results = await push_ok(client, token, {"accounts": [account]})
    assert results == [{"table": "accounts", "id": account["id"], "status": "APPLIED"}]
    row = await _account(db_session, account["id"])
    assert row.opening_balance == Decimal("1500000.00")
    assert row.server_updated_at is not None


async def test_lww_compares_updated_at_strictly(
    client: AsyncClient, token: str, records: Records, db_session: AsyncSession
) -> None:
    account = records.account(name="Original")
    await push_ok(client, token, {"accounts": [account]})
    first = await _account(db_session, account["id"])
    first_mark = first.server_updated_at
    created_at = first.created_at

    newer = {
        **account,
        "name": "Nueva",
        "updatedAt": records.at(timedelta(minutes=5)),
        "createdAt": records.at(timedelta(days=-3)),
    }
    assert statuses(await push_ok(client, token, {"accounts": [newer]})) == ["APPLIED"]
    row = await _account(db_session, account["id"])
    assert row.name == "Nueva"
    assert row.server_updated_at > first_mark
    assert row.created_at == created_at  # created_at no se sobrescribe
    applied_mark = row.server_updated_at

    for stale in (newer | {"name": "Igual"}, account | {"name": "Vieja"}):
        assert statuses(await push_ok(client, token, {"accounts": [stale]})) == ["DISCARDED"]
        row = await _account(db_session, account["id"])
        assert row.name == "Nueva"
        assert row.server_updated_at == applied_mark  # descartado: no cambia la marca


async def test_soft_delete_and_restore(
    client: AsyncClient, token: str, records: Records, db_session: AsyncSession
) -> None:
    account = records.account()
    await push_ok(client, token, {"accounts": [account]})

    deleted_at = records.at(timedelta(minutes=1))
    deleted = account | {"deletedAt": deleted_at, "updatedAt": deleted_at}
    assert statuses(await push_ok(client, token, {"accounts": [deleted]})) == ["APPLIED"]
    assert (await _account(db_session, account["id"])).deleted_at is not None

    restored = account | {"deletedAt": None, "updatedAt": records.at(timedelta(minutes=2))}
    assert statuses(await push_ok(client, token, {"accounts": [restored]})) == ["APPLIED"]
    assert (await _account(db_session, account["id"])).deleted_at is None


async def test_resending_the_same_batch_is_idempotent(
    client: AsyncClient, token: str, records: Records, db_session: AsyncSession
) -> None:
    account = records.account()
    transaction = records.transaction(account["id"])
    batch = {"accounts": [account], "transactions": [transaction]}
    assert statuses(await push_ok(client, token, batch)) == ["APPLIED", "APPLIED"]

    for _ in range(5):
        assert statuses(await push_ok(client, token, batch)) == ["DISCARDED", "DISCARDED"]

    count = await db_session.scalar(select(func.count()).select_from(Account))
    assert count == 1
