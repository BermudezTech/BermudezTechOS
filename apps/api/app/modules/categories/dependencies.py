"""Providers del módulo de categorías.

El repositorio depende de `CurrentUser`: un servicio de datos no puede existir sin el usuario de
la sesión, así que no hay forma de consultar sin filtrar por dueño.
"""

from typing import Annotated

from fastapi import Depends

from app.common.guards import CurrentUser
from app.core.clock import Clock, get_clock
from app.core.database import SessionDep
from app.modules.categories.categories_repository import CategoriesRepository
from app.modules.categories.categories_service import CategoriesService


def get_categories_repository(
    user: CurrentUser,
    session: SessionDep,
    clock: Annotated[Clock, Depends(get_clock)],
) -> CategoriesRepository:
    return CategoriesRepository(session, user.id, clock)


def get_categories_service(
    repository: Annotated[CategoriesRepository, Depends(get_categories_repository)],
) -> CategoriesService:
    return CategoriesService(repository)
