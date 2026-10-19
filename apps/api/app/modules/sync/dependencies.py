"""Providers del módulo de sync.

El repositorio depende de `CurrentUser`: el sync no puede existir sin el usuario de la sesión, así
que no hay forma de leer ni escribir sin filtrar por dueño.
"""

from typing import Annotated

from fastapi import Depends, Request

from app.common.guards import CurrentUser
from app.core.clock import Clock, get_clock
from app.core.database import SessionDep
from app.modules.sync.core import config
from app.modules.sync.core.sync_repository import SyncRepository
from app.modules.sync.sync_service import PushTooLargeError, SyncService


def get_sync_repository(user: CurrentUser, session: SessionDep) -> SyncRepository:
    return SyncRepository(session, user.id)


def get_sync_service(
    repository: Annotated[SyncRepository, Depends(get_sync_repository)],
    clock: Annotated[Clock, Depends(get_clock)],
) -> SyncService:
    return SyncService(repository, clock)


def limit_push_body(request: Request) -> None:
    """Corta un PUSH demasiado grande antes de parsear el cuerpo (research S9)."""
    length = request.headers.get("content-length")
    if length is not None and length.isdigit() and int(length) > config.MAX_PUSH_BODY_BYTES:
        raise PushTooLargeError()
