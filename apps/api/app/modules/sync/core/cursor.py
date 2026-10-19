"""Cursor opaco del PULL: posición `(server_updated_at, id)` del último registro entregado (S3).

La app lo guarda y lo devuelve sin interpretarlo; así el mecanismo puede cambiar sin tocarla.
"""

import base64
import binascii
import json
import uuid
from datetime import UTC, datetime

from app.core.errors import AppError


class InvalidCursorError(AppError):
    def __init__(self, table: str) -> None:
        super().__init__(
            422,
            "INVALID_CURSOR",
            "El cursor de sincronización no es válido. Sincroniza esta tabla desde cero.",
            details=[{"table": table}],
        )


class _MalformedCursor(ValueError):
    pass


def encode_cursor(server_updated_at: datetime, record_id: uuid.UUID) -> str:
    payload = {"t": server_updated_at.astimezone(UTC).isoformat(), "id": str(record_id)}
    raw = json.dumps(payload, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def decode_cursor(value: str) -> tuple[datetime, uuid.UUID]:
    """Lanza `ValueError` si el cursor está mal formado; el servicio lo traduce por tabla."""
    try:
        padded = value + "=" * (-len(value) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode()))
        if not isinstance(payload, dict):
            raise _MalformedCursor
        moment = datetime.fromisoformat(payload["t"])
        if moment.tzinfo is None:
            raise _MalformedCursor
        return moment, uuid.UUID(payload["id"])
    except (KeyError, TypeError, ValueError, binascii.Error, UnicodeDecodeError) as exc:
        raise ValueError("Cursor mal formado") from exc
