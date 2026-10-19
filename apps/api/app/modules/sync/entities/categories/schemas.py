from typing import Annotated, Literal

from pydantic import Field

from app.modules.sync.core.entity import SyncRecord


class CategoryRecord(SyncRecord):
    name: Annotated[str, Field(min_length=1, max_length=50)]
    kind: Literal["INCOME", "EXPENSE"]
    icon: Annotated[str, Field(max_length=50)] | None = None
    color: Annotated[str, Field(max_length=50)] | None = None
    sort_order: int = 0
