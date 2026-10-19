from app.db.models.transactions import Transaction
from app.modules.sync.core.batch import BatchContext
from app.modules.sync.core.entity import Reference, SyncEntity
from app.modules.sync.core.reasons import RejectCode, Rejection
from app.modules.sync.core.references import ResolvedRefs
from app.modules.sync.entities.transactions.schemas import TransactionRecord


class TransactionsSyncEntity(SyncEntity[TransactionRecord]):
    table = "transactions"
    model = Transaction
    record_schema = TransactionRecord
    references = (
        Reference("account_id", "accounts"),
        Reference("counter_account_id", "accounts"),
        Reference("category_id", "categories"),
        Reference("reimbursement_group_id", "reimbursement_groups"),
        Reference("subscription_id", "subscriptions"),
        Reference("recurring_income_id", "recurring_incomes"),
        Reference("cdt_id", "cdts"),
    )
    reference_fields = {"categories": ("kind",)}
    # Un débito por periodo de suscripción; con el mismo UUIDv5 el caso cae en LWW.
    constraint_codes = {"uq_transactions_subscription_id_subscription_period": RejectCode.DUPLICATE}

    def check_coherence(
        self, record: TransactionRecord, refs: ResolvedRefs, batch: BatchContext
    ) -> Rejection | None:
        if record.category_id is None:
            return None
        category = refs.get("categories", record.category_id)
        if category is not None and category.kind != record.type:
            label = "un gasto" if record.type == "EXPENSE" else "un ingreso"
            kind = "gasto" if record.type == "EXPENSE" else "ingreso"
            return Rejection.of(
                RejectCode.INCOHERENT, f"La categoría de {label} debe ser de tipo {kind}."
            )
        return None
