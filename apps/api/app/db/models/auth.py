"""Tablas de autenticación (solo servidor): tokens de renovación, recuperación y bloqueos."""

import uuid
from datetime import datetime

from sqlalchemy import CHAR, BigInteger, ForeignKey, Identity, Index, SmallInteger, String, text
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, check, utc_timestamp


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    __table_args__ = (
        Index("ix_refresh_tokens_user_id_revoked_at", "user_id", "revoked_at"),
        Index("ix_refresh_tokens_session_id", "session_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # Sesión de un dispositivo: la crea el login y la heredan los tokens sucesores.
    session_id: Mapped[uuid.UUID]
    token_hash: Mapped[str] = mapped_column(CHAR(64), unique=True)
    expires_at: Mapped[datetime] = utc_timestamp()
    revoked_at: Mapped[datetime | None] = utc_timestamp(nullable=True)
    replaced_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("refresh_tokens.id"))
    created_at: Mapped[datetime] = utc_timestamp(server_now=True)


class PasswordResetCode(Base):
    __tablename__ = "password_reset_codes"
    __table_args__ = (
        check("failed_attempts_range", "failed_attempts BETWEEN 0 AND 5"),
        check("grant_requires_used", "grant_hash IS NULL OR used_at IS NOT NULL"),
        Index("ix_password_reset_codes_user_id_created_at", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    code_hash: Mapped[str] = mapped_column(CHAR(64))
    expires_at: Mapped[datetime] = utc_timestamp()
    failed_attempts: Mapped[int] = mapped_column(SmallInteger, default=0, server_default=text("0"))
    used_at: Mapped[datetime | None] = utc_timestamp(nullable=True)
    invalidated_at: Mapped[datetime | None] = utc_timestamp(nullable=True)
    grant_hash: Mapped[str | None] = mapped_column(CHAR(64), unique=True)
    grant_expires_at: Mapped[datetime | None] = utc_timestamp(nullable=True)
    grant_used_at: Mapped[datetime | None] = utc_timestamp(nullable=True)
    created_at: Mapped[datetime] = utc_timestamp(server_now=True)


class LoginAttempt(Base):
    """Fallo de inicio de sesión. No es dato del usuario: el correo puede no existir."""

    __tablename__ = "login_attempts"
    __table_args__ = (
        Index("ix_login_attempts_email_ip_attempted_at", "email", "ip", "attempted_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    email: Mapped[str] = mapped_column(String(255))
    ip: Mapped[str] = mapped_column(INET)
    attempted_at: Mapped[datetime] = utc_timestamp(server_now=True)
