"""SC-006: ninguna contraseña, token, código ni permiso queda en claro en la base ni en los logs."""

import json
import logging
import re

import httpx
import pytest
import respx
from fastapi import FastAPI
from httpx import AsyncClient
from pydantic import SecretStr
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models.users import User
from app.modules.mail.dependencies import get_mail_sender
from app.modules.mail.mail_service import RESEND_URL, ResendMailSender
from tests.factories import DEFAULT_PASSWORD, create_user, login

NEW_PASSWORD = "otra-clave-muy-segura"


async def test_no_plaintext_secrets(
    app: FastAPI, client: AsyncClient, db_session: AsyncSession, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    settings = get_settings().model_copy(
        update={"resend_api_key": SecretStr("re_test_key"), "mail_from": "App <a@test.dev>"}
    )
    app.dependency_overrides[get_mail_sender] = lambda: ResendMailSender(settings)
    await create_user(db_session)

    first = await login(client)
    rotated = (
        await client.post("/api/v1/auth/refresh", json={"refreshToken": first["refreshToken"]})
    ).json()
    with respx.mock() as mock:
        route = mock.post(RESEND_URL).mock(return_value=httpx.Response(200, json={"id": "x"}))
        await client.post("/api/v1/auth/password/forgot", json={"email": "a@test.dev"})
        sent = json.loads(route.calls.last.request.content)["text"]
    match = re.search(r"\b(\d{6})\b", sent)
    assert match
    code = match.group(1)
    grant = (
        await client.post(
            "/api/v1/auth/password/verify", json={"email": "a@test.dev", "code": code}
        )
    ).json()["resetToken"]
    reset = await client.post(
        "/api/v1/auth/password/reset", json={"resetToken": grant, "newPassword": NEW_PASSWORD}
    )
    assert reset.status_code == 204

    plaintexts = [
        DEFAULT_PASSWORD,
        NEW_PASSWORD,
        first["refreshToken"],
        rotated["refreshToken"],
        code,
        grant,
    ]
    for table in ("users", "refresh_tokens", "password_reset_codes"):
        rows = (await db_session.execute(text(f"SELECT * FROM {table}"))).all()  # noqa: S608
        dump = " ".join(str(value) for row in rows for value in row)
        for secret in plaintexts:
            assert secret not in dump, (table, secret)

    password_hash = await db_session.scalar(select(User.password_hash))
    assert password_hash is not None and password_hash.startswith("$argon2id$")
    for secret in plaintexts:
        assert secret not in caplog.text
