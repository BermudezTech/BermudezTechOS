from app.db.models.subscriptions import Subscription
from app.modules.sync.core.batch import BatchContext
from app.modules.sync.core.entity import Reference, SyncEntity
from app.modules.sync.core.reasons import RejectCode, Rejection
from app.modules.sync.core.references import ResolvedRefs
from app.modules.sync.entities.subscriptions.schemas import SubscriptionRecord


class SubscriptionsSyncEntity(SyncEntity[SubscriptionRecord]):
    table = "subscriptions"
    model = Subscription
    record_schema = SubscriptionRecord
    references = (Reference("account_id", "accounts"), Reference("category_id", "categories"))
    reference_fields = {"categories": ("kind",)}

    def check_coherence(
        self, record: SubscriptionRecord, refs: ResolvedRefs, batch: BatchContext
    ) -> Rejection | None:
        if record.category_id is None:
            return None
        category = refs.get("categories", record.category_id)
        if category is not None and category.kind != "EXPENSE":
            return Rejection.of(
                RejectCode.INCOHERENT, "La categoría de una suscripción debe ser de tipo gasto."
            )
        return None
