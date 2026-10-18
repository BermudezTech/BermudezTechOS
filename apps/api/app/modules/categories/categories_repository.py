from collections.abc import Sequence

from app.common.repository import UserScopedRepository
from app.db.models.categories import Category


class CategoriesRepository(UserScopedRepository[Category]):
    model = Category

    async def list_active(self) -> Sequence[Category]:
        return await self.list(Category.kind, Category.sort_order, Category.name)
