import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Index, Numeric, String, text
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


class Cdt(UserOwnedMixin, SyncColumnsMixin, Base):
    """Periodos de inversión CDT; una cadena de renovaciones comparte su cuenta INVESTMENT."""

    __tablename__ = "cdts"
    __table_args__ = owned_table_args(
        "cdts",
        # Una cuenta INVESTMENT la comparten los periodos de una cadena de renovaciones (spec 009).
        Index("ix_cdts_user_id_account_id", "user_id", "account_id"),
        owned_fk("cdts", "account_id", "accounts"),
        owned_fk("cdts", "source_account_id", "accounts"),
        owned_fk("cdts", "payout_account_id", "accounts"),
        owned_fk("cdts", "renewed_from_cdt_id", "cdts"),
        check("principal_positive", "principal > 0"),
        check("term_days_positive", "term_days > 0"),
        check("matures_after_opening", "matures_on >= opened_on"),
        check(
            "interest_payment",
            in_values(
                "interest_payment", "AT_MATURITY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"
            ),
        ),
        check("status", in_values("status", "ACTIVE", "MATURED", "RENEWED", "CANCELLED")),
        check(
            "settled_all_or_none",
            "(settled_gross_interest IS NULL AND settled_withholding IS NULL"
            " AND settled_net_interest IS NULL) OR (settled_gross_interest IS NOT NULL"
            " AND settled_withholding IS NOT NULL AND settled_net_interest IS NOT NULL)",
        ),
        check(
            "settled_consistent",
            "settled_gross_interest IS NULL"
            " OR settled_gross_interest - settled_withholding = settled_net_interest",
        ),
        check(
            "settled_non_negative",
            "settled_gross_interest IS NULL OR (settled_gross_interest >= 0"
            " AND settled_withholding >= 0 AND settled_net_interest >= 0)",
        ),
        check(
            "maturity_value_gte_principal",
            "maturity_value_override IS NULL OR maturity_value_override >= principal",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    # La cuenta debe ser de tipo INVESTMENT: se valida en el servicio.
    account_id: Mapped[uuid.UUID]
    issuer: Mapped[str] = mapped_column(String(100))
    certificate_number: Mapped[str | None] = mapped_column(String(50))
    principal: Mapped[Decimal] = mapped_column(Money)
    annual_rate_ea: Mapped[Decimal] = mapped_column(Numeric(7, 4))
    annual_rate_nominal: Mapped[Decimal] = mapped_column(Numeric(7, 4))
    term_days: Mapped[int]
    opened_on: Mapped[date]
    matures_on: Mapped[date]
    interest_payment: Mapped[str] = mapped_column(String(12))
    withholding_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default=text("4.00"))
    # NULL: CDT existente registrado sin movimiento, o periodo de renovación.
    source_account_id: Mapped[uuid.UUID | None]
    payout_account_id: Mapped[uuid.UUID | None]
    status: Mapped[str] = mapped_column(String(10), server_default=text("'ACTIVE'"))
    renewed_from_cdt_id: Mapped[uuid.UUID | None]
    # Valor neto al vencimiento indicado por el banco; NULL = calculado.
    maturity_value_override: Mapped[Decimal | None] = mapped_column(Money)
    # Liquidación del periodo al renovarlo (FR-019a); base para impuestos.
    settled_gross_interest: Mapped[Decimal | None] = mapped_column(Money)
    settled_withholding: Mapped[Decimal | None] = mapped_column(Money)
    settled_net_interest: Mapped[Decimal | None] = mapped_column(Money)
