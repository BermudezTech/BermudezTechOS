from app.db.models.accounts import Account
from app.modules.sync.core.batch import BatchContext
from app.modules.sync.core.entity import Reference, SyncEntity
from app.modules.sync.core.reasons import RejectCode, Rejection
from app.modules.sync.core.references import ResolvedRefs
from app.modules.sync.core.sync_repository import SyncRepository
from app.modules.sync.entities.accounts.schemas import AccountRecord


class AccountsSyncEntity(SyncEntity[AccountRecord]):
    table = "accounts"
    model = Account
    record_schema = AccountRecord
    references = (Reference("parent_account_id", "accounts"),)
    self_reference = "parent_account_id"
    reference_fields = {"accounts": ("parent_account_id", "type")}

    async def prefetch(
        self, records: list[AccountRecord], repository: SyncRepository, refs: ResolvedRefs
    ) -> None:
        """Cuentas del lote que ya tienen subcuentas (en la base o en este mismo lote)."""
        candidates = {record.id for record in records if record.parent_account_id is not None}
        with_children = await repository.ids_with_children(Account, "parent_account_id", candidates)
        with_children |= {
            record.parent_account_id
            for record in records
            if record.parent_account_id is not None and record.deleted_at is None
        }
        refs.extra["has_children"] = with_children

    def check_coherence(
        self, record: AccountRecord, refs: ResolvedRefs, batch: BatchContext
    ) -> Rejection | None:
        if record.parent_account_id is None:
            return None
        if record.id in refs.extra.get("has_children", set()):
            return Rejection.of(
                RejectCode.INCOHERENT, "Una cuenta con subcuentas no puede ser subcuenta."
            )
        parent = refs.get("accounts", record.parent_account_id)
        if parent is not None and parent.parent_account_id is not None:
            return Rejection.of(
                RejectCode.INCOHERENT, "Las subcuentas solo admiten un nivel de profundidad."
            )
        return None
