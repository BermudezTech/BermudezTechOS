"""Las 8 tablas aceptan un registro completo y guardan cada campo (US1)."""

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.users import User
from app.modules.sync.core.registry import ENTITY_BY_TABLE
from tests.integration.sync.conftest import Records, category_id, push_ok, statuses


async def test_every_entity_round_trips_to_the_database(
    client: AsyncClient, token: str, records: Records, user: User, db_session: AsyncSession
) -> None:
    expense = await category_id(db_session, user, "Suscripciones")
    income = await category_id(db_session, user, "Salario")
    returns = await category_id(db_session, user, "Rendimientos")

    savings = records.account()
    card = records.account(
        type="CREDIT_CARD",
        nature="LIABILITY",
        name="Nu",
        openingBalance="0.00",
        creditLimit="8000000.00",
        statementDay=15,
        paymentDueDay=30,
        color="#7C3AED",
    )
    investment = records.account(type="INVESTMENT", name="CDT Bancolombia")
    group = records.reimbursement_group(payer="Empresa", notes="Legalizar")
    subscription = records.subscription(card["id"], categoryId=expense, icon="netflix")
    yearly = records.subscription(
        card["id"], name="Dominio", billingCycle="YEARLY", billingMonth=3, amount="60000.00"
    )
    salary = records.recurring_income(savings["id"], categoryId=income)
    cdt = records.cdt(investment["id"], savings["id"], certificateNumber="123-ABC")
    changes: dict[str, list[dict[str, Any]]] = {
        "categories": [records.category(name="Mascotas", icon="paw", color="#F00")],
        "reimbursement_groups": [group],
        "assets": [records.asset()],
        "accounts": [savings, card, investment],
        "subscriptions": [subscription, yearly],
        "recurring_incomes": [salary],
        "cdts": [cdt],
        "transactions": [
            records.transaction(
                card["id"],
                categoryId=expense,
                subscriptionId=subscription["id"],
                subscriptionPeriod="2026-10",
            ),
            records.transaction(
                savings["id"],
                type="INCOME",
                categoryId=income,
                recurringIncomeId=salary["id"],
                recurringIncomePeriod="2026-10",
                amount="5100000.00",
            ),
            records.transaction(
                savings["id"],
                type="TRANSFER",
                counterAccountId=card["id"],
                categoryId=None,
                amount="350000.00",
            ),
            records.transaction(
                investment["id"],
                type="INCOME",
                categoryId=returns,
                cdtId=cdt["id"],
                amount="85000.00",
            ),
            records.transaction(
                savings["id"], reimbursementGroupId=group["id"], categorySource="AI"
            ),
        ],
    }
    results = await push_ok(client, token, changes)
    assert set(statuses(results)) == {"APPLIED"}, results

    for table, sent in changes.items():
        entity = ENTITY_BY_TABLE[table]
        for record in sent:
            row = (
                await db_session.scalars(
                    select(entity.model).where(entity.model.id == uuid.UUID(record["id"]))
                )
            ).one()
            stored = entity.record_schema.model_validate(record)
            for name in entity.record_schema.model_fields:
                if name == "server_updated_at":
                    continue
                assert getattr(row, name) == getattr(stored, name), (table, name)

    row = (await db_session.scalars(select(ENTITY_BY_TABLE["cdts"].model))).one()
    assert row.annual_rate_ea == Decimal("10.2500")
    assert row.opened_on == date(2026, 10, 1)


def _by_id(results: list[Any]) -> dict[str, Any]:
    return {result["id"]: result for result in results}


async def test_existing_cdt_and_renewal_chain_share_the_account(
    client: AsyncClient, token: str, records: Records
) -> None:
    """Spec 009: CDT sin origen y renovación en la misma cuenta INVESTMENT."""
    investment = records.account(type="INVESTMENT", name="CDT existente")
    first = records.cdt(investment["id"], None, status="RENEWED")
    renewal = records.cdt(
        investment["id"],
        None,
        renewedFromCdtId=first["id"],
        openedOn="2027-03-30",
        maturesOn="2027-09-30",
    )
    results = await push_ok(client, token, {"accounts": [investment], "cdts": [first, renewal]})
    assert set(statuses(results)) == {"APPLIED"}

    # En otro lote: una segunda renovación de la misma cadena también se acepta.
    second = records.cdt(
        investment["id"],
        None,
        renewedFromCdtId=renewal["id"],
        openedOn="2027-09-30",
        maturesOn="2028-03-30",
    )
    assert statuses(await push_ok(client, token, {"cdts": [second]})) == ["APPLIED"]


async def test_renewal_in_another_account_is_incoherent(
    client: AsyncClient, token: str, records: Records
) -> None:
    first_account = records.account(type="INVESTMENT", name="CDT A")
    other_account = records.account(type="INVESTMENT", name="CDT B")
    first = records.cdt(first_account["id"], None)
    renewal = records.cdt(other_account["id"], None, renewedFromCdtId=first["id"])
    results = _by_id(
        await push_ok(
            client,
            token,
            {"accounts": [first_account, other_account], "cdts": [first, renewal]},
        )
    )
    assert results[first["id"]]["status"] == "APPLIED"
    assert results[renewal["id"]]["code"] == "INCOHERENT"


async def test_cdt_rejects_partial_settlement_and_low_override(
    client: AsyncClient, token: str, records: Records
) -> None:
    investment = records.account(type="INVESTMENT", name="CDT")
    partial = records.cdt(investment["id"], None, settledGrossInterest="10.00")
    low = records.cdt(investment["id"], None, maturityValueOverride="1.00")
    results = _by_id(
        await push_ok(client, token, {"accounts": [investment], "cdts": [partial, low]})
    )
    assert results[partial["id"]]["code"] == "VALIDATION_ERROR"
    assert results[low["id"]]["code"] == "VALIDATION_ERROR"
