from datetime import date
from typing import Annotated

from pydantic import Field

from app.common.schemas import MoneyStr
from app.modules.sync.core.entity import SyncRecord


class AssetRecord(SyncRecord):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    value: Annotated[MoneyStr, Field(ge=0)]
    valid_until: date
