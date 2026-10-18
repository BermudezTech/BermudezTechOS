"""Repositorios de autenticación: tokens de renovación y códigos de recuperación."""

import uuid
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.auth import PasswordResetCode, RefreshToken


class RefreshTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime,
        now: datetime,
    ) -> RefreshToken:
        token = RefreshToken(
            id=uuid.uuid4(),
            user_id=user_id,
            session_id=session_id,
            token_hash=token_hash,
            expires_at=expires_at,
            created_at=now,
        )
        self._session.add(token)
        await self._session.flush()
        return token

    async def get_by_hash_for_update(self, token_hash: str) -> RefreshToken | None:
        query = select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update()
        return (await self._session.scalars(query)).one_or_none()

    async def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        query = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        return (await self._session.scalars(query)).one_or_none()

    async def mark_rotated(
        self, token: RefreshToken, successor_id: uuid.UUID, now: datetime
    ) -> None:
        token.revoked_at = now
        token.replaced_by_id = successor_id
        await self._session.flush()

    async def revoke_session(self, session_id: uuid.UUID, now: datetime) -> None:
        """Revoca todos los tokens de una sesión (un dispositivo); las demás siguen activas."""
        await self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.session_id == session_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )

    async def revoke_all_for_user(self, user_id: uuid.UUID, now: datetime) -> None:
        await self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )


class PasswordResetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def count_since(self, user_id: uuid.UUID, since: datetime) -> int:
        query = select(func.count()).where(
            PasswordResetCode.user_id == user_id, PasswordResetCode.created_at > since
        )
        return await self._session.scalar(query) or 0

    async def invalidate_active(self, user_id: uuid.UUID, now: datetime) -> None:
        await self._session.execute(
            update(PasswordResetCode)
            .where(
                PasswordResetCode.user_id == user_id,
                PasswordResetCode.used_at.is_(None),
                PasswordResetCode.invalidated_at.is_(None),
            )
            .values(invalidated_at=now)
        )

    async def create(
        self, user_id: uuid.UUID, code_hash: str, expires_at: datetime, now: datetime
    ) -> PasswordResetCode:
        row = PasswordResetCode(
            id=uuid.uuid4(),
            user_id=user_id,
            code_hash=code_hash,
            expires_at=expires_at,
            failed_attempts=0,
            created_at=now,
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def latest_active_for_update(
        self, user_id: uuid.UUID, now: datetime
    ) -> PasswordResetCode | None:
        query = (
            select(PasswordResetCode)
            .where(
                PasswordResetCode.user_id == user_id,
                PasswordResetCode.used_at.is_(None),
                PasswordResetCode.invalidated_at.is_(None),
                PasswordResetCode.expires_at > now,
            )
            .order_by(PasswordResetCode.created_at.desc())
            .limit(1)
            .with_for_update()
        )
        return (await self._session.scalars(query)).one_or_none()

    async def get_by_grant_hash_for_update(self, grant_hash: str) -> PasswordResetCode | None:
        query = (
            select(PasswordResetCode)
            .where(PasswordResetCode.grant_hash == grant_hash)
            .with_for_update()
        )
        return (await self._session.scalars(query)).one_or_none()

    async def mark_invalidated(self, row_id: uuid.UUID, now: datetime) -> None:
        await self._session.execute(
            update(PasswordResetCode)
            .where(PasswordResetCode.id == row_id)
            .values(invalidated_at=now)
        )
