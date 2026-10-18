"""Inicio de sesión, renovación y cierre de sesión."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.core.config import REFRESH_TOKEN_TTL
from app.core.errors import InvalidCredentialsError, InvalidRefreshTokenError
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    new_opaque_token,
    normalize_email,
    sha256_hex,
    verify_password,
)
from app.db.models.auth import RefreshToken
from app.db.models.users import User
from app.modules.auth.login_throttle import LoginThrottle
from app.modules.auth.repositories import RefreshTokenRepository
from app.modules.auth.schemas import TokenPair
from app.modules.users.users_repository import UsersRepository


class AuthService:
    def __init__(
        self,
        session: AsyncSession,
        users: UsersRepository,
        refresh_tokens: RefreshTokenRepository,
        throttle: LoginThrottle,
        clock: Clock,
    ) -> None:
        self._session = session
        self._users = users
        self._refresh_tokens = refresh_tokens
        self._throttle = throttle
        self._clock = clock

    async def login(self, email: str, password: str, ip: str) -> TokenPair:
        email = normalize_email(email)
        await self._throttle.check(email, ip)

        user = await self._users.get_by_email(email)
        # Sin usuario se verifica igual contra un hash fijo: mismo tiempo de respuesta.
        valid = verify_password(password, user.password_hash if user else DUMMY_PASSWORD_HASH)
        if user is None or not valid:
            await self._throttle.record_failure(email, ip)
            # El fallo debe quedar guardado aunque la solicitud termine en error.
            await self._session.commit()
            raise InvalidCredentialsError()

        await self._throttle.clear(email, ip)
        return await self._issue_tokens(user, session_id=uuid.uuid4())

    async def refresh(self, refresh_token: str) -> TokenPair:
        now = self._clock.now()
        # FOR UPDATE: dos renovaciones simultáneas del mismo token se serializan.
        token = await self._refresh_tokens.get_by_hash_for_update(sha256_hex(refresh_token))
        if token is None:
            raise InvalidRefreshTokenError()
        if token.replaced_by_id is not None:
            # Reutilización de un token ya rotado: se cierra solo esa sesión (dispositivo).
            await self._refresh_tokens.revoke_session(token.session_id, now)
            await self._session.commit()
            raise InvalidRefreshTokenError()
        if token.revoked_at is not None or token.expires_at <= now:
            raise InvalidRefreshTokenError()

        user = await self._users.get_by_id(token.user_id)
        if user is None:
            raise InvalidRefreshTokenError()
        pair, successor = await self._issue_tokens_with_row(user, token.session_id)
        await self._refresh_tokens.mark_rotated(token, successor.id, now)
        return pair

    async def logout(self, user: User, refresh_token: str) -> None:
        """Cierra la sesión del token si es del usuario. Nunca revela si el token existe."""
        token = await self._refresh_tokens.get_by_hash(sha256_hex(refresh_token))
        if token is not None and token.user_id == user.id:
            await self._refresh_tokens.revoke_session(token.session_id, self._clock.now())

    async def _issue_tokens(self, user: User, session_id: uuid.UUID) -> TokenPair:
        pair, _ = await self._issue_tokens_with_row(user, session_id)
        return pair

    async def _issue_tokens_with_row(
        self, user: User, session_id: uuid.UUID
    ) -> tuple[TokenPair, RefreshToken]:
        now = self._clock.now()
        refresh_token = new_opaque_token()
        row = await self._refresh_tokens.create(
            user_id=user.id,
            session_id=session_id,
            token_hash=sha256_hex(refresh_token),
            expires_at=now + REFRESH_TOKEN_TTL,
            now=now,
        )
        pair = TokenPair(
            access_token=create_access_token(user.id, now), refresh_token=refresh_token
        )
        return pair, row
