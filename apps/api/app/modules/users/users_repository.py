import uuid
from datetime import datetime

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.users import User


class UsersRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return await self._session.get(User, user_id)

    async def get_by_email(self, normalized_email: str) -> User | None:
        result = await self._session.scalars(select(User).where(User.email == normalized_email))
        return result.one_or_none()

    async def exists_any(self) -> bool:
        return bool(await self._session.scalar(select(exists().select_from(User))))

    async def create(self, email: str, password_hash: str, display_name: str | None) -> User:
        user = User(
            id=uuid.uuid4(), email=email, password_hash=password_hash, display_name=display_name
        )
        self._session.add(user)
        await self._session.flush()
        return user

    async def update_password(self, user: User, password_hash: str, now: datetime) -> None:
        user.password_hash = password_hash
        user.updated_at = now
        await self._session.flush()
