"""Motor async de SQLAlchemy y la sesión por solicitud."""

from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    return create_async_engine(get_settings().database_url, pool_pre_ping=True)


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Una sesión por solicitud: confirma al terminar bien y deshace si hay excepción."""
    async with get_sessionmaker()() as session:
        try:
            yield session
            await session.commit()
        except BaseException:
            await session.rollback()
            raise


# scope="function": el commit ocurre al terminar la función de la ruta, ANTES de enviar la
# respuesta. Con el scope por defecto ("request") el cliente podría recibir la respuesta y hacer
# otra solicitud antes de que los cambios estén confirmados. Toda dependencia usa este alias para
# compartir la misma sesión dentro de una solicitud.
SessionDep = Annotated[AsyncSession, Depends(get_session, scope="function")]

SessionFactory = Callable[[], AbstractAsyncContextManager[AsyncSession]]


def get_session_factory() -> SessionFactory:
    """Fábrica de sesiones para trabajo fuera de la solicitud (p. ej. tareas en segundo plano)."""
    return get_sessionmaker()


async def dispose_engine() -> None:
    if get_engine.cache_info().currsize:
        await get_engine().dispose()
