"""Providers del módulo de usuarios."""

from app.core.database import SessionDep
from app.modules.users.users_repository import UsersRepository
from app.modules.users.users_service import UsersService


def get_users_repository(session: SessionDep) -> UsersRepository:
    return UsersRepository(session)


def get_users_service() -> UsersService:
    return UsersService()
