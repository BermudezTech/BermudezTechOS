import uuid
from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from app.common.schemas import MoneyStr
from app.modules.sync.core.entity import SyncDateTime, SyncRecord

Period = Annotated[str, Field(pattern=r"^\d{4}(-(0[1-9]|1[0-2]))?$")]


class TransactionRecord(SyncRecord):
    account_id: uuid.UUID
    counter_account_id: uuid.UUID | None = None
    type: Literal["INCOME", "EXPENSE", "TRANSFER"]
    amount: Annotated[MoneyStr, Field(gt=0)]
    category_id: uuid.UUID | None = None
    category_source: Literal["MANUAL", "AI"] = "MANUAL"
    occurred_at: SyncDateTime
    description: str | None = None
    reimbursement_group_id: uuid.UUID | None = None
    subscription_id: uuid.UUID | None = None
    subscription_period: Period | None = None
    recurring_income_id: uuid.UUID | None = None
    recurring_income_period: Period | None = None
    cdt_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _single_record_rules(self) -> Self:
        if (self.type == "TRANSFER") != (self.counter_account_id is not None):
            raise ValueError("counterAccountId es obligatorio si y solo si el tipo es TRANSFER.")
        if self.counter_account_id is not None and self.counter_account_id == self.account_id:
            raise ValueError("La cuenta destino debe ser distinta de la cuenta origen.")
        if self.type == "TRANSFER" and self.category_id is not None:
            raise ValueError("Una transferencia no lleva categoría.")
        if (self.recurring_income_id is None) != (self.recurring_income_period is None):
            raise ValueError("recurringIncomeId y recurringIncomePeriod van juntos.")
        if self.recurring_income_id is not None and self.type != "INCOME":
            raise ValueError("Un ingreso recurrente solo registra movimientos INCOME.")
        if self.subscription_id is not None and self.type != "EXPENSE":
            raise ValueError("Un débito de suscripción debe ser EXPENSE.")
        return self
