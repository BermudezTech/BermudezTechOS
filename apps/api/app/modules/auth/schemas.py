from typing import Literal

from pydantic import EmailStr, Field, field_validator

from app.common.schemas import CamelModel
from app.core.config import ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL, RESET_GRANT_TTL
from app.core.security import PASSWORD_MAX, PASSWORD_MIN


class LoginRequest(CamelModel):
    email: EmailStr
    # Sin mínimo al iniciar sesión: no se revela la regla con un error distinto.
    password: str = Field(min_length=1, max_length=PASSWORD_MAX)


class TokenPair(CamelModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105
    expires_in: int = int(ACCESS_TOKEN_TTL.total_seconds())
    refresh_expires_in: int = int(REFRESH_TOKEN_TTL.total_seconds())


class RefreshRequest(CamelModel):
    refresh_token: str = Field(min_length=1, max_length=512)


class LogoutRequest(CamelModel):
    refresh_token: str = Field(min_length=1, max_length=512)


class ForgotPasswordRequest(CamelModel):
    email: EmailStr


class ForgotPasswordResponse(CamelModel):
    message: str


class VerifyCodeRequest(CamelModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class VerifyCodeResponse(CamelModel):
    reset_token: str
    expires_in: int = int(RESET_GRANT_TTL.total_seconds())


class ResetPasswordRequest(CamelModel):
    reset_token: str = Field(min_length=1, max_length=512)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _check_length(cls, value: str) -> str:
        if not PASSWORD_MIN <= len(value) <= PASSWORD_MAX:
            raise ValueError(f"Debe tener entre {PASSWORD_MIN} y {PASSWORD_MAX} caracteres.")
        return value
