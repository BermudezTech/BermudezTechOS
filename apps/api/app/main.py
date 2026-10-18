"""Punto de entrada de la API."""

import logging
from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from app.common.guards import auth_guard
from app.core.config import get_settings
from app.core.database import dispose_engine
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.modules import CONTROLLERS, ROOT_CONTROLLERS

API_PREFIX = "/api/v1"

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    if not settings.mail_configured:
        logger.warning(
            "Envío de correo no configurado: la recuperación de contraseña no enviará correos"
        )
    yield
    await dispose_engine()


def create_app() -> FastAPI:
    settings = get_settings()
    docs = settings.docs_enabled
    app = FastAPI(
        title="BermudezTechOS API",
        version="0.1.0",
        dependencies=[Depends(auth_guard)],
        docs_url="/docs" if docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if docs else None,
        lifespan=lifespan,
    )
    register_exception_handlers(app)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    for router in ROOT_CONTROLLERS:
        app.include_router(router)
    for router in CONTROLLERS:
        app.include_router(router, prefix=API_PREFIX)
    return app


def registered_routes(application: FastAPI) -> Iterator[tuple[str, APIRoute]]:
    """Rutas efectivas `(ruta completa, APIRoute)` de la app.

    FastAPI anida los routers incluidos, así que se recorren los registros de módulos más las
    rutas añadidas directamente a la app.
    """
    for route in application.routes:
        if isinstance(route, APIRoute):
            yield route.path, route
    for router in ROOT_CONTROLLERS:
        for route in router.routes:
            if isinstance(route, APIRoute):
                yield route.path, route
    for router in CONTROLLERS:
        for route in router.routes:
            if isinstance(route, APIRoute):
                yield API_PREFIX + route.path, route


app = create_app()
