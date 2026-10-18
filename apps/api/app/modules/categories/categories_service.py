from app.modules.categories.categories_repository import CategoriesRepository
from app.modules.categories.schemas import CategoryList, CategoryOut


class CategoriesService:
    def __init__(self, repository: CategoriesRepository) -> None:
        self._repository = repository

    async def list_categories(self) -> CategoryList:
        categories = await self._repository.list_active()
        return CategoryList(items=[CategoryOut.model_validate(c) for c in categories])
