"""Estado del servicio. Lo usan el healthcheck de Docker y Coolify."""

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.common.decorators import public
from app.modules.health.dependencies import get_health_service
from app.modules.health.health_service import HealthService

router = APIRouter(tags=["health"])


@router.get("/health")
@public
async def health(service: Annotated[HealthService, Depends(get_health_service)]) -> JSONResponse:
    if await service.check():
        return JSONResponse({"status": "ok", "database": "ok"})
    return JSONResponse({"status": "degraded", "database": "unavailable"}, status_code=503)
