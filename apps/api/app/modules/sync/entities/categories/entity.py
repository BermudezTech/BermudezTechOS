from app.db.models.categories import Category
from app.modules.sync.core.entity import SyncEntity
from app.modules.sync.core.reasons import RejectCode
from app.modules.sync.entities.categories.schemas import CategoryRecord


class CategoriesSyncEntity(SyncEntity[CategoryRecord]):
    table = "categories"
    model = Category
    record_schema = CategoryRecord
    # Nombre único por tipo entre las no borradas (índice parcial, R16 de la spec 003).
    constraint_codes = {"uq_categories_user_name_kind": RejectCode.DUPLICATE}
