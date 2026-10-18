import uuid

from sqlalchemy import String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SyncColumnsMixin, UserOwnedMixin, check, in_values, owned_table_args


class ReimbursementGroup(UserOwnedMixin, SyncColumnsMixin, Base):
    """Viáticos, adelantos y reembolsos: agrupa movimientos de dinero de terceros (§4)."""

    __tablename__ = "reimbursement_groups"
    __table_args__ = owned_table_args(
        "reimbursement_groups",
        check("kind", in_values("kind", "REIMBURSEMENT", "ADVANCE")),
        check("status", in_values("status", "OPEN", "SUBMITTED", "SETTLED")),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    payer: Mapped[str | None] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(15))
    status: Mapped[str] = mapped_column(String(10), server_default=text("'OPEN'"))
    notes: Mapped[str | None] = mapped_column(Text)
