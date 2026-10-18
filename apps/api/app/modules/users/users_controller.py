"""Rutas de usuarios. No existe ninguna ruta para crear usuarios (FR-006)."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.common.guards import CurrentUser
from app.modules.users.dependencies import get_users_service
from app.modules.users.schemas import UserProfile
from app.modules.users.users_service import UsersService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfile)
async def me(
    user: CurrentUser, service: Annotated[UsersService, Depends(get_users_service)]
) -> UserProfile:
    return service.get_profile(user)
