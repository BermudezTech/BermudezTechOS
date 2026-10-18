"""Bloqueo de inicio de sesión por correo + IP (FR-014): 5 fallos en 15 min bloquean 15 min."""

import math
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.core.errors import TooManyAttemptsError
from app.db.models.auth import LoginAttempt

MAX_FAILURES = 5
WINDOW = timedelta(minutes=15)
RETENTION = timedelta(days=1)


class LoginThrottle:
    def __init__(self, session: AsyncSession, clock: Clock) -> None:
        self._session = session
        self._clock = clock

    async def check(self, email: str, ip: str) -> None:
        now = self._clock.now()
        recent = await self._session.scalars(
            select(LoginAttempt.attempted_at)
            .where(
                LoginAttempt.email == email,
                LoginAttempt.ip == ip,
                LoginAttempt.attempted_at > now - WINDOW,
            )
            .order_by(LoginAttempt.attempted_at.desc())
            .limit(MAX_FAILURES)
        )
        attempts = list(recent)
        if len(attempts) < MAX_FAILURES:
            return
        # El bloqueo dura hasta que el 5.º fallo más reciente salga de la ventana.
        unlock_at = attempts[-1] + WINDOW
        retry_after = max(1, math.ceil((unlock_at - now).total_seconds()))
        raise TooManyAttemptsError(retry_after)

    async def record_failure(self, email: str, ip: str) -> None:
        now = self._clock.now()
        await self._session.execute(
            delete(LoginAttempt).where(LoginAttempt.attempted_at < now - RETENTION)
        )
        self._session.add(LoginAttempt(email=email, ip=ip, attempted_at=now))
        await self._session.flush()

    async def clear(self, email: str, ip: str) -> None:
        await self._session.execute(
            delete(LoginAttempt).where(LoginAttempt.email == email, LoginAttempt.ip == ip)
        )

    async def clear_email(self, email: str) -> None:
        await self._session.execute(delete(LoginAttempt).where(LoginAttempt.email == email))
