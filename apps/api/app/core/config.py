"""Configuración de la API, leída de variables de entorno (y `.env` en desarrollo)."""

from datetime import timedelta
from functools import lru_cache
from typing import Annotated, Self

from pydantic import Field, SecretStr, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

ACCESS_TOKEN_TTL = timedelta(minutes=15)
REFRESH_TOKEN_TTL = timedelta(days=7)
RESET_CODE_TTL = timedelta(minutes=30)
RESET_GRANT_TTL = timedelta(minutes=10)

_MIN_SECRET_LENGTH = 32


class ConfigError(Exception):
    """Configuración inválida. El mensaje nombra las variables, nunca sus valores."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
        hide_input_in_errors=True,
    )

    database_url: str
    jwt_secret: SecretStr
    password_reset_pepper: SecretStr

    resend_api_key: SecretStr | None = None
    mail_from: str | None = None

    initial_user_email: str | None = None
    initial_user_password: SecretStr | None = None
    initial_user_display_name: str | None = None

    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)
    docs_enabled: bool = False
    log_level: str = "INFO"

    @field_validator("database_url")
    @classmethod
    def _check_database_url(cls, value: str) -> str:
        if not value.startswith("postgresql+asyncpg://"):
            raise ValueError("debe empezar por postgresql+asyncpg://")
        return value

    @field_validator("jwt_secret", "password_reset_pepper")
    @classmethod
    def _check_secret_length(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < _MIN_SECRET_LENGTH:
            raise ValueError(f"debe tener al menos {_MIN_SECRET_LENGTH} caracteres")
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def _check_mail(self) -> Self:
        if self.resend_api_key is not None and not self.mail_from:
            raise ValueError("MAIL_FROM es obligatoria cuando RESEND_API_KEY está definida")
        return self

    @property
    def mail_configured(self) -> bool:
        return self.resend_api_key is not None and bool(self.mail_from)


def describe_validation_error(error: ValidationError) -> str:
    parts: list[str] = []
    for item in error.errors():
        variable = ".".join(str(loc) for loc in item["loc"]).upper()
        message = item["msg"].removeprefix("Value error, ")
        if item["type"] == "missing":
            message = "es obligatoria"
        parts.append(f"{variable} {message}" if variable else message)
    return "Configuración inválida: " + "; ".join(parts) + "."


def load_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as error:
        raise ConfigError(describe_validation_error(error)) from None


@lru_cache
def get_settings() -> Settings:
    return load_settings()
