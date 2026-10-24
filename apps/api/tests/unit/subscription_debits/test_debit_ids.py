from uuid import NAMESPACE_URL, UUID, uuid5

from app.modules.subscription_debits.debit_ids import NAMESPACE, debit_id

SUBSCRIPTION = UUID("7f1c2a9e-0000-4000-8000-000000000001")


def test_namespace_is_fixed() -> None:
    assert NAMESPACE == UUID("9d1e0cb1-0ae7-5d67-856e-c19860851ef1")
    assert uuid5(NAMESPACE_URL, "https://bermudeztech.os/subscription-debit") == NAMESPACE


def test_shared_vector() -> None:
    # Vector compartido con la app (research R4): no cambiar.
    assert debit_id(SUBSCRIPTION, "2026-10") == UUID("e4bc34e4-a6ae-5090-9861-6968494a9467")


def test_deterministic_per_period() -> None:
    assert debit_id(SUBSCRIPTION, "2026-10") == debit_id(SUBSCRIPTION, "2026-10")
    assert debit_id(SUBSCRIPTION, "2026-10") != debit_id(SUBSCRIPTION, "2026-11")
    assert debit_id(SUBSCRIPTION, "2026") != debit_id(SUBSCRIPTION, "2026-10")
