"""Bases de los DTOs: JSON en camelCase, fechas ISO-8601 UTC con `Z` y decimales exactos."""

import re
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, ConfigDict, PlainSerializer
from pydantic.alias_generators import to_camel


def _to_utc_z(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


UtcDateTime = Annotated[datetime, PlainSerializer(_to_utc_z, return_type=str, when_used="json")]


class _ExactDecimal:
    """Decimal que en JSON viaja solo como string (Principio IV).

    Un número JSON se rechaza: pudo perder precisión como float antes de llegar. Nunca se redondea;
    los `Decimal` (p. ej. leídos de la base) se aceptan tal cual.
    """

    def __init__(self, integer_digits: int, places: int) -> None:
        self._pattern = re.compile(rf"\d{{1,{integer_digits}}}(\.\d{{1,{places}}})?")
        self._quantum = Decimal(1).scaleb(-places)
        self._places = places

    def parse(self, value: object) -> Decimal:
        if isinstance(value, Decimal):
            return value
        if not isinstance(value, str) or not self._pattern.fullmatch(value):
            raise ValueError(
                f"Debe ser un texto decimal no negativo con hasta {self._places} decimales "
                '(p. ej. "1234.56").'
            )
        return Decimal(value)

    def dump(self, value: Decimal) -> str:
        return str(value.quantize(self._quantum))


_money = _ExactDecimal(12, 2)  # NUMERIC(14, 2)
_rate = _ExactDecimal(3, 4)  # NUMERIC(7, 4)
_percent = _ExactDecimal(3, 2)  # NUMERIC(5, 2)

MoneyStr = Annotated[
    Decimal,
    BeforeValidator(_money.parse),
    PlainSerializer(_money.dump, return_type=str, when_used="json"),
]
RateStr = Annotated[
    Decimal,
    BeforeValidator(_rate.parse),
    PlainSerializer(_rate.dump, return_type=str, when_used="json"),
]
PercentStr = Annotated[
    Decimal,
    BeforeValidator(_percent.parse),
    PlainSerializer(_percent.dump, return_type=str, when_used="json"),
]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        serialize_by_alias=True,
    )


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[dict[str, Any]] | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody
