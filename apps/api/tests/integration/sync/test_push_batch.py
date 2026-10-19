"""Resultado por registro, dependencias del lote, límites y validación (US1, FR-008–FR-014)."""

import uuid
from datetime import timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.accounts import Account
from app.db.models.users import User
from app.modules.sync.core import config
from tests.integration.sync.conftest import Records, category_id, push, push_ok, statuses


def _by_id(results: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {result["id"]: result for result in results}


async def test_dependencies_are_applied_in_order_regardless_of_input_order(
    client: AsyncClient, token: str, records: Records
) -> None:
    parent = records.account()
    child = records.account(parentAccountId=parent["id"], type="POCKET", name="Cajita")
    transaction = records.transaction(child["id"])
    # Transacciones antes que cuentas y la subcuenta antes que su padre.
    results = await push_ok(
        client, token, {"transactions": [transaction], "accounts": [child, parent]}
    )
    assert statuses(results) == ["APPLIED"] * 3
    # Respuesta en el orden de la petición.
    assert [r["id"] for r in results] == [transaction["id"], child["id"], parent["id"]]


async def test_invalid_record_does_not_block_the_rest(
    client: AsyncClient, token: str, records: Records
) -> None:
    account = records.account()
    good = records.transaction(account["id"])
    bad = records.transaction(account["id"], amount="0.00")
    results = _by_id(
        await push_ok(client, token, {"accounts": [account], "transactions": [good, bad]})
    )
    assert results[good["id"]]["status"] == "APPLIED"
    assert results[bad["id"]]["status"] == "REJECTED"
    assert results[bad["id"]]["code"] == "VALIDATION_ERROR"
    assert results[bad["id"]]["details"][0]["field"] == "amount"


async def test_missing_reference_and_cascading_rejection(
    client: AsyncClient, token: str, records: Records
) -> None:
    orphan = records.account(parentAccountId=str(uuid.uuid4()))
    depends_on_orphan = records.transaction(orphan["id"])
    missing_account = records.transaction(str(uuid.uuid4()))
    results = _by_id(
        await push_ok(
            client,
            token,
            {"accounts": [orphan], "transactions": [depends_on_orphan, missing_account]},
        )
    )
    assert results[orphan["id"]]["code"] == "INVALID_REFERENCE"
    assert results[depends_on_orphan["id"]]["code"] == "DEPENDENCY_REJECTED"
    assert results[missing_account["id"]]["code"] == "INVALID_REFERENCE"


async def test_reference_cycle_is_rejected(
    client: AsyncClient, token: str, records: Records
) -> None:
    a, b = records.account(), records.account()
    a["parentAccountId"], b["parentAccountId"] = b["id"], a["id"]
    results = await push_ok(client, token, {"accounts": [a, b]})
    assert [r["code"] for r in results] == ["INVALID_REFERENCE", "INVALID_REFERENCE"]


async def test_duplicates_are_rejected(client: AsyncClient, token: str, records: Records) -> None:
    category = records.category(name="Transporte", kind="EXPENSE")  # ya existe en la seed
    account = records.account()
    subscription = records.subscription(account["id"])
    first = records.transaction(
        account["id"], subscriptionId=subscription["id"], subscriptionPeriod="2026-10"
    )
    second = records.transaction(
        account["id"], subscriptionId=subscription["id"], subscriptionPeriod="2026-10"
    )
    results = _by_id(
        await push_ok(
            client,
            token,
            {
                "categories": [category],
                "accounts": [account],
                "subscriptions": [subscription],
                "transactions": [first, second],
            },
        )
    )
    assert results[category["id"]]["code"] == "DUPLICATE"
    assert results[first["id"]]["status"] == "APPLIED"
    assert results[second["id"]]["code"] == "DUPLICATE"


async def test_deleted_category_does_not_block_its_name(
    client: AsyncClient, token: str, records: Records
) -> None:
    category = records.category(name="Mascotas")
    await push_ok(client, token, {"categories": [category]})
    gone = category | {"deletedAt": records.at(timedelta(seconds=1))}
    gone["updatedAt"] = gone["deletedAt"]
    await push_ok(client, token, {"categories": [gone]})
    again = records.category(name="Mascotas")
    assert statuses(await push_ok(client, token, {"categories": [again]})) == ["APPLIED"]


@pytest.mark.parametrize(("hours", "status"), [(25, "REJECTED"), (23, "APPLIED")])
async def test_clock_ahead_limit(
    client: AsyncClient, token: str, records: Records, hours: int, status: str
) -> None:
    account = records.account(updatedAt=records.at(timedelta(hours=hours)))
    [result] = await push_ok(client, token, {"accounts": [account]})
    assert result["status"] == status
    if status == "REJECTED":
        assert result["code"] == "CLOCK_AHEAD"


@pytest.mark.parametrize(
    "overrides",
    [
        {"amount": 45000.5},  # número JSON: puede venir con error de float
        {"amount": "45000.555"},
        {"type": "TRANSFER"},  # sin cuenta destino
        {"occurredAt": "2026-10-18T13:45:00"},  # sin zona horaria
    ],
)
async def test_single_record_validation(
    client: AsyncClient, token: str, records: Records, overrides: dict[str, Any]
) -> None:
    account = records.account()
    transaction = records.transaction(account["id"], **overrides)
    results = _by_id(
        await push_ok(client, token, {"accounts": [account], "transactions": [transaction]})
    )
    assert results[transaction["id"]]["code"] == "VALIDATION_ERROR"


async def test_record_without_valid_id(client: AsyncClient, token: str, records: Records) -> None:
    [result] = await push_ok(client, token, {"accounts": [records.account(id="no-es-uuid")]})
    assert result["id"] is None
    assert result["code"] == "VALIDATION_ERROR"


async def test_server_only_fields_are_ignored(
    client: AsyncClient, token: str, records: Records, user: User, db_session: AsyncSession
) -> None:
    account = records.account(
        userId=str(uuid.uuid4()), serverUpdatedAt="2000-01-01T00:00:00Z", isDirty=1
    )
    assert statuses(await push_ok(client, token, {"accounts": [account]})) == ["APPLIED"]
    row = (await db_session.scalars(select(Account))).one()
    assert row.user_id == user.id
    assert row.server_updated_at.year > 2000


async def test_too_many_records_rejects_the_whole_batch(
    client: AsyncClient,
    token: str,
    records: Records,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(config, "MAX_PUSH_RECORDS", 3)
    response = await push(client, token, {"accounts": [records.account() for _ in range(4)]})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PUSH_TOO_LARGE"
    assert await db_session.scalar(select(func.count()).select_from(Account)) == 0


async def test_default_limit_is_500(client: AsyncClient, token: str, records: Records) -> None:
    response = await push(client, token, {"accounts": [records.account() for _ in range(501)]})
    assert response.status_code == 413


async def test_unknown_table_is_a_request_error(client: AsyncClient, token: str) -> None:
    response = await push(client, token, {"users": [{}]})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_income_category_on_expense_is_incoherent(
    client: AsyncClient, token: str, records: Records, user: User, db_session: AsyncSession
) -> None:
    account = records.account()
    salary = await category_id(db_session, user, "Salario")
    expense = records.transaction(account["id"], categoryId=salary)
    results = _by_id(
        await push_ok(client, token, {"accounts": [account], "transactions": [expense]})
    )
    assert results[expense["id"]]["code"] == "INCOHERENT"
