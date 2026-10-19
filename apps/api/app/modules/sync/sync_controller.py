"""Rutas de sincronización: un PUSH y un PULL para todas las tablas (contracts/http-api.md)."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.sync.dependencies import get_sync_service, limit_push_body
from app.modules.sync.schemas import PullRequest, PullResponse, PushRequest, PushResponse
from app.modules.sync.sync_service import SyncService

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post(
    "/push",
    response_model=PushResponse,
    dependencies=[Depends(limit_push_body)],
)
async def push(
    request: PushRequest,
    service: Annotated[SyncService, Depends(get_sync_service)],
) -> PushResponse:
    return await service.push(request)


@router.post("/pull", response_model=PullResponse)
async def pull(
    request: PullRequest,
    service: Annotated[SyncService, Depends(get_sync_service)],
) -> PullResponse:
    """Cambios desde cada cursor, borrados incluidos. Es POST porque lleva un objeto de cursores;
    no modifica datos."""
    return await service.pull(request)
