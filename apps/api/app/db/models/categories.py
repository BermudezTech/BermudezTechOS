import uuid

from sqlalchemy import Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SyncColumnsMixin, UserOwnedMixin, check, in_values, owned_table_args


class Category(UserOwnedMixin, SyncColumnsMixin, Base):
    """Categorías de gasto e ingreso del usuario (§2)."""

    __tablename__ = "categories"
    __table_args__ = owned_table_args(
        "categories",
        check("kind", in_values("kind", "INCOME", "EXPENSE")),
        # Único solo entre las no borradas: una categoría borrada no bloquea su nombre (R16).
        Index(
            "uq_categories_user_name_kind",
            "user_id",
            "name",
            "kind",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("ix_categories_user_id_kind_sort_order", "user_id", "kind", "sort_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    kind: Mapped[str] = mapped_column(String(10))
    icon: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(50))
    sort_order: Mapped[int] = mapped_column(default=0, server_default=text("0"))
