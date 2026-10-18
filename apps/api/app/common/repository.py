"""Repositorio base con alcance de usuario (FR-020): toda consulta queda limitada al dueño.

Los repositorios de datos heredan de aquí y se construyen con el usuario de la sesión. Ningún
método acepta un `user_id`: no hay forma de leer ni escribir registros de otro usuario.
"""

import uuid
from collections.abc import Sequence
from typing import Any, ClassVar, cast

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock


class UserScopedRepository[ModelT]:
    # Modelo con `UserOwnedMixin` + `SyncColumnsMixin`.
    model: ClassVar[type[Any]]

    def __init__(self, session: AsyncSession, user_id: uuid.UUID, clock: Clock) -> None:
        self._session = session
        self._user_id = user_id
        self._clock = clock

    @property
    def user_id(self) -> uuid.UUID:
        return self._user_id

    def _query(self, *, include_deleted: bool = False) -> Select[Any]:
        model = self.model
        query = select(model).where(model.user_id == self._user_id)
        if not include_deleted:
            query = query.where(model.deleted_at.is_(None))
        return query

    async def get(self, record_id: uuid.UUID, *, include_deleted: bool = False) -> ModelT | None:
        query = self._query(include_deleted=include_deleted).where(self.model.id == record_id)
        return cast(ModelT | None, (await self._session.scalars(query)).one_or_none())

    async def list(self, *order_by: Any, include_deleted: bool = False) -> Sequence[ModelT]:
        query = self._query(include_deleted=include_deleted).order_by(*order_by)
        return cast(Sequence[ModelT], (await self._session.scalars(query)).all())

    async def add(self, instance: ModelT) -> ModelT:
        """Asigna siempre el dueño y la marca del servidor, aunque vengan otros valores."""
        owned = cast(Any, instance)
        owned.user_id = self._user_id
        owned.server_updated_at = self._clock.now()
        self._session.add(instance)
        await self._session.flush()
        return instance

    async def touch(self, instance: ModelT) -> None:
        owned = cast(Any, instance)
        if owned.user_id != self._user_id:
            raise ValueError("El registro no pertenece al usuario de la sesión")
        owned.server_updated_at = self._clock.now()
        await self._session.flush()
