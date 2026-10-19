"""Estado de un lote de PUSH mientras se aplica (research S6)."""

import uuid
from collections import defaultdict
from dataclasses import dataclass, field

from app.modules.sync.core.entity import SyncRecord
from app.modules.sync.core.reasons import RecordStatus, RejectCode, Rejection


@dataclass
class Outcome:
    table: str
    id: uuid.UUID | None
    status: RecordStatus
    rejection: Rejection | None = None


@dataclass
class BatchContext:
    # Registros aplicados en este lote (su versión es la vigente), por tabla.
    _accepted: dict[str, dict[uuid.UUID, SyncRecord]] = field(
        default_factory=lambda: defaultdict(dict)
    )
    _rejected: dict[str, dict[uuid.UUID, RejectCode]] = field(
        default_factory=lambda: defaultdict(dict)
    )
    # Resultado por posición del registro en la petición, para responder en el mismo orden.
    _outcomes: dict[int, Outcome] = field(default_factory=dict)

    def applied(self, position: int, table: str, record: SyncRecord) -> None:
        self._accepted[table][record.id] = record
        self._outcomes[position] = Outcome(table, record.id, RecordStatus.APPLIED)

    def discarded(self, position: int, table: str, record_id: uuid.UUID) -> None:
        self._outcomes[position] = Outcome(table, record_id, RecordStatus.DISCARDED)

    def rejected(
        self, position: int, table: str, record_id: uuid.UUID | None, rejection: Rejection
    ) -> None:
        if record_id is not None:
            self._rejected[table][record_id] = rejection.code
        self._outcomes[position] = Outcome(table, record_id, RecordStatus.REJECTED, rejection)

    def is_rejected(self, table: str, record_id: uuid.UUID) -> bool:
        return record_id in self._rejected.get(table, {})

    def accepted(self, table: str, record_id: uuid.UUID) -> SyncRecord | None:
        return self._accepted.get(table, {}).get(record_id)

    def accepted_records(self, table: str) -> list[SyncRecord]:
        return list(self._accepted.get(table, {}).values())

    def outcomes(self) -> list[Outcome]:
        return [self._outcomes[position] for position in sorted(self._outcomes)]
