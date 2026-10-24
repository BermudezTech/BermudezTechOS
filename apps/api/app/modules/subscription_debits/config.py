"""Configuración del servicio de cobros. Aparte de `Settings`: el worker no recibe los secretos de
autenticación de la API (research R12)."""

import re
from datetime import date, time

from pydantic import ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config import ConfigError, describe_validation_error

_RUN_TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class BillingSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
        hide_input_in_errors=True,
    )

    database_url: str
    # Nunca se cobra una fecha anterior (FR-007a).
    billing_activation_date: date
    # Hora diaria en hora de Bogotá.
    billing_run_time: time = time(0, 5)
    log_level: str = "INFO"

    @field_validator("database_url")
    @classmethod
    def _check_database_url(cls, value: str) -> str:
        if not value.startswith("postgresql+asyncpg://"):
            raise ValueError("debe empezar por postgresql+asyncpg://")
        return value

    @field_validator("billing_run_time", mode="before")
    @classmethod
    def _check_run_time(cls, value: object) -> object:
        if isinstance(value, str) and not _RUN_TIME.match(value):
            raise ValueError("debe tener el formato HH:MM")
        return value


def load_billing_settings() -> BillingSettings:
    try:
        return BillingSettings()
    except ValidationError as error:
        raise ConfigError(describe_validation_error(error)) from None
