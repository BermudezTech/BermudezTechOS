import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Money, SyncColumnsMixin, UserOwnedMixin, check, owned_table_args


class Asset(UserOwnedMixin, SyncColumnsMixin, Base):
    """Bienes cuyo valor no proviene de transacciones (§7)."""

    __tablename__ = "assets"
    __table_args__ = owned_table_args("assets", check("value_non_negative", "value >= 0"))

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    value: Mapped[Decimal] = mapped_column(Money)
    valid_until: Mapped[date]
