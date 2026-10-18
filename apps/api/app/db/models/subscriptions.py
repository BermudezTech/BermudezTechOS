import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import SmallInteger, String, text
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
)


class Subscription(UserOwnedMixin, SyncColumnsMixin, Base):
    """Suscripciones con débito periódico (§5). `next_billing_date` se calcula, no se guarda."""

    __tablename__ = "subscriptions"
    __table_args__ = owned_table_args(
        "subscriptions",
        owned_fk("subscriptions", "account_id", "accounts"),
        owned_fk("subscriptions", "category_id", "categories"),
        check("amount_positive", "amount > 0"),
        check("billing_cycle", in_values("billing_cycle", "MONTHLY", "YEARLY")),
        check("billing_day", "billing_day BETWEEN 1 AND 31"),
        check("billing_month", "billing_month IS NULL OR billing_month BETWEEN 1 AND 12"),
        check("yearly_month", "billing_cycle <> 'YEARLY' OR billing_month IS NOT NULL"),
        check("status", in_values("status", "ACTIVE", "PAUSED", "CANCELLED")),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    account_id: Mapped[uuid.UUID]
    category_id: Mapped[uuid.UUID | None]
    name: Mapped[str] = mapped_column(String(100))
    icon: Mapped[str | None] = mapped_column(String(100))
    amount: Mapped[Decimal] = mapped_column(Money)
    billing_cycle: Mapped[str] = mapped_column(String(10), server_default=text("'MONTHLY'"))
    billing_day: Mapped[int] = mapped_column(SmallInteger)
    billing_month: Mapped[int | None] = mapped_column(SmallInteger)
    start_date: Mapped[date]
    status: Mapped[str] = mapped_column(String(10), server_default=text("'ACTIVE'"))
