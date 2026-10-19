from app.db.models.reimbursement_groups import ReimbursementGroup
from app.modules.sync.core.entity import SyncEntity
from app.modules.sync.entities.reimbursement_groups.schemas import ReimbursementGroupRecord


class ReimbursementGroupsSyncEntity(SyncEntity[ReimbursementGroupRecord]):
    table = "reimbursement_groups"
    model = ReimbursementGroup
    record_schema = ReimbursementGroupRecord
