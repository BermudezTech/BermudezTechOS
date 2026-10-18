"""Providers del módulo de autenticación (equivalente a los providers de NestJS)."""

from typing import Annotated

from fastapi import Depends

from app.core.clock import Clock, get_clock
from app.core.database import SessionDep, SessionFactory, get_session_factory
from app.modules.auth.auth_service import AuthService
from app.modules.auth.login_throttle import LoginThrottle
from app.modules.auth.password_reset_service import PasswordResetService
from app.modules.auth.repositories import PasswordResetRepository, RefreshTokenRepository
from app.modules.mail.dependencies import get_mail_sender
from app.modules.mail.mail_service import MailSender
from app.modules.users.dependencies import get_users_repository
from app.modules.users.users_repository import UsersRepository

ClockDep = Annotated[Clock, Depends(get_clock)]


def get_refresh_token_repository(session: SessionDep) -> RefreshTokenRepository:
    return RefreshTokenRepository(session)


def get_login_throttle(session: SessionDep, clock: ClockDep) -> LoginThrottle:
    return LoginThrottle(session, clock)


def get_auth_service(
    session: SessionDep,
    users: Annotated[UsersRepository, Depends(get_users_repository)],
    refresh_tokens: Annotated[RefreshTokenRepository, Depends(get_refresh_token_repository)],
    throttle: Annotated[LoginThrottle, Depends(get_login_throttle)],
    clock: ClockDep,
) -> AuthService:
    return AuthService(session, users, refresh_tokens, throttle, clock)


def get_password_reset_repository(session: SessionDep) -> PasswordResetRepository:
    return PasswordResetRepository(session)


def get_password_reset_service(
    session: SessionDep,
    users: Annotated[UsersRepository, Depends(get_users_repository)],
    resets: Annotated[PasswordResetRepository, Depends(get_password_reset_repository)],
    refresh_tokens: Annotated[RefreshTokenRepository, Depends(get_refresh_token_repository)],
    throttle: Annotated[LoginThrottle, Depends(get_login_throttle)],
    mail: Annotated[MailSender, Depends(get_mail_sender)],
    clock: ClockDep,
    session_factory: Annotated[SessionFactory, Depends(get_session_factory)],
) -> PasswordResetService:
    return PasswordResetService(
        session, users, resets, refresh_tokens, throttle, mail, clock, session_factory
    )
