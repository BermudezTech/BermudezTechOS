"""Base declarativa, convención de nombres y mixins compartidos por las tablas de datos."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    MetaData,
    Numeric,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# Montos: decimales exactos, nunca float (constitución, Principio IV).
Money = Numeric(14, 2, asdecimal=True)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def utc_timestamp(*, nullable: bool = False, server_now: bool = False) -> Any:
    return mapped_column(
        DateTime(timezone=True),
        nullable=nullable,
        server_default=text("now()") if server_now else None,
    )


class UserOwnedMixin:
    """Dueño del registro. Solo existe en el servidor y se asigna desde el JWT."""

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )


class SyncColumnsMixin:
    """Columnas de sincronización de `docs/db-finanzas.md`."""

    created_at: Mapped[datetime] = utc_timestamp()
    updated_at: Mapped[datetime] = utc_timestamp()
    deleted_at: Mapped[datetime | None] = utc_timestamp(nullable=True)
    # Marca del servidor: cursor del PULL. clock_timestamp() varía dentro de una transacción.
    server_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("clock_timestamp()")
    )


def owned_fk(table: str, column: str, target: str) -> ForeignKeyConstraint:
    """FK compuesta `(user_id, column) → target(user_id, id)`: impide referencias entre usuarios.

    Con MATCH SIMPLE (por defecto) no se verifica si `column` es NULL. Usa NO ACTION (por
    defecto) para que el borrado en cascada de un usuario funcione.
    """
    return ForeignKeyConstraint(
        ["user_id", column],
        [f"{target}.user_id", f"{target}.id"],
        name=f"fk_{table}_{column}_{target}",
    )


def check(name: str, condition: str) -> CheckConstraint:
    return CheckConstraint(condition, name=name)


def in_values(column: str, *values: str) -> str:
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


def owned_table_args(table: str, *extra: Any) -> tuple[Any, ...]:
    """Restricciones comunes a toda tabla de datos, más las propias de la tabla."""
    return (
        UniqueConstraint("user_id", "id", name=f"uq_{table}_user_id_id"),
        Index(f"ix_{table}_user_id_server_updated_at", "user_id", "server_updated_at"),
        *extra,
    )
