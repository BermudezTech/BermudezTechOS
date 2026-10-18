import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Numeric, String, UniqueConstraint, text
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
    """Inversiones CDT; cada una tiene su cuenta INVESTMENT asociada (§6)."""

    __tablename__ = "cdts"
    __table_args__ = owned_table_args(
        "cdts",
        UniqueConstraint("account_id", name="uq_cdts_account_id"),
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
    source_account_id: Mapped[uuid.UUID]
    payout_account_id: Mapped[uuid.UUID | None]
    status: Mapped[str] = mapped_column(String(10), server_default=text("'ACTIVE'"))
    renewed_from_cdt_id: Mapped[uuid.UUID | None]
