"""US5: recuperación de contraseña con código de 6 dígitos (FR-027–FR-032, SC-009)."""

import json
import logging
import re
from collections.abc import Iterator
from datetime import timedelta

import httpx
import pytest
import respx
from fastapi import FastAPI
from httpx import AsyncClient
from pydantic import SecretStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models.auth import LoginAttempt, PasswordResetCode, RefreshToken
from app.db.models.users import User
from app.modules.mail.dependencies import get_mail_sender
from app.modules.mail.mail_service import RESEND_URL, ResendMailSender
from tests.conftest import ClientFactory, FakeClock
from tests.factories import DEFAULT_PASSWORD, create_user, login

FORGOT = "/api/v1/auth/password/forgot"
VERIFY = "/api/v1/auth/password/verify"
RESET = "/api/v1/auth/password/reset"
EMAIL = "a@test.dev"
NEW_PASSWORD = "nueva-clave-segura"
GENERIC = {
    "message": "Si el correo está registrado, recibirás un código para restablecer tu contraseña."
}


def _use_mail(app: FastAPI, configured: bool = True) -> None:
    update = (
        {"resend_api_key": SecretStr("re_test_key"), "mail_from": "App <no-reply@test.dev>"}
        if configured
        else {"resend_api_key": None, "mail_from": None}
    )
    sender = ResendMailSender(get_settings().model_copy(update=update))
    app.dependency_overrides[get_mail_sender] = lambda: sender


@pytest.fixture
def resend(app: FastAPI) -> Iterator[respx.Route]:
    _use_mail(app)
    with respx.mock(assert_all_called=False) as mock:
        yield mock.post(RESEND_URL).mock(return_value=httpx.Response(200, json={"id": "x"}))


def _sent_codes(route: respx.Route) -> list[str]:
    codes = []
    for call in route.calls:
        text = json.loads(call.request.content)["text"]
        match = re.search(r"\b(\d{6})\b", text)
        assert match, text
        codes.append(match.group(1))
    return codes


async def _forgot(client: AsyncClient, email: str = EMAIL) -> httpx.Response:
    return await client.post(FORGOT, json={"email": email})


async def _verify(client: AsyncClient, code: str, email: str = EMAIL) -> httpx.Response:
    return await client.post(VERIFY, json={"email": email, "code": code})


async def _rows(session: AsyncSession) -> list[PasswordResetCode]:
    session.expire_all()
    query = select(PasswordResetCode).order_by(PasswordResetCode.created_at)
    return list(await session.scalars(query))


def _wrong(code: str) -> str:
    return f"{(int(code) + 1) % 10**6:06d}"


# --- forgot ---------------------------------------------------------------------------------


async def test_forgot_sends_a_code_to_an_existing_user(
    client: AsyncClient, db_session: AsyncSession, resend: respx.Route
) -> None:
    await create_user(db_session)
    response = await _forgot(client)
    assert response.status_code == 202
    assert response.json() == GENERIC
    assert len(_sent_codes(resend)) == 1


async def test_forgot_is_identical_for_unknown_email(
    client: AsyncClient, db_session: AsyncSession, resend: respx.Route
) -> None:
    await create_user(db_session)
    known = await _forgot(client)
    unknown = await _forgot(client, "nadie@test.dev")
    assert unknown.status_code == known.status_code == 202
    assert unknown.content == known.content
    assert len(resend.calls) == 1


async def test_forgot_is_limited_to_three_per_hour(
    client: AsyncClient, db_session: AsyncSession, resend: respx.Route, frozen_clock: FakeClock
) -> None:
    await create_user(db_session)
    for _ in range(4):
        response = await _forgot(client)
        assert response.status_code == 202
        assert response.json() == GENERIC
    assert len(resend.calls) == 3
    assert len(await _rows(db_session)) == 3

    frozen_clock.advance(timedelta(hours=1, seconds=1))
    await _forgot(client)
    assert len(resend.calls) == 4


async def test_new_request_invalidates_previous_code(
    client: AsyncClient, db_session: AsyncSession, resend: respx.Route
) -> None:
    await create_user(db_session)
    await _forgot(client)
    await _forgot(client)
    first, second = _sent_codes(resend)
    rows = await _rows(db_session)
    assert rows[0].invalidated_at is not None
    assert (await _verify(client, first)).status_code == 400
    assert (await _verify(client, second)).status_code == 200


@pytest.mark.parametrize("failure", ["not-configured", "provider-error"])
async def test_undelivered_code_is_invalidated(
    app: FastAPI,
    client: AsyncClient,
    db_session: AsyncSession,
    caplog: pytest.LogCaptureFixture,
    failure: str,
) -> None:
    caplog.set_level(logging.DEBUG)
    await create_user(db_session)
    with respx.mock(assert_all_called=False) as mock:
        route = mock.post(RESEND_URL).mock(return_value=httpx.Response(500))
        _use_mail(app, configured=failure != "not-configured")
        response = await _forgot(client)
    assert response.status_code == 202
    assert response.json() == GENERIC
    rows = await _rows(db_session)
    assert len(rows) == 1
    assert rows[0].invalidated_at is not None
    for call in route.calls:
        code = re.search(r"\b(\d{6})\b", json.loads(call.request.content)["text"])
        assert code and code.group(1) not in caplog.text


