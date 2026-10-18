import uuid
from typing import Literal

from pydantic import ConfigDict

from app.common.schemas import CamelModel, UtcDateTime


class CategoryOut(CamelModel):
    # Sin `user_id`: nunca sale del servidor (FR-019).
    model_config = ConfigDict(extra="ignore")

    id: uuid.UUID
    name: str
    kind: Literal["INCOME", "EXPENSE"]
    icon: str | None
    color: str | None
    sort_order: int
    created_at: UtcDateTime
    updated_at: UtcDateTime
    deleted_at: UtcDateTime | None
    server_updated_at: UtcDateTime


class CategoryList(CamelModel):
    items: list[CategoryOut]
