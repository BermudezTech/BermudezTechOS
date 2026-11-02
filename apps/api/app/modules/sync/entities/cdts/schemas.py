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
    source_account_id: uuid.UUID | None = None
    payout_account_id: uuid.UUID | None = None
    status: Literal["ACTIVE", "MATURED", "RENEWED", "CANCELLED"] = "ACTIVE"
    renewed_from_cdt_id: uuid.UUID | None = None
    maturity_value_override: MoneyStr | None = None
    settled_gross_interest: MoneyStr | None = None
    settled_withholding: MoneyStr | None = None
    settled_net_interest: MoneyStr | None = None

    @model_validator(mode="after")
    def _single_record_rules(self) -> Self:
        if self.renewed_from_cdt_id == self.id:
            raise ValueError("Un CDT no puede ser la renovación de sí mismo.")
        if self.matures_on < self.opened_on:
            raise ValueError("maturesOn no puede ser anterior a openedOn.")
        if (
            self.maturity_value_override is not None
            and self.maturity_value_override < self.principal
        ):
            raise ValueError("El valor final no puede ser menor que el capital.")
        settled = (self.settled_gross_interest, self.settled_withholding, self.settled_net_interest)
        present = [value is not None for value in settled]
        if any(present) and not all(present):
            raise ValueError("La liquidación del CDT debe tener bruto, retención y neto.")
        gross, withholding, net = settled
        if gross is not None and withholding is not None and net is not None:
            if min(gross, withholding, net) < 0:
                raise ValueError("La liquidación del CDT no admite valores negativos.")
            if gross - withholding != net:
                raise ValueError("En la liquidación, bruto − retención debe ser igual al neto.")
        return self
