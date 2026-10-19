"""DTOs de las rutas de sync (contracts/http-api.md).

Los registros del PUSH llegan como objetos sin validar: cada uno se valida por separado con el
esquema de su entidad, para que un registro inválido no tumbe el lote (Clarificación 1).
"""

import uuid
from typing import Any

from pydantic import SerializerFunctionWrapHandler, model_serializer

from app.common.schemas import CamelModel, UtcDateTime
from app.modules.sync.core.reasons import RecordStatus, RejectCode
from app.modules.sync.core.registry import TableName


class PushRequest(CamelModel):
    changes: dict[TableName, list[dict[str, Any]]]


class RecordResult(CamelModel):
    table: TableName
    # `null` si el registro no traía un UUID válido.
    id: uuid.UUID | None
    status: RecordStatus
    code: RejectCode | None = None
    message: str | None = None
    details: list[dict[str, Any]] | None = None

    @model_serializer(mode="wrap")
    def _omit_empty_reason(self, handler: SerializerFunctionWrapHandler) -> dict[str, Any]:
        """`code`, `message` y `details` solo aparecen en los rechazos."""
        data: dict[str, Any] = handler(self)
        return {
            key: value
            for key, value in data.items()
            if value is not None or key not in _OPTIONAL_REASON
        }


_OPTIONAL_REASON = frozenset({"code", "message", "details"})


class PushResponse(CamelModel):
    results: list[RecordResult]
    server_time: UtcDateTime


class PullRequest(CamelModel):
    cursors: dict[TableName, str | None] = {}


class TablePage(CamelModel):
    records: list[dict[str, Any]]
    cursor: str | None
    has_more: bool


class PullResponse(CamelModel):
    # Las 8 tablas, en orden de dependencias.
    changes: dict[TableName, TablePage]
    has_more: bool
