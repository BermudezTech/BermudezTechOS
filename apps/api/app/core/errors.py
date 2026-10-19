"""Errores de la aplicación y el sobre común `{"error": {code, message, details}}`."""

import logging
from collections.abc import Sequence
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic.alias_generators import to_camel
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: list[dict[str, Any]] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        self.headers = headers


class UnauthenticatedError(AppError):
    def __init__(self) -> None:
        super().__init__(
            401,
            "UNAUTHENTICATED",
            "Debes iniciar sesión.",
            headers={"WWW-Authenticate": "Bearer"},
        )


class NotFoundError(AppError):
    def __init__(self, message: str = "No encontrado.") -> None:
        super().__init__(404, "NOT_FOUND", message)


class InvalidCredentialsError(AppError):
    def __init__(self) -> None:
        super().__init__(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.")


class TooManyAttemptsError(AppError):
    def __init__(self, retry_after: int) -> None:
        super().__init__(
            429,
            "TOO_MANY_ATTEMPTS",
            "Demasiados intentos fallidos. Intenta de nuevo más tarde.",
            headers={"Retry-After": str(retry_after)},
        )


class InvalidRefreshTokenError(AppError):
    def __init__(self) -> None:
        super().__init__(
            401,
            "INVALID_REFRESH_TOKEN",
            "La sesión expiró o no es válida. Inicia sesión de nuevo.",
        )


class InvalidCodeError(AppError):
    def __init__(self) -> None:
        super().__init__(400, "INVALID_CODE", "El código no es válido o ya expiró.")


class InvalidResetTokenError(AppError):
    def __init__(self) -> None:
        super().__init__(
            400,
            "INVALID_RESET_TOKEN",
            "El permiso para cambiar la contraseña no es válido o ya expiró.",
        )


def _envelope(
    status_code: int,
    code: str,
    message: str,
    details: list[dict[str, Any]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details}},
        headers=headers,
    )


_VALIDATION_MESSAGES = {
    "missing": "Este campo es obligatorio.",
    "string_too_short": "Debe tener al menos {min_length} caracteres.",
    "string_too_long": "Debe tener como máximo {max_length} caracteres.",
    "string_pattern_mismatch": "El formato no es válido.",
    "value_error": "El valor no es válido.",
    "json_invalid": "El cuerpo no es un JSON válido.",
}


def _validation_message(error: dict[str, Any]) -> str:
    message = error.get("ctx", {}).get("error")
    if isinstance(message, ValueError) and str(message):
        return str(message)
    template = _VALIDATION_MESSAGES.get(error["type"])
    if template is None:
        return "El valor no es válido."
    try:
        return template.format(**error.get("ctx", {}))
    except KeyError:
        return "El valor no es válido."


def _field_name(location: tuple[Any, ...]) -> str:
    parts = [str(part) for part in location if part not in ("body", "query", "path")]
    return ".".join(to_camel(part) for part in parts)


def validation_details(errors: Sequence[Any]) -> list[dict[str, Any]]:
    """Errores de Pydantic → `[{field, message}]` en camelCase y en español."""
    return [
        {"field": _field_name(tuple(error["loc"])), "message": _validation_message(error)}
        for error in errors
    ]


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return _envelope(exc.status_code, exc.code, exc.message, exc.details, exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return _envelope(
            422, "VALIDATION_ERROR", "Datos inválidos.", validation_details(exc.errors())
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        if exc.status_code == 404:
            return _envelope(404, "NOT_FOUND", "No encontrado.")
        if exc.status_code == 405:
            return _envelope(405, "METHOD_NOT_ALLOWED", "Método no permitido.")
        return _envelope(exc.status_code, "HTTP_ERROR", str(exc.detail))

    @app.exception_handler(Exception)
    async def _unexpected_error(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Error inesperado", exc_info=exc)
        return _envelope(500, "INTERNAL_ERROR", "Ocurrió un error inesperado.")
