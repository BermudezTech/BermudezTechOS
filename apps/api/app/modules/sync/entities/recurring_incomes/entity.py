from app.db.models.recurring_incomes import RecurringIncome
from app.modules.sync.core.batch import BatchContext
from app.modules.sync.core.entity import Reference, SyncEntity
from app.modules.sync.core.reasons import RejectCode, Rejection
from app.modules.sync.core.references import ResolvedRefs
from app.modules.sync.entities.recurring_incomes.schemas import RecurringIncomeRecord


class RecurringIncomesSyncEntity(SyncEntity[RecurringIncomeRecord]):
    table = "recurring_incomes"
    model = RecurringIncome
    record_schema = RecurringIncomeRecord
    references = (Reference("account_id", "accounts"), Reference("category_id", "categories"))
    reference_fields = {"categories": ("kind",)}

    def check_coherence(
        self, record: RecurringIncomeRecord, refs: ResolvedRefs, batch: BatchContext
    ) -> Rejection | None:
        if record.category_id is None:
            return None
        category = refs.get("categories", record.category_id)
        if category is not None and category.kind != "INCOME":
            return Rejection.of(
                RejectCode.INCOHERENT,
                "La categoría de un ingreso recurrente debe ser de tipo ingreso.",
            )
        return None
