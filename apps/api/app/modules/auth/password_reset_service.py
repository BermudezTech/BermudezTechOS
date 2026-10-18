"""Recuperación de contraseña: código de 6 dígitos por correo → permiso → contraseña nueva.

Las respuestas nunca revelan si el correo existe: pedir el código responde siempre igual y el
envío ocurre en segundo plano, así que el tiempo de respuesta tampoco lo delata.
"""

import logging
import uuid
from datetime import timedelta

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.core.config import RESET_CODE_TTL, RESET_GRANT_TTL
from app.core.database import SessionFactory
from app.core.errors import InvalidCodeError, InvalidResetTokenError
from app.core.security import (
    constant_time_equals,
    hash_password,
    hash_reset_code,
    new_opaque_token,
    new_reset_code,
    normalize_email,
    sha256_hex,
)
from app.modules.auth.login_throttle import LoginThrottle
from app.modules.auth.repositories import PasswordResetRepository, RefreshTokenRepository
from app.modules.auth.schemas import VerifyCodeResponse
from app.modules.mail.mail_service import MailDeliveryError, MailSender
from app.modules.users.users_repository import UsersRepository

logger = logging.getLogger(__name__)

MAX_REQUESTS_PER_HOUR = 3
MAX_CODE_ATTEMPTS = 5


class PasswordResetService:
    def __init__(
        self,
        session: AsyncSession,
        users: UsersRepository,
        resets: PasswordResetRepository,
        refresh_tokens: RefreshTokenRepository,
        throttle: LoginThrottle,
        mail: MailSender,
        clock: Clock,
        session_factory: SessionFactory,
    ) -> None:
        self._session = session
        self._users = users
        self._resets = resets
        self._refresh_tokens = refresh_tokens
        self._throttle = throttle
        self._mail = mail
        self._clock = clock
        self._session_factory = session_factory

    async def request_reset(self, email: str, background_tasks: BackgroundTasks) -> None:
        now = self._clock.now()
        user = await self._users.get_by_email(normalize_email(email))
        if user is None:
            return
        if await self._resets.count_since(user.id, now - timedelta(hours=1)) >= (
            MAX_REQUESTS_PER_HOUR
        ):
            return

        # Solo sirve el código más reciente.
        await self._resets.invalidate_active(user.id, now)
        code = new_reset_code()
        row = await self._resets.create(
            user.id, hash_reset_code(user.id, code), now + RESET_CODE_TTL, now
        )
        if not self._mail.is_configured:
            await self._resets.mark_invalidated(row.id, now)
            logger.warning("Envío de correo no configurado: no se envió el código de recuperación")
            return
        # Confirmar antes del envío: la tarea en segundo plano usa otra sesión.
        await self._session.commit()
        background_tasks.add_task(self._deliver, row.id, user.email, code, user.display_name)

    async def _deliver(
        self, row_id: uuid.UUID, email: str, code: str, display_name: str | None
    ) -> None:
        try:
            await self._mail.send_reset_code(email, code, display_name)
        except MailDeliveryError as error:
            # Un código que no se pudo enviar no debe quedar vigente.
            logger.error("No se pudo enviar el código de recuperación: %s", error)
            async with self._session_factory() as session:
                await PasswordResetRepository(session).mark_invalidated(row_id, self._clock.now())
                await session.commit()

    async def verify_code(self, email: str, code: str) -> VerifyCodeResponse:
        now = self._clock.now()
        user = await self._users.get_by_email(normalize_email(email))
        if user is None:
            raise InvalidCodeError()
        row = await self._resets.latest_active_for_update(user.id, now)
        if row is None:
            raise InvalidCodeError()

        if not constant_time_equals(hash_reset_code(user.id, code), row.code_hash):
            row.failed_attempts += 1
            if row.failed_attempts >= MAX_CODE_ATTEMPTS:
                row.invalidated_at = now
            # El intento fallido debe contar aunque la solicitud termine en error.
            await self._session.commit()
            raise InvalidCodeError()

        grant = new_opaque_token()
        row.used_at = now
        row.grant_hash = sha256_hex(grant)
        row.grant_expires_at = now + RESET_GRANT_TTL
        await self._session.flush()
        return VerifyCodeResponse(reset_token=grant)

    async def reset_password(self, reset_token: str, new_password: str) -> None:
        now = self._clock.now()
        row = await self._resets.get_by_grant_hash_for_update(sha256_hex(reset_token))
        if (
            row is None
            or row.grant_used_at is not None
            or row.grant_expires_at is None
            or row.grant_expires_at <= now
        ):
            raise InvalidResetTokenError()
        user = await self._users.get_by_id(row.user_id)
        if user is None:
            raise InvalidResetTokenError()

        await self._users.update_password(user, hash_password(new_password), now)
        row.grant_used_at = now
        await self._refresh_tokens.revoke_all_for_user(user.id, now)
        await self._throttle.clear_email(user.email)
        await self._session.flush()
