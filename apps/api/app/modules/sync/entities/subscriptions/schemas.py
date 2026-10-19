import uuid
from datetime import date
from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from app.common.schemas import MoneyStr
from app.modules.sync.core.entity import SyncRecord


class SubscriptionRecord(SyncRecord):
    account_id: uuid.UUID
    category_id: uuid.UUID | None = None
    name: Annotated[str, Field(min_length=1, max_length=100)]
    icon: Annotated[str, Field(max_length=100)] | None = None
    amount: Annotated[MoneyStr, Field(gt=0)]
    billing_cycle: Literal["MONTHLY", "YEARLY"] = "MONTHLY"
    billing_day: Annotated[int, Field(ge=1, le=31)]
    billing_month: Annotated[int, Field(ge=1, le=12)] | None = None
    start_date: date
    status: Literal["ACTIVE", "PAUSED", "CANCELLED"] = "ACTIVE"

    @model_validator(mode="after")
    def _yearly_month(self) -> Self:
        if (self.billing_cycle == "YEARLY") != (self.billing_month is not None):
            raise ValueError("billingMonth es obligatorio si y solo si el ciclo es YEARLY.")
        return self
