import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from app.common.schemas import MoneyStr, PercentStr, RateStr
from app.modules.sync.core.entity import SyncRecord


class CdtRecord(SyncRecord):
    account_id: uuid.UUID
    issuer: Annotated[str, Field(min_length=1, max_length=100)]
    certificate_number: Annotated[str, Field(max_length=50)] | None = None
    principal: Annotated[MoneyStr, Field(gt=0)]
    annual_rate_ea: RateStr
    annual_rate_nominal: RateStr
    term_days: Annotated[int, Field(gt=0)]
    opened_on: date
    matures_on: date
    interest_payment: Literal["AT_MATURITY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]
    withholding_rate: PercentStr = Decimal("4.00")
    source_account_id: uuid.UUID
    payout_account_id: uuid.UUID | None = None
    status: Literal["ACTIVE", "MATURED", "RENEWED", "CANCELLED"] = "ACTIVE"
    renewed_from_cdt_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _single_record_rules(self) -> Self:
        if self.renewed_from_cdt_id == self.id:
            raise ValueError("Un CDT no puede ser la renovación de sí mismo.")
        if self.matures_on < self.opened_on:
            raise ValueError("maturesOn no puede ser anterior a openedOn.")
        return self
