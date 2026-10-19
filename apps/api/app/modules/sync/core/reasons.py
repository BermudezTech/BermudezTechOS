"""Estados y motivos del resultado por registro del PUSH (data-model.md §3)."""

from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class RecordStatus(StrEnum):
    APPLIED = "APPLIED"
    DISCARDED = "DISCARDED"
    REJECTED = "REJECTED"


class RejectCode(StrEnum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    INVALID_REFERENCE = "INVALID_REFERENCE"
    DEPENDENCY_REJECTED = "DEPENDENCY_REJECTED"
    INCOHERENT = "INCOHERENT"
    DUPLICATE = "DUPLICATE"
    ID_CONFLICT = "ID_CONFLICT"
    CLOCK_AHEAD = "CLOCK_AHEAD"


DEFAULT_MESSAGES: dict[RejectCode, str] = {
    RejectCode.VALIDATION_ERROR: "El registro tiene datos inválidos.",
    RejectCode.INVALID_REFERENCE: "El registro hace referencia a otro que no existe.",
    RejectCode.DEPENDENCY_REJECTED: "El registro depende de otro que fue rechazado en este lote.",
    RejectCode.INCOHERENT: "El registro no es coherente con los registros que referencia.",
    RejectCode.DUPLICATE: "Ya existe un registro con esos datos.",
    # Genérico a propósito: no revela que el ID pertenece a otro usuario.
    RejectCode.ID_CONFLICT: "No se pudo guardar este registro.",
    RejectCode.CLOCK_AHEAD: (
        "La fecha de modificación está en el futuro. Revisa la fecha y hora del dispositivo."
    ),
}


@dataclass(frozen=True)
class Rejection:
    code: RejectCode
    message: str
    details: list[dict[str, Any]] | None = None

    @classmethod
    def of(cls, code: RejectCode, message: str | None = None) -> "Rejection":
        return cls(code, message or DEFAULT_MESSAGES[code])
