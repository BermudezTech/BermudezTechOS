import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.errors import UnauthenticatedError
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_reset_code,
    new_reset_code,
    normalize_email,
    verify_password,
)

NOW = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)


def test_password_hash_round_trip() -> None:
    hashed = hash_password("correct horse")
    assert hashed.startswith("$argon2id$")
    assert verify_password("correct horse", hashed)
    assert not verify_password("wrong horse", hashed)


def test_access_token_round_trip() -> None:
    user_id = uuid.uuid4()
    token = create_access_token(user_id, NOW)
    assert decode_access_token(token, NOW + timedelta(minutes=14)) == user_id


def test_access_token_expires_after_15_minutes() -> None:
    token = create_access_token(uuid.uuid4(), NOW)
    with pytest.raises(UnauthenticatedError):
        decode_access_token(token, NOW + timedelta(minutes=15, seconds=1))


def _forge(claims: dict[str, object], secret: str | None = None) -> str:
    key = secret or get_settings().jwt_secret.get_secret_value()
    return jwt.encode(claims, key, algorithm="HS256")


def _claims(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "sub": str(uuid.uuid4()),
        "typ": "access",
        "iat": int(NOW.timestamp()),
        "exp": int((NOW + timedelta(minutes=15)).timestamp()),
    }
    base.update(overrides)
    return base


@pytest.mark.parametrize(
    "token",
    [
        pytest.param(
            lambda: _forge(_claims(), secret="otro-secreto-" + "z" * 40), id="bad-signature"
        ),
        pytest.param(lambda: _forge(_claims(typ="refresh")), id="refresh-type"),
        pytest.param(
            lambda: _forge({k: v for k, v in _claims().items() if k != "sub"}), id="missing-sub"
        ),
        pytest.param(lambda: _forge(_claims(sub="no-es-uuid")), id="sub-not-uuid"),
        pytest.param(lambda: "no.es.un.jwt", id="malformed"),
    ],
)
def test_access_token_rejected(token) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(UnauthenticatedError):
        decode_access_token(token(), NOW)


def test_reset_code_is_six_digits() -> None:
    for _ in range(200):
        code = new_reset_code()
        assert len(code) == 6
        assert code.isdigit()


def test_reset_code_hash_is_deterministic_per_user() -> None:
    user_a, user_b = uuid.uuid4(), uuid.uuid4()
    assert hash_reset_code(user_a, "123456") == hash_reset_code(user_a, "123456")
    assert hash_reset_code(user_a, "123456") != hash_reset_code(user_b, "123456")
    assert len(hash_reset_code(user_a, "123456")) == 64


def test_normalize_email() -> None:
    assert normalize_email(" A@B.Com ") == "a@b.com"
