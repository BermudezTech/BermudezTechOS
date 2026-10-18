"""Rutas de autenticación. Solo reciben la solicitud y delegan en los servicios."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response

from app.common.decorators import public
from app.common.guards import CurrentUser
from app.modules.auth.auth_service import AuthService
from app.modules.auth.dependencies import get_auth_service, get_password_reset_service
from app.modules.auth.password_reset_service import PasswordResetService
from app.modules.auth.schemas import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TokenPair,
    VerifyCodeRequest,
    VerifyCodeResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
PasswordResetServiceDep = Annotated[PasswordResetService, Depends(get_password_reset_service)]

# Es un mensaje para el usuario, no una contraseña.
FORGOT_PASSWORD_MESSAGE = (
    "Si el correo está registrado, recibirás un código para restablecer tu contraseña."  # noqa: S105
)


def _client_ip(request: Request) -> str:
    # Detrás del proxy, uvicorn --proxy-headers ya pone aquí la IP real (FORWARDED_ALLOW_IPS).
    return request.client.host if request.client else "0.0.0.0"  # noqa: S104


@router.post("/login", response_model=TokenPair)
@public
async def login(body: LoginRequest, request: Request, service: AuthServiceDep) -> TokenPair:
    return await service.login(body.email, body.password, _client_ip(request))


@router.post("/refresh", response_model=TokenPair)
@public
async def refresh(body: RefreshRequest, service: AuthServiceDep) -> TokenPair:
    return await service.refresh(body.refresh_token)


@router.post("/logout", status_code=204, response_class=Response)
async def logout(body: LogoutRequest, user: CurrentUser, service: AuthServiceDep) -> None:
    await service.logout(user, body.refresh_token)


@router.post("/password/forgot", status_code=202, response_model=ForgotPasswordResponse)
@public
async def forgot_password(
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    service: PasswordResetServiceDep,
) -> ForgotPasswordResponse:
    await service.request_reset(body.email, background_tasks)
    # Misma respuesta exista o no el correo (FR-027).
    return ForgotPasswordResponse(message=FORGOT_PASSWORD_MESSAGE)


@router.post("/password/verify", response_model=VerifyCodeResponse)
@public
async def verify_reset_code(
    body: VerifyCodeRequest, service: PasswordResetServiceDep
) -> VerifyCodeResponse:
    return await service.verify_code(body.email, body.code)


@router.post("/password/reset", status_code=204, response_class=Response)
@public
async def reset_password(body: ResetPasswordRequest, service: PasswordResetServiceDep) -> None:
    await service.reset_password(body.reset_token, body.new_password)
