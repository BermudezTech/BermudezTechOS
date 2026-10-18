"""Primitivas de seguridad: contraseñas, tokens de acceso y opacos, y códigos de recuperación."""

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.config import ACCESS_TOKEN_TTL, get_settings
from app.core.errors import UnauthenticatedError

PASSWORD_MIN = 8
PASSWORD_MAX = 128

_JWT_ALGORITHM = "HS256"
_password_hash = PasswordHash((Argon2Hasher(),))


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


# Hash de referencia para igualar tiempos cuando el correo no existe (no enumerar usuarios).
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))


def normalize_email(email: str) -> str:
    return email.strip().lower()


def create_access_token(user_id: uuid.UUID, now: datetime) -> str:
    claims = {
        "sub": str(user_id),
        "typ": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + ACCESS_TOKEN_TTL).timestamp()),
        "jti": uuid.uuid4().hex,
    }
    secret = get_settings().jwt_secret.get_secret_value()
    return jwt.encode(claims, secret, algorithm=_JWT_ALGORITHM)


def decode_access_token(token: str, now: datetime) -> uuid.UUID:
    """Devuelve el id del usuario. Cualquier fallo es `UnauthenticatedError`.

    El vencimiento se compara con `now` (reloj del servidor, inyectable) y sin margen.
    """
    secret = get_settings().jwt_secret.get_secret_value()
    try:
        claims = jwt.decode(
            token,
            secret,
            algorithms=[_JWT_ALGORITHM],
            options={"require": ["sub", "typ", "exp", "iat"], "verify_exp": False},
        )
    except jwt.PyJWTError:
        raise UnauthenticatedError() from None
    if claims.get("typ") != "access":
        raise UnauthenticatedError()
    expires_at = claims.get("exp")
    if not isinstance(expires_at, int) or expires_at <= now.timestamp():
        raise UnauthenticatedError()
    try:
        return uuid.UUID(str(claims["sub"]))
    except ValueError:
        raise UnauthenticatedError() from None


def new_opaque_token() -> str:
    return secrets.token_urlsafe(32)


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def new_reset_code() -> str:
    return f"{secrets.randbelow(10**6):06d}"


def hash_reset_code(user_id: uuid.UUID, code: str) -> str:
    """HMAC con pepper: sin la clave, un volcado de la base no permite probar los 10⁶ códigos."""
    pepper = get_settings().password_reset_pepper.get_secret_value().encode()
    return hmac.new(pepper, f"{user_id}:{code}".encode(), hashlib.sha256).hexdigest()


def constant_time_equals(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode(), right.encode())
