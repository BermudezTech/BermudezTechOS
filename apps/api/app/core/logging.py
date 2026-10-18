"""Configuración de logs con un filtro que oculta datos sensibles (SC-006)."""

import logging
from collections.abc import Mapping
from typing import Any

SENSITIVE_KEYS = frozenset(
    {
        "password",
        "password_hash",
        "new_password",
        "token",
        "refresh_token",
        "access_token",
        "reset_token",
        "code",
        "code_hash",
        "grant_hash",
        "authorization",
    }
)
REDACTED = "[REDACTED]"

_STANDARD_ATTRS = frozenset(logging.makeLogRecord({}).__dict__) | {"message", "asctime"}


def _redact(value: Mapping[str, Any]) -> dict[str, Any]:
    return {key: REDACTED if key.lower() in SENSITIVE_KEYS else item for key, item in value.items()}


class SensitiveDataFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        for key in list(record.__dict__):
            if key not in _STANDARD_ATTRS and key.lower() in SENSITIVE_KEYS:
                setattr(record, key, REDACTED)
        if isinstance(record.args, Mapping):
            record.args = _redact(record.args)
        elif isinstance(record.args, tuple):
            record.args = tuple(
                _redact(arg) if isinstance(arg, Mapping) else arg for arg in record.args
            )
        return True


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    handler.addFilter(SensitiveDataFilter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())
