"""Montos exactos: solo strings, sin float y sin redondeo (research S8, SC-007)."""

from decimal import Decimal
from typing import Any

import pytest
from pydantic import BaseModel, ValidationError

from app.common.schemas import MoneyStr, PercentStr, RateStr


class _Amounts(BaseModel):
    money: MoneyStr = Decimal("0")
    rate: RateStr = Decimal("0")
    percent: PercentStr = Decimal("0")


@pytest.mark.parametrize("value", ["0.10", "0.20", "0.30", "9999999999.99", "45000.00"])
def test_money_round_trips_unchanged(value: str) -> None:
    assert _Amounts(money=value).model_dump(mode="json")["money"] == value


def test_money_never_uses_float() -> None:
    parsed = _Amounts(money="0.10").money + _Amounts(money="0.20").money
    assert parsed == Decimal("0.30")


def test_money_serializes_with_two_decimals() -> None:
    assert _Amounts(money="1234.5").model_dump(mode="json")["money"] == "1234.50"
    assert _Amounts(money="7").model_dump(mode="json")["money"] == "7.00"


@pytest.mark.parametrize(
    "value", [1234.5, 10, "1.234", "-1.00", "1e3", "", " 1.00", "1234567890123", "1,00"]
)
def test_money_rejects_inexact_or_malformed(value: Any) -> None:
    with pytest.raises(ValidationError):
        _Amounts(money=value)


def test_rate_and_percent_scales() -> None:
    dumped = _Amounts(rate="10.25", percent="4").model_dump(mode="json")
    assert dumped["rate"] == "10.2500"
    assert dumped["percent"] == "4.00"
    with pytest.raises(ValidationError):
        _Amounts(rate="1.23456")
    with pytest.raises(ValidationError):
        _Amounts(percent="1000")


def test_decimal_from_database_is_accepted() -> None:
    assert _Amounts(money=Decimal("12.30")).model_dump(mode="json")["money"] == "12.30"
