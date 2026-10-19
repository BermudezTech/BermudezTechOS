"""Registro de controladores. Añadir un módulo = añadir su router a una de estas listas.

- `ROOT_CONTROLLERS`: se montan en la raíz (p. ej. `/health`).
- `CONTROLLERS`: se montan bajo `/api/v1`.
"""

from fastapi import APIRouter

from app.modules.auth.auth_controller import router as auth_router
from app.modules.categories.categories_controller import router as categories_router
from app.modules.health.health_controller import router as health_router
from app.modules.sync.sync_controller import router as sync_router
from app.modules.users.users_controller import router as users_router

ROOT_CONTROLLERS: list[APIRouter] = [health_router]
CONTROLLERS: list[APIRouter] = [auth_router, users_router, categories_router, sync_router]
