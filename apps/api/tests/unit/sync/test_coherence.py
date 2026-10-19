"""Reglas de coherencia entre registros (FR-009a), con referencias simuladas."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import pytest

from app.modules.sync.core.batch import BatchContext
from app.modules.sync.core.entity import SyncEntity, SyncRecord
from app.modules.sync.core.reasons import RejectCode
from app.modules.sync.core.references import ResolvedRefs
from app.modules.sync.core.registry import ENTITY_BY_TABLE

NOW = datetime(2026, 10, 18, 14, 0, tzinfo=UTC)
CATEGORY = uuid.uuid4()
ACCOUNT = uuid.uuid4()
PARENT = uuid.uuid4()
SOURCE = uuid.uuid4()


def _refs(rows: dict[str, dict[uuid.UUID, Any]], **extra: Any) -> ResolvedRefs:
    refs = ResolvedRefs(BatchContext())
    for table, by_id in rows.items():
        refs._rows[table] = by_id
    refs.extra.update(extra)
    return refs


def _record(table: str, **fields: Any) -> SyncRecord:
    base = {"id": uuid.uuid4(), "created_at": NOW, "updated_at": NOW}
    return ENTITY_BY_TABLE[table].record_schema.model_validate(base | fields)


def _check(table: str, record: SyncRecord, refs: ResolvedRefs) -> RejectCode | None:
    entity: SyncEntity[Any] = ENTITY_BY_TABLE[table]
    rejection = entity.check_coherence(record, refs, refs.batch)
    return None if rejection is None else rejection.code


def _category(kind: str) -> ResolvedRefs:
    return _refs({"categories": {CATEGORY: SimpleNamespace(id=CATEGORY, kind=kind)}})


def _transaction(type_: str) -> SyncRecord:
    return _record(
        "transactions",
        account_id=ACCOUNT,
        type=type_,
        amount="10.00",
        category_id=CATEGORY,
        occurred_at=NOW,
    )


@pytest.mark.parametrize(
    ("type_", "kind", "expected"),
    [
        ("EXPENSE", "INCOME", RejectCode.INCOHERENT),
        ("INCOME", "EXPENSE", RejectCode.INCOHERENT),
        ("EXPENSE", "EXPENSE", None),
        ("INCOME", "INCOME", None),
    ],
)
def test_transaction_category_kind_matches_type(
    type_: str, kind: str, expected: RejectCode | None
) -> None:
    assert _check("transactions", _transaction(type_), _category(kind)) == expected


@pytest.mark.parametrize(
    ("kind", "expected"), [("INCOME", RejectCode.INCOHERENT), ("EXPENSE", None)]
)
def test_subscription_category_is_expense(kind: str, expected: RejectCode | None) -> None:
    record = _record(
        "subscriptions",
        account_id=ACCOUNT,
        category_id=CATEGORY,
        name="Netflix",
        amount="1.00",
        billing_day=5,
        start_date="2026-10-01",
    )
    assert _check("subscriptions", record, _category(kind)) == expected


@pytest.mark.parametrize(
    ("kind", "expected"), [("EXPENSE", RejectCode.INCOHERENT), ("INCOME", None)]
)
def test_recurring_income_category_is_income(kind: str, expected: RejectCode | None) -> None:
    record = _record(
        "recurring_incomes",
        account_id=ACCOUNT,
        category_id=CATEGORY,
        name="Salario",
        expected_amount="1.00",
        expected_day=30,
        start_date="2026-10-01",
    )
    assert _check("recurring_incomes", record, _category(kind)) == expected


def _account(**fields: Any) -> SyncRecord:
    return _record("accounts", name="Cajita", type="POCKET", nature="ASSET", **fields)


def test_account_parent_must_not_have_a_parent() -> None:
    nested_parent = SimpleNamespace(id=PARENT, parent_account_id=uuid.uuid4(), type="SAVINGS")
    refs = _refs({"accounts": {PARENT: nested_parent}}, has_children=set())
    assert _check("accounts", _account(parent_account_id=PARENT), refs) == RejectCode.INCOHERENT


def test_account_with_children_cannot_become_a_child() -> None:
    top_parent = SimpleNamespace(id=PARENT, parent_account_id=None, type="SAVINGS")
    record = _account(parent_account_id=PARENT)
    refs = _refs({"accounts": {PARENT: top_parent}}, has_children={record.id})
    assert _check("accounts", record, refs) == RejectCode.INCOHERENT


def test_valid_sub_account() -> None:
    top_parent = SimpleNamespace(id=PARENT, parent_account_id=None, type="SAVINGS")
    refs = _refs({"accounts": {PARENT: top_parent}}, has_children=set())
    assert _check("accounts", _account(parent_account_id=PARENT), refs) is None
    assert _check("accounts", _account(), refs) is None


def _cdt(**fields: Any) -> SyncRecord:
    values = {
        "account_id": ACCOUNT,
        "issuer": "Banco",
        "principal": "100.00",
        "annual_rate_ea": "10.0000",
        "annual_rate_nominal": "9.5000",
        "term_days": 90,
        "opened_on": "2026-10-01",
        "matures_on": "2026-12-30",
        "interest_payment": "AT_MATURITY",
        "source_account_id": SOURCE,
    }
    return _record("cdts", **(values | fields))


def _accounts(account_type: str) -> ResolvedRefs:
    return _refs(
        {
            "accounts": {
                ACCOUNT: SimpleNamespace(id=ACCOUNT, type=account_type),
                SOURCE: SimpleNamespace(id=SOURCE, type="SAVINGS"),
            }
        }
    )


def test_cdt_account_must_be_investment() -> None:
    assert _check("cdts", _cdt(), _accounts("SAVINGS")) == RejectCode.INCOHERENT
    assert _check("cdts", _cdt(), _accounts("INVESTMENT")) is None


def test_cdt_source_differs_from_its_account() -> None:
    record = _cdt(source_account_id=ACCOUNT)
    assert _check("cdts", record, _accounts("INVESTMENT")) == RejectCode.INCOHERENT
