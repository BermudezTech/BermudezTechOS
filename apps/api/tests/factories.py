"""Atajos para crear datos y sesiones en las pruebas."""

from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, normalize_email
from app.db.models.users import User

DEFAULT_PASSWORD = "password-123"


async def create_user(
    session: AsyncSession,
    email: str = "a@test.dev",
    password: str = DEFAULT_PASSWORD,
    display_name: str | None = None,
) -> User:
    """Inserta un usuario sin categorías (directo a la base)."""
    user = User(
        email=normalize_email(email),
        password_hash=hash_password(password),
        display_name=display_name,
    )
    session.add(user)
    await session.flush()
    return user


async def register_user(
    session: AsyncSession,
    clock: Any,
    email: str = "a@test.dev",
    password: str = DEFAULT_PASSWORD,
    display_name: str | None = None,
) -> User:
    """Registra un usuario por la vía oficial: crea también sus categorías iniciales."""
    from app.modules.users.user_registration_service import UserRegistrationService
    from app.modules.users.users_repository import UsersRepository

    service = UserRegistrationService(session, UsersRepository(session), clock)
    return await service.register(email, password, display_name)


def auth_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


async def login(
    client: AsyncClient, email: str = "a@test.dev", password: str = DEFAULT_PASSWORD
) -> dict[str, Any]:
    response = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body
