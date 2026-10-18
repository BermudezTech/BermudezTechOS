import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Index, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import (
    Base,
    Money,
    SyncColumnsMixin,
    UserOwnedMixin,
    check,
    in_values,
    owned_fk,
    owned_table_args,
    utc_timestamp,
)

_PERIOD = r"'^\d{4}(-(0[1-9]|1[0-2]))?$'"


class Transaction(UserOwnedMixin, SyncColumnsMixin, Base):
    """Movimientos (§3). Montos siempre positivos; la dirección la da `type`."""

    __tablename__ = "transactions"
    __table_args__ = owned_table_args(
        "transactions",
        owned_fk("transactions", "account_id", "accounts"),
        owned_fk("transactions", "counter_account_id", "accounts"),
        owned_fk("transactions", "category_id", "categories"),
        owned_fk("transactions", "reimbursement_group_id", "reimbursement_groups"),
        owned_fk("transactions", "subscription_id", "subscriptions"),
        owned_fk("transactions", "recurring_income_id", "recurring_incomes"),
        owned_fk("transactions", "cdt_id", "cdts"),
        check("type", in_values("type", "INCOME", "EXPENSE", "TRANSFER")),
        check("amount_positive", "amount > 0"),
        check("transfer_counter", "(type = 'TRANSFER') = (counter_account_id IS NOT NULL)"),
        check(
            "counter_differs",
            "counter_account_id IS NULL OR counter_account_id <> account_id",
        ),
        check("category_source", in_values("category_source", "MANUAL", "AI")),
        check(
            "recurring_income_period_pair",
            "(recurring_income_id IS NULL) = (recurring_income_period IS NULL)",
        ),
        check("recurring_income_type", "recurring_income_id IS NULL OR type = 'INCOME'"),
        check(
            "subscription_period_format",
            f"subscription_period IS NULL OR subscription_period ~ {_PERIOD}",
        ),
        check(
            "recurring_income_period_format",
            f"recurring_income_period IS NULL OR recurring_income_period ~ {_PERIOD}",
        ),
        # Débitos de suscripciones idempotentes: un débito por periodo.
        UniqueConstraint(
            "subscription_id",
            "subscription_period",
            name="uq_transactions_subscription_id_subscription_period",
        ),
        Index(
            "ix_transactions_user_id_account_id_occurred_at", "user_id", "account_id", "occurred_at"
        ),
        Index("ix_transactions_counter_account_id", "counter_account_id"),
        Index(
            "ix_transactions_user_id_category_id_occurred_at",
            "user_id",
            "category_id",
            "occurred_at",
        ),
        Index("ix_transactions_reimbursement_group_id", "reimbursement_group_id"),
        Index(
            "ix_transactions_recurring_income_id_period",
            "recurring_income_id",
            "recurring_income_period",
        ),
    )

    # UUIDv5 determinista cuando viene de una suscripción.
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    account_id: Mapped[uuid.UUID]
    counter_account_id: Mapped[uuid.UUID | None]
    type: Mapped[str] = mapped_column(String(10))
    amount: Mapped[Decimal] = mapped_column(Money)
    category_id: Mapped[uuid.UUID | None]
    category_source: Mapped[str] = mapped_column(String(10), server_default=text("'MANUAL'"))
    occurred_at: Mapped[datetime] = utc_timestamp()
    description: Mapped[str | None] = mapped_column(Text)
    reimbursement_group_id: Mapped[uuid.UUID | None]
    subscription_id: Mapped[uuid.UUID | None]
    subscription_period: Mapped[str | None] = mapped_column(String(7))
    recurring_income_id: Mapped[uuid.UUID | None]
    recurring_income_period: Mapped[str | None] = mapped_column(String(7))
    cdt_id: Mapped[uuid.UUID | None]
