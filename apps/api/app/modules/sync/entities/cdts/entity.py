from app.db.models.cdts import Cdt
from app.modules.sync.core.batch import BatchContext
from app.modules.sync.core.entity import Reference, SyncEntity
from app.modules.sync.core.reasons import RejectCode, Rejection
from app.modules.sync.core.references import ResolvedRefs
from app.modules.sync.entities.cdts.schemas import CdtRecord


class CdtsSyncEntity(SyncEntity[CdtRecord]):
    table = "cdts"
    model = Cdt
    record_schema = CdtRecord
    references = (
        Reference("account_id", "accounts"),
        Reference("source_account_id", "accounts"),
        Reference("payout_account_id", "accounts"),
        Reference("renewed_from_cdt_id", "cdts"),
    )
    self_reference = "renewed_from_cdt_id"
    reference_fields = {"accounts": ("type",), "cdts": ("account_id",)}

    def check_coherence(
        self, record: CdtRecord, refs: ResolvedRefs, batch: BatchContext
    ) -> Rejection | None:
        if record.source_account_id is not None and record.source_account_id == record.account_id:
            return Rejection.of(
                RejectCode.INCOHERENT,
                "La cuenta de origen del capital debe ser distinta de la cuenta del CDT.",
            )
        account = refs.get("accounts", record.account_id)
        if account is not None and account.type != "INVESTMENT":
            return Rejection.of(
                RejectCode.INCOHERENT, "La cuenta de un CDT debe ser de tipo INVESTMENT."
            )
        if record.renewed_from_cdt_id is not None:
            # Los periodos de una cadena de renovaciones comparten la cuenta INVESTMENT.
            previous = refs.get("cdts", record.renewed_from_cdt_id)
            if previous is not None and previous.account_id != record.account_id:
                return Rejection.of(
                    RejectCode.INCOHERENT,
                    "La renovación debe usar la misma cuenta del CDT anterior.",
                )
        return None
