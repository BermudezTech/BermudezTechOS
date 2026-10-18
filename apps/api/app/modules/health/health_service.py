import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_TIMEOUT_SECONDS = 2


class HealthService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def check(self) -> bool:
        """`True` si la base de datos responde a tiempo."""
        try:
            await asyncio.wait_for(self._session.execute(text("SELECT 1")), _TIMEOUT_SECONDS)
        except Exception:
            return False
        return True
