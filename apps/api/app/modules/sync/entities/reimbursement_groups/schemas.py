from typing import Annotated, Literal

from pydantic import Field

from app.modules.sync.core.entity import SyncRecord


class ReimbursementGroupRecord(SyncRecord):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    payer: Annotated[str, Field(max_length=100)] | None = None
    kind: Literal["REIMBURSEMENT", "ADVANCE"]
    status: Literal["OPEN", "SUBMITTED", "SETTLED"] = "OPEN"
    notes: str | None = None
