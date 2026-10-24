import re
from datetime import date

import pytest

from app.modules.subscription_debits.periods import billing_date, current_period, is_due

PERIOD_FORMAT = re.compile(r"^\d{4}(-(0[1-9]|1[0-2]))?$")  # CHECK subscription_period_format


def test_monthly_period_and_billing_date() -> None:
    d = date(2026, 10, 24)
    assert current_period("MONTHLY", d) == "2026-10"
    assert billing_date("MONTHLY", 15, None, d) == date(2026, 10, 15)


@pytest.mark.parametrize(
    ("d", "expected"),
    [
        (date(2026, 11, 3), date(2026, 11, 30)),
        (date(2027, 2, 10), date(2027, 2, 28)),
        (date(2028, 2, 10), date(2028, 2, 29)),
        (date(2026, 12, 1), date(2026, 12, 31)),
    ],
)
def test_monthly_day_31_uses_last_day(d: date, expected: date) -> None:
    assert billing_date("MONTHLY", 31, None, d) == expected


def test_yearly_period_and_billing_date() -> None:
    d = date(2026, 10, 24)
    assert current_period("YEARLY", d) == "2026"
    assert billing_date("YEARLY", 10, 3, d) == date(2026, 3, 10)


def test_yearly_feb_29() -> None:
    assert billing_date("YEARLY", 29, 2, date(2027, 6, 1)) == date(2027, 2, 28)
    assert billing_date("YEARLY", 29, 2, date(2028, 6, 1)) == date(2028, 2, 29)


def test_yearly_without_month_is_invalid() -> None:
    with pytest.raises(ValueError):
        billing_date("YEARLY", 10, None, date(2026, 10, 24))


@pytest.mark.parametrize("cycle", ["MONTHLY", "YEARLY"])
@pytest.mark.parametrize("d", [date(2026, 1, 1), date(2026, 9, 30), date(999, 12, 31)])
def test_period_matches_check_format(cycle: str, d: date) -> None:
    assert PERIOD_FORMAT.match(current_period(cycle, d))  # type: ignore[arg-type]


ACTIVATION = date(2026, 10, 1)


@pytest.mark.parametrize(
    ("due", "start", "activation", "d", "expected"),
    [
        # Hoy y vencido dentro del periodo actual (FR-007).
        (date(2026, 10, 15), date(2026, 1, 1), ACTIVATION, date(2026, 10, 15), True),
        (date(2026, 10, 15), date(2026, 1, 1), ACTIVATION, date(2026, 10, 17), True),
        # Aún no llega.
        (date(2026, 10, 20), date(2026, 1, 1), ACTIVATION, date(2026, 10, 15), False),
        # Creada el 20 con día 15: la fecha de cobro es anterior al inicio (FR-006).
        (date(2026, 10, 15), date(2026, 10, 20), ACTIVATION, date(2026, 10, 24), False),
        (date(2026, 10, 20), date(2026, 10, 20), ACTIVATION, date(2026, 10, 24), True),
        # Activación el 24: el día 15 no se cobra, el 28 sí (FR-007a).
        (date(2026, 10, 15), date(2026, 1, 1), date(2026, 10, 24), date(2026, 10, 24), False),
        (date(2026, 10, 28), date(2026, 1, 1), date(2026, 10, 24), date(2026, 10, 28), True),
    ],
)
def test_is_due(due: date, start: date, activation: date, d: date, expected: bool) -> None:
    assert is_due(due, start, activation, d) is expected
