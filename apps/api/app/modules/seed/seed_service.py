"""Seed del primer usuario a partir de variables de entorno (FR-006, FR-006a)."""

import logging
from enum import Enum

from email_validator import EmailNotValidError, validate_email

from app.core.config import Settings
from app.core.security import PASSWORD_MAX, PASSWORD_MIN, normalize_email
from app.modules.users.user_registration_service import UserRegistrationService
from app.modules.users.users_repository import UsersRepository

logger = logging.getLogger(__name__)

_DISPLAY_NAME_MAX = 100


class SeedResult(Enum):
    CREATED = "created"
    SKIPPED = "skipped"


class SeedConfigError(Exception):
    """Variables del usuario inicial faltantes o inválidas. Nombra la variable, nunca su valor."""


class SeedService:
    def __init__(
        self, users: UsersRepository, registration: UserRegistrationService, settings: Settings
    ) -> None:
        self._users = users
        self._registration = registration
        self._settings = settings

    async def run(self) -> SeedResult:
        # Con al menos un usuario no se leen las variables: pueden faltar o haber cambiado.
        if await self._users.exists_any():
            logger.info("Seed omitida: ya existe un usuario")
            return SeedResult.SKIPPED

        email, password, display_name = self._read_variables()
        await self._registration.register(email, password, display_name)
        logger.info("Usuario inicial creado: %s", email)
        return SeedResult.CREATED

    def _read_variables(self) -> tuple[str, str, str | None]:
        raw_email = self._settings.initial_user_email
        if not raw_email:
            raise SeedConfigError("INITIAL_USER_EMAIL es obligatoria cuando no hay usuarios.")
        try:
            validate_email(raw_email.strip(), check_deliverability=False)
        except EmailNotValidError:
            raise SeedConfigError("INITIAL_USER_EMAIL no es un correo válido.") from None

        secret = self._settings.initial_user_password
        password = secret.get_secret_value() if secret else ""
        if not password:
            raise SeedConfigError("INITIAL_USER_PASSWORD es obligatoria cuando no hay usuarios.")
        if not PASSWORD_MIN <= len(password) <= PASSWORD_MAX:
            raise SeedConfigError(
                "INITIAL_USER_PASSWORD debe tener entre "
                f"{PASSWORD_MIN} y {PASSWORD_MAX} caracteres."
            )

        display_name = (self._settings.initial_user_display_name or "").strip() or None
        if display_name is not None and len(display_name) > _DISPLAY_NAME_MAX:
            raise SeedConfigError(
                f"INITIAL_USER_DISPLAY_NAME debe tener como máximo {_DISPLAY_NAME_MAX} caracteres."
            )
        return normalize_email(raw_email), password, display_name
