import uuid
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from app.common.schemas import MoneyStr
from app.modules.sync.core.entity import SyncRecord

DayOfMonth = Annotated[int, Field(ge=1, le=31)]


class AccountRecord(SyncRecord):
    parent_account_id: uuid.UUID | None = None
    name: Annotated[str, Field(min_length=1, max_length=100)]
    type: Literal["CHECKING", "SAVINGS", "CASH", "CREDIT_CARD", "POCKET", "INVESTMENT"]
    nature: Literal["ASSET", "LIABILITY"]
    # Solo COP en el MVP.
    currency: Literal["COP"] = "COP"
    icon: Annotated[str, Field(max_length=50)] | None = None
    color: Annotated[str, Field(max_length=50)] | None = None
    opening_balance: MoneyStr = Decimal("0.00")
    credit_limit: MoneyStr | None = None
    statement_day: DayOfMonth | None = None
    payment_due_day: DayOfMonth | None = None
    is_excluded_from_net_worth: bool = False
    is_archived: bool = False
    sort_order: int = 0

    @model_validator(mode="after")
    def _single_record_rules(self) -> Self:
        if self.type == "CREDIT_CARD" and self.nature != "LIABILITY":
            raise ValueError("Una tarjeta de crédito debe tener naturaleza LIABILITY.")
        if self.parent_account_id == self.id:
            raise ValueError("Una cuenta no puede ser su propia cuenta padre.")
        return self