# --- verify ---------------------------------------------------------------------------------


async def test_wrong_code_and_lockout_after_five_failures(
    client: AsyncClient, db_session: AsyncSession, resend: respx.Route
) -> None:
    await create_user(db_session)
    await _forgot(client)
    (code,) = _sent_codes(resend)

    for _ in range(5):
        response = await _verify(client, _wrong(code))
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "INVALID_CODE"

    assert (await _verify(client, code)).status_code == 400
    (row,) = await _rows(db_session)
    assert row.failed_attempts == 5
    assert row.invalidated_at is not None


async def test_expired_code_and_unknown_email_are_rejected_identically(
    client: AsyncClient, db_session: AsyncSession, resend: respx.Route, frozen_clock: FakeClock
) -> None:
    await create_user(db_session)
    await _forgot(client)
    (code,) = _sent_codes(resend)
    unknown = await _verify(client, code, email="nadie@test.dev")
    frozen_clock.advance(timedelta(minutes=30, seconds=1))
    expired = await _verify(client, code)
    assert expired.status_code == unknown.status_code == 400
    assert expired.content == unknown.content


async def test_correct_code_returns_single_use_grant(
    client: AsyncClient, db_session: AsyncSession, resend: respx.Route
) -> None:
    await create_user(db_session)
    await _forgot(client)
    (code,) = _sent_codes(resend)

    response = await _verify(client, code)

    assert response.status_code == 200
    body = response.json()
    assert body["expiresIn"] == 600
    assert body["resetToken"]
    (row,) = await _rows(db_session)
    assert row.used_at is not None
    assert (await _verify(client, code)).status_code == 400


# --- reset ----------------------------------------------------------------------------------


async def _grant(client: AsyncClient, resend: respx.Route) -> str:
    await _forgot(client)
    code = _sent_codes(resend)[-1]
    response = await _verify(client, code)
    assert response.status_code == 200
    token: str = response.json()["resetToken"]
    return token


async def test_reset_changes_password_and_closes_all_sessions(
    make_client: ClientFactory, db_session: AsyncSession, resend: respx.Route
) -> None:
    client = make_client("9.9.9.9")
    user = await create_user(db_session)
    user_id, before = user.id, user.updated_at
    session_a = await login(client)
    session_b = await login(client)
    await client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "incorrecta"})
    grant = await _grant(client, resend)

    short = await client.post(RESET, json={"resetToken": grant, "newPassword": "x" * 7})
    assert short.status_code == 422

    response = await client.post(RESET, json={"resetToken": grant, "newPassword": NEW_PASSWORD})
    assert response.status_code == 204

    old = await client.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": DEFAULT_PASSWORD}
    )
    assert old.status_code == 401
    await login(client, password=NEW_PASSWORD)
    for previous in (session_a, session_b):
        refresh = await client.post(
            "/api/v1/auth/refresh", json={"refreshToken": previous["refreshToken"]}
        )
        assert refresh.status_code == 401

    db_session.expire_all()
    updated_at = await db_session.scalar(select(User.updated_at).where(User.id == user_id))
    assert updated_at != before
    revoked = await db_session.scalar(
        select(func.count())
        .select_from(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
    )
    assert revoked == 1  # solo la sesión nueva
    attempts = await db_session.scalar(
        select(func.count()).select_from(LoginAttempt).where(LoginAttempt.email == EMAIL)
    )
    assert attempts == 0  # el reset borró el fallo previo y el login exitoso, el posterior

    reused = await client.post(RESET, json={"resetToken": grant, "newPassword": NEW_PASSWORD})
    assert reused.status_code == 400
    assert reused.json()["error"]["code"] == "INVALID_RESET_TOKEN"


async def test_reset_clears_login_lockout(
    make_client: ClientFactory, db_session: AsyncSession, resend: respx.Route
) -> None:
    attacker = make_client("1.1.1.1")
    await create_user(db_session)
    for _ in range(5):
        await attacker.post("/api/v1/auth/login", json={"email": EMAIL, "password": "incorrecta"})
    grant = await _grant(attacker, resend)
    await attacker.post(RESET, json={"resetToken": grant, "newPassword": NEW_PASSWORD})
    await login(attacker, password=NEW_PASSWORD)


async def test_expired_grant_is_rejected(
    client: AsyncClient, db_session: AsyncSession, resend: respx.Route, frozen_clock: FakeClock
) -> None:
    await create_user(db_session)
    grant = await _grant(client, resend)
    frozen_clock.advance(timedelta(minutes=10, seconds=1))
    response = await client.post(RESET, json={"resetToken": grant, "newPassword": NEW_PASSWORD})
    assert response.status_code == 400
