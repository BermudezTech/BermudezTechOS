import uuid
from decimal import Decimal

from sqlalchemy import CHAR, SmallInteger, String, text
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


class Account(UserOwnedMixin, SyncColumnsMixin, Base):
    """Cuentas, subcuentas (cajitas), tarjetas e inversiones (§1)."""

    __tablename__ = "accounts"
    __table_args__ = owned_table_args(
        "accounts",
        owned_fk("accounts", "parent_account_id", "accounts"),
        check(
            "type",
            in_values("type", "CHECKING", "SAVINGS", "CASH", "CREDIT_CARD", "POCKET", "INVESTMENT"),
        ),
        check("nature", in_values("nature", "ASSET", "LIABILITY")),
        check("credit_card_liability", "type <> 'CREDIT_CARD' OR nature = 'LIABILITY'"),
        check("statement_day", "statement_day IS NULL OR statement_day BETWEEN 1 AND 31"),
        check("payment_due_day", "payment_due_day IS NULL OR payment_due_day BETWEEN 1 AND 31"),
        check("not_own_parent", "parent_account_id <> id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    # Solo un nivel de subcuentas: se valida en el servicio (no cabe en un CHECK).
    parent_account_id: Mapped[uuid.UUID | None]
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(20))
    nature: Mapped[str] = mapped_column(String(10))
    currency: Mapped[str] = mapped_column(CHAR(3), server_default=text("'COP'"))
    icon: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(50))
    opening_balance: Mapped[Decimal] = mapped_column(Money, server_default=text("0"))
    credit_limit: Mapped[Decimal | None] = mapped_column(Money)
    statement_day: Mapped[int | None] = mapped_column(SmallInteger)
    payment_due_day: Mapped[int | None] = mapped_column(SmallInteger)
    is_excluded_from_net_worth: Mapped[bool] = mapped_column(server_default=text("false"))
    is_archived: Mapped[bool] = mapped_column(server_default=text("false"))
    sort_order: Mapped[int] = mapped_column(server_default=text("0"))
