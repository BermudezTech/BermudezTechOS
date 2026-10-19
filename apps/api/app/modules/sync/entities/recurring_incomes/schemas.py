import uuid
from datetime import date
from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from app.common.schemas import MoneyStr
from app.modules.sync.core.entity import SyncRecord


class RecurringIncomeRecord(SyncRecord):
    account_id: uuid.UUID
    category_id: uuid.UUID | None = None
    name: Annotated[str, Field(min_length=1, max_length=100)]
    icon: Annotated[str, Field(max_length=100)] | None = None
    expected_amount: Annotated[MoneyStr, Field(gt=0)]
    cycle: Literal["MONTHLY", "YEARLY"] = "MONTHLY"
    expected_day: Annotated[int, Field(ge=1, le=31)]
    expected_month: Annotated[int, Field(ge=1, le=12)] | None = None
    start_date: date
    status: Literal["ACTIVE", "PAUSED"] = "ACTIVE"

    @model_validator(mode="after")
    def _yearly_month(self) -> Self:
        if (self.cycle == "YEARLY") != (self.expected_month is not None):
            raise ValueError("expectedMonth es obligatorio si y solo si el ciclo es YEARLY.")
        return self
