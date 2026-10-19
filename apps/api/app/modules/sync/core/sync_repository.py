"""Acceso a datos del sync, siempre con alcance del usuario de la sesión.

Igual que `UserScopedRepository`, se construye con el usuario y ningún método acepta un `user_id`.
"""

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import Row, func, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, AsyncSessionTransaction

from app.modules.sync.core.lock import user_sync_lock

# Columnas que un PUSH nunca sobrescribe en una fila existente.
_IMMUTABLE_ON_UPDATE = frozenset({"id", "user_id", "created_at"})


class SyncRepository:
    def __init__(self, session: AsyncSession, user_id: uuid.UUID) -> None:
        self._session = session
        self._user_id = user_id

    @property
    def user_id(self) -> uuid.UUID:
        return self._user_id

    async def lock(self, *, shared: bool) -> None:
        await user_sync_lock(self._session, self._user_id, shared=shared)

    def savepoint(self) -> AsyncSessionTransaction:
        return self._session.begin_nested()

    async def upsert_lww(self, model: type[Any], values: dict[str, Any]) -> bool:
        """Inserta o sobrescribe con last-write-wins en una sola sentencia (research S4).

        Solo sobrescribe si la fila es del usuario y el `updated_at` entrante es estrictamente más
        reciente. Devuelve `True` si se escribió (creada o sobrescrita).
        """
        table = model.__table__
        statement = insert(table).values(**values, user_id=self._user_id)
        changes: dict[str, Any] = {
            name: statement.excluded[name] for name in values if name not in _IMMUTABLE_ON_UPDATE
        }
        changes["server_updated_at"] = func.clock_timestamp()
        upsert = statement.on_conflict_do_update(
            index_elements=[table.c.id],
            set_=changes,
            where=(table.c.user_id == self._user_id)
            & (statement.excluded.updated_at > table.c.updated_at),
        ).returning(table.c.id)
        result = await self._session.execute(upsert)
        return result.scalar_one_or_none() is not None

    async def exists_for_user(self, model: type[Any], record_id: uuid.UUID) -> bool:
        """Incluye los borrados lógicamente."""
        query = select(model.id).where(model.user_id == self._user_id, model.id == record_id)
        return (await self._session.scalar(query)) is not None

    async def fetch_refs(
        self, model: type[Any], ids: set[uuid.UUID], fields: tuple[str, ...]
    ) -> dict[uuid.UUID, Row[Any]]:
        """Registros referenciados del usuario (incluidos los borrados), en una sola consulta."""
        if not ids:
            return {}
        columns = [model.id, *(getattr(model, name) for name in fields)]
        query = select(*columns).where(model.user_id == self._user_id, model.id.in_(ids))
        rows = (await self._session.execute(query)).all()
        return {row.id: row for row in rows}

    async def ids_with_children(
        self, model: type[Any], parent_field: str, ids: set[uuid.UUID]
    ) -> set[uuid.UUID]:
        """De `ids`, los que tienen al menos un hijo no borrado por `parent_field`."""
        if not ids:
            return set()
        parent = getattr(model, parent_field)
        query = (
            select(parent)
            .where(model.user_id == self._user_id, parent.in_(ids), model.deleted_at.is_(None))
            .distinct()
        )
        return set((await self._session.scalars(query)).all())

    async def pull_page(
        self, model: type[Any], after: tuple[datetime, uuid.UUID] | None, limit: int
    ) -> Sequence[Any]:
        """Cambios posteriores a `after` (keyset `server_updated_at, id`), borrados incluidos."""
        query = select(model).where(model.user_id == self._user_id)
        if after is not None:
            query = query.where(tuple_(model.server_updated_at, model.id) > tuple_(*after))
        query = query.order_by(model.server_updated_at, model.id).limit(limit)
        return (await self._session.scalars(query)).all()
