"""Rutas de categorías.

Es la ruta de referencia para los módulos de datos futuros:
controlador (solo rutas) → servicio (lógica) → repositorio con alcance de usuario. El guard
global ya exige la sesión; el provider del repositorio toma el usuario de ella.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.categories.categories_service import CategoriesService
from app.modules.categories.dependencies import get_categories_service
from app.modules.categories.schemas import CategoryList

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=CategoryList)
async def list_categories(
    service: Annotated[CategoriesService, Depends(get_categories_service)],
) -> CategoryList:
    return await service.list_categories()
