"""Resolución agrupada de referencias de un lote (research S6, FR-010, FR-011)."""

import uuid
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

from app.modules.sync.core.batch import BatchContext
from app.modules.sync.core.entity import Reference, SyncEntity, SyncRecord
from app.modules.sync.core.reasons import RejectCode, Rejection
from app.modules.sync.core.sync_repository import SyncRepository


@dataclass
class ResolvedRefs:
    batch: BatchContext
    _rows: dict[str, dict[uuid.UUID, Any]] = field(default_factory=lambda: defaultdict(dict))
    # Datos adicionales que carga `SyncEntity.prefetch`.
    extra: dict[str, Any] = field(default_factory=dict)

    def get(self, table: str, record_id: uuid.UUID) -> Any | None:
        """La versión aplicada en el lote si la hay; si no, la fila de la base."""
        return self.batch.accepted(table, record_id) or self._rows.get(table, {}).get(record_id)

    def _found(self, table: str, record_id: uuid.UUID) -> bool:
        return record_id in self._rows.get(table, {})


async def resolve_references(
    entity: SyncEntity[Any],
    records: Sequence[SyncRecord],
    batch: BatchContext,
    repository: SyncRepository,
) -> ResolvedRefs:
    """Una consulta por tabla referenciada, solo para los IDs que el lote no resuelve."""
    from app.modules.sync.core.registry import ENTITY_BY_TABLE

    wanted: dict[str, set[uuid.UUID]] = defaultdict(set)
    for record in records:
        for reference in entity.references:
            value = getattr(record, reference.field)
            if value is None:
                continue
            if batch.accepted(reference.target, value) or batch.is_rejected(
                reference.target, value
            ):
                continue
            wanted[reference.target].add(value)

    refs = ResolvedRefs(batch)
    for target, ids in wanted.items():
        target_entity = ENTITY_BY_TABLE[target]
        fields = entity.reference_fields.get(target, ())
        refs._rows[target] = await repository.fetch_refs(target_entity.model, ids, fields)
    return refs


def check_reference(
    reference: Reference, value: uuid.UUID | None, refs: ResolvedRefs
) -> Rejection | None:
    if value is None:
        return None
    if refs.batch.is_rejected(reference.target, value):
        return Rejection.of(RejectCode.DEPENDENCY_REJECTED)
    if refs.batch.accepted(reference.target, value) or refs._found(reference.target, value):
        return None
    # Mismo mensaje exista o no el ID para otro usuario: no se revela nada ajeno.
    return Rejection.of(RejectCode.INVALID_REFERENCE)
