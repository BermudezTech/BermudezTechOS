"""Contrato que implementa cada tabla sincronizable (`entities/<tabla>/entity.py`).

Una entidad declara cómo se sincroniza su tabla; el núcleo hace el resto (orden, referencias,
LWW, cursores). Agregar una tabla al sync = crear su carpeta y registrarla en `registry.py`.
"""

import uuid
from dataclasses import dataclass
from typing import TYPE_CHECKING, Annotated, Any, ClassVar

from pydantic import AwareDatetime, ConfigDict, PlainSerializer

from app.common.schemas import CamelModel, _to_utc_z
from app.modules.sync.core.reasons import RejectCode, Rejection

if TYPE_CHECKING:
    from app.modules.sync.core.batch import BatchContext
    from app.modules.sync.core.references import ResolvedRefs
    from app.modules.sync.core.sync_repository import SyncRepository

# Fecha y hora con zona obligatoria (se rechaza una hora sin zona), serializada en UTC con `Z`.
SyncDateTime = Annotated[
    AwareDatetime, PlainSerializer(_to_utc_z, return_type=str, when_used="json")
]


class SyncRecord(CamelModel):
    """Base de todo registro de sync: mismo formato en PUSH y PULL (FR-020).

    `userId` e `isDirty` se ignoran si llegan; `serverUpdatedAt` se ignora al recibir (lo asigna el
    servidor) y siempre se entrega en el PULL.
    """

    model_config = ConfigDict(extra="ignore")

    id: uuid.UUID
    created_at: SyncDateTime
    updated_at: SyncDateTime
    deleted_at: SyncDateTime | None = None
    server_updated_at: SyncDateTime | None = None


@dataclass(frozen=True)
class Reference:
    """Campo del registro que apunta a otra tabla sincronizable del mismo usuario."""

    field: str
    target: str


class SyncEntity[RecordT: SyncRecord]:
    table: ClassVar[str]
    # Modelo SQLAlchemy existente (con `UserOwnedMixin` + `SyncColumnsMixin`).
    model: ClassVar[type[Any]]
    record_schema: ClassVar[type[SyncRecord]]
    references: ClassVar[tuple[Reference, ...]] = ()
    # Campo de autorreferencia: los registros del lote se ordenan padre → hijo.
    self_reference: ClassVar[str | None] = None
    # Columnas que se traen de cada tabla referenciada para evaluar la coherencia.
    reference_fields: ClassVar[dict[str, tuple[str, ...]]] = {}
    # Nombre de restricción de la base → código de rechazo.
    constraint_codes: ClassVar[dict[str, RejectCode]] = {}

    async def prefetch(
        self, records: list[RecordT], repository: "SyncRepository", refs: "ResolvedRefs"
    ) -> None:
        """Gancho opcional: carga en `refs.extra` datos adicionales para `check_coherence`."""

    def check_coherence(
        self, record: RecordT, refs: "ResolvedRefs", batch: "BatchContext"
    ) -> Rejection | None:
        """Reglas de coherencia con los registros referenciados (FR-009a). `None` = coherente."""
        return None

    def to_record(self, row: Any) -> SyncRecord:
        """Fila de la base → registro, sin validar: el PULL nunca falla por datos ya guardados."""
        fields = self.record_schema.model_fields
        return self.record_schema.model_construct(**{name: getattr(row, name) for name in fields})
