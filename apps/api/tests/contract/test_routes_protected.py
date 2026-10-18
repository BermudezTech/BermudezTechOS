"""SC-002: toda ruta no pública rechaza solicitudes sin sesión válida."""

import re
import uuid
from datetime import timedelta

import jwt
import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.decorators import is_public
from app.core.config import get_settings
from app.core.security import create_access_token
from app.db.models.users import User
from app.main import registered_routes
from tests.conftest import FakeClock
from tests.factories import auth_headers, create_user

PUBLIC_PATHS = {
    "/health",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/password/forgot",
    "/api/v1/auth/password/verify",
    "/api/v1/auth/password/reset",
}


def _protected_calls(app: FastAPI) -> list[tuple[str, str]]:
    calls = []
    for path, route in registered_routes(app):
        if is_public(route.endpoint):
            continue
        concrete = re.sub(r"\{[^}]+\}", str(uuid.uuid4()), path)
        calls.extend((method, concrete) for method in sorted(route.methods))
    return calls


def test_public_routes_are_exactly_the_expected_ones(app: FastAPI) -> None:
    public = {path for path, route in registered_routes(app) if is_public(route.endpoint)}
    assert public <= PUBLIC_PATHS
    assert "/api/v1/auth/login" in public


def test_there_are_protected_routes(app: FastAPI) -> None:
    assert _protected_calls(app)


async def _assert_rejected(client: AsyncClient, app: FastAPI, headers: dict[str, str]) -> None:
    for method, path in _protected_calls(app):
        response = await client.request(method, path, headers=headers, json={})
        assert response.status_code == 401, (method, path, response.text)
        assert response.json()["error"]["code"] == "UNAUTHENTICATED"
        assert response.headers["WWW-Authenticate"] == "Bearer"


async def test_rejects_missing_token(client: AsyncClient, app: FastAPI) -> None:
    await _assert_rejected(client, app, {})


@pytest.mark.parametrize("header", ["Bearer", "Bearer no.es.jwt", "Basic dXNlcjpwYXNz", "token"])
async def test_rejects_malformed_header(client: AsyncClient, app: FastAPI, header: str) -> None:
    await _assert_rejected(client, app, {"Authorization": header})


async def test_rejects_token_signed_with_another_secret(
    client: AsyncClient, app: FastAPI, db_session: AsyncSession, frozen_clock: FakeClock
) -> None:
    user = await create_user(db_session)
    now = int(frozen_clock.now().timestamp())
    token = jwt.encode(
        {"sub": str(user.id), "typ": "access", "iat": now, "exp": now + 900},
        "clave-anterior-" + "k" * 40,
        algorithm="HS256",
    )
    await _assert_rejected(client, app, auth_headers(token))


async def test_rejects_expired_token(
    client: AsyncClient, app: FastAPI, db_session: AsyncSession, frozen_clock: FakeClock
) -> None:
    user = await create_user(db_session)
    token = create_access_token(user.id, frozen_clock.now())
    frozen_clock.advance(timedelta(minutes=16))
    await _assert_rejected(client, app, auth_headers(token))


async def test_rejects_refresh_typed_token(
    client: AsyncClient, app: FastAPI, db_session: AsyncSession, frozen_clock: FakeClock
) -> None:
    user = await create_user(db_session)
    now = int(frozen_clock.now().timestamp())
    token = jwt.encode(
        {"sub": str(user.id), "typ": "refresh", "iat": now, "exp": now + 900},
        get_settings().jwt_secret.get_secret_value(),
        algorithm="HS256",
    )
    await _assert_rejected(client, app, auth_headers(token))


async def test_rejects_token_of_deleted_user(
    client: AsyncClient, app: FastAPI, db_session: AsyncSession, frozen_clock: FakeClock
) -> None:
    user = await create_user(db_session)
    token = create_access_token(user.id, frozen_clock.now())
    await db_session.execute(delete(User).where(User.id == user.id))
    db_session.expunge_all()
    await _assert_rejected(client, app, auth_headers(token))
