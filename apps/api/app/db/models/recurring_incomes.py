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


class RecurringIncome(UserOwnedMixin, SyncColumnsMixin, Base):
    """Plantillas de ingresos que se repiten; no generan movimientos solas (§8)."""

    __tablename__ = "recurring_incomes"
    __table_args__ = owned_table_args(
        "recurring_incomes",
        owned_fk("recurring_incomes", "account_id", "accounts"),
        # Que la categoría sea de tipo INCOME se valida en el servicio.
        owned_fk("recurring_incomes", "category_id", "categories"),
        check("expected_amount_positive", "expected_amount > 0"),
        check("cycle", in_values("cycle", "MONTHLY", "YEARLY")),
        check("expected_day", "expected_day BETWEEN 1 AND 31"),
        check("expected_month", "expected_month IS NULL OR expected_month BETWEEN 1 AND 12"),
        check("yearly_month", "cycle <> 'YEARLY' OR expected_month IS NOT NULL"),
        check("status", in_values("status", "ACTIVE", "PAUSED")),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    account_id: Mapped[uuid.UUID]
    category_id: Mapped[uuid.UUID | None]
    name: Mapped[str] = mapped_column(String(100))
    icon: Mapped[str | None] = mapped_column(String(100))
    expected_amount: Mapped[Decimal] = mapped_column(Money)
    cycle: Mapped[str] = mapped_column(String(10), server_default=text("'MONTHLY'"))
    expected_day: Mapped[int] = mapped_column(SmallInteger)
    expected_month: Mapped[int | None] = mapped_column(SmallInteger)
    start_date: Mapped[date]
    status: Mapped[str] = mapped_column(String(10), server_default=text("'ACTIVE'"))
