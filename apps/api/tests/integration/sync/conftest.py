"""Fábricas de registros de sync (camelCase, válidos por defecto) y atajos para PUSH y PULL."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.categories import Category
from app.db.models.users import User
from tests.conftest import FakeClock
from tests.factories import auth_headers, login, register_user

PUSH = "/api/v1/sync/push"
PULL = "/api/v1/sync/pull"

Record = dict[str, Any]


def iso(moment: datetime) -> str:
    return moment.astimezone(UTC).isoformat().replace("+00:00", "Z")


class Records:
    """Construye registros válidos; `**overrides` reemplaza cualquier campo (camelCase)."""

    def __init__(self, clock: FakeClock) -> None:
        self._clock = clock

    def at(self, offset: timedelta = timedelta(0)) -> str:
        return iso(self._clock.now() + offset)

    def _build(self, fields: Record, overrides: dict[str, Any]) -> Record:
        now = self.at()
        base = {"id": str(uuid.uuid4()), "createdAt": now, "updatedAt": now, "deletedAt": None}
        return {**base, **fields, **overrides}

    def category(self, **overrides: Any) -> Record:
        fields = {"name": f"Cat {uuid.uuid4().hex[:8]}", "kind": "EXPENSE", "sortOrder": 0}
        return self._build(fields, overrides)

    def reimbursement_group(self, **overrides: Any) -> Record:
        fields = {"name": "Viaje Medellín", "kind": "REIMBURSEMENT", "status": "OPEN"}
        return self._build(fields, overrides)

    def asset(self, **overrides: Any) -> Record:
        fields = {"name": "Mazda 3 2020", "value": "65000000.00", "validUntil": "2027-01-31"}
        return self._build(fields, overrides)

    def account(self, **overrides: Any) -> Record:
        fields = {
            "parentAccountId": None,
            "name": "Bancolombia Ahorros",
            "type": "SAVINGS",
            "nature": "ASSET",
            "currency": "COP",
            "openingBalance": "1500000.00",
            "isExcludedFromNetWorth": False,
            "isArchived": False,
            "sortOrder": 0,
        }
        return self._build(fields, overrides)

    def subscription(self, account_id: str, **overrides: Any) -> Record:
        fields = {
            "accountId": account_id,
            "categoryId": None,
            "name": "Netflix",
            "amount": "38900.00",
            "billingCycle": "MONTHLY",
            "billingDay": 5,
            "startDate": "2026-10-01",
            "status": "ACTIVE",
        }
        return self._build(fields, overrides)

    def recurring_income(self, account_id: str, **overrides: Any) -> Record:
        fields = {
            "accountId": account_id,
            "categoryId": None,
            "name": "Salario",
            "expectedAmount": "5000000.00",
            "cycle": "MONTHLY",
            "expectedDay": 30,
            "startDate": "2026-10-01",
            "status": "ACTIVE",
        }
        return self._build(fields, overrides)

    def cdt(self, account_id: str, source_account_id: str, **overrides: Any) -> Record:
        fields = {
            "accountId": account_id,
            "issuer": "Bancolombia",
            "principal": "10000000.00",
            "annualRateEa": "10.2500",
            "annualRateNominal": "9.7800",
            "termDays": 180,
            "openedOn": "2026-10-01",
            "maturesOn": "2027-03-30",
            "interestPayment": "AT_MATURITY",
            "withholdingRate": "4.00",
            "sourceAccountId": source_account_id,
            "status": "ACTIVE",
        }
        return self._build(fields, overrides)

    def transaction(self, account_id: str, **overrides: Any) -> Record:
        fields = {
            "accountId": account_id,
            "counterAccountId": None,
            "type": "EXPENSE",
            "amount": "45000.00",
            "categoryId": None,
            "categorySource": "MANUAL",
            "occurredAt": self.at(),
            "description": "Almuerzo",
        }
        return self._build(fields, overrides)


@pytest.fixture
def records(frozen_clock: FakeClock) -> Records:
    return Records(frozen_clock)


@pytest.fixture
async def user(db_session: AsyncSession, frozen_clock: FakeClock) -> User:
    """Usuario registrado por la vía oficial: tiene sus 15 categorías iniciales."""
    return await register_user(db_session, frozen_clock, email="a@test.dev")


@pytest.fixture
async def token(client: AsyncClient, user: User) -> str:
    return str((await login(client, "a@test.dev"))["accessToken"])


@pytest.fixture
async def other_token(
    client: AsyncClient, db_session: AsyncSession, frozen_clock: FakeClock
) -> str:
    await register_user(db_session, frozen_clock, email="b@test.dev")
    return str((await login(client, "b@test.dev"))["accessToken"])


async def push(client: AsyncClient, token: str, changes: dict[str, list[Record]]) -> Response:
    return await client.post(PUSH, json={"changes": changes}, headers=auth_headers(token))


async def push_ok(
    client: AsyncClient, token: str, changes: dict[str, list[Record]]
) -> list[Record]:
    response = await push(client, token, changes)
    assert response.status_code == 200, response.text
    results: list[Record] = response.json()["results"]
    return results


async def pull(
    client: AsyncClient, token: str, cursors: dict[str, str | None] | None = None
) -> Record:
    body = {} if cursors is None else {"cursors": cursors}
    response = await client.post(PULL, json=body, headers=auth_headers(token))
    assert response.status_code == 200, response.text
    data: Record = response.json()
    return data


def statuses(results: list[Record]) -> list[str]:
    return [result["status"] for result in results]


async def category_id(session: AsyncSession, user: User, name: str) -> str:
    query = select(Category.id).where(Category.user_id == user.id, Category.name == name)
    return str((await session.scalars(query)).one())
