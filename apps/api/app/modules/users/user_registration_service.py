"""Registro de usuarios: la única vía para crear uno. No tiene ruta pública (FR-006)."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.core.security import hash_password, normalize_email
from app.db.models.users import User
from app.modules.categories.defaults import build_default_categories
from app.modules.users.users_repository import UsersRepository


class UserRegistrationService:
    def __init__(self, session: AsyncSession, users: UsersRepository, clock: Clock) -> None:
        self._session = session
        self._users = users
        self._clock = clock

    async def register(self, email: str, password: str, display_name: str | None) -> User:
        """Crea el usuario y su set inicial de categorías: todo o nada (FR-016)."""
        async with self._session.begin_nested():
            user = await self._users.create(
                normalize_email(email), hash_password(password), display_name
            )
            self._session.add_all(build_default_categories(user.id, self._clock.now()))
            await self._session.flush()
        return user
