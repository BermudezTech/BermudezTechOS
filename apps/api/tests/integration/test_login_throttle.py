from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.auth import LoginAttempt
from tests.conftest import ClientFactory, FakeClock
from tests.factories import DEFAULT_PASSWORD, create_user

LOGIN = "/api/v1/auth/login"
EMAIL = "a@test.dev"


async def _attempts(session: AsyncSession, ip: str | None = None) -> int:
    query = select(func.count()).select_from(LoginAttempt).where(LoginAttempt.email == EMAIL)
    if ip is not None:
        query = query.where(LoginAttempt.ip == ip)
    return await session.scalar(query) or 0


async def test_lockout_by_email_and_ip(
    make_client: ClientFactory, db_session: AsyncSession, frozen_clock: FakeClock
) -> None:
    await create_user(db_session)
    attacker = make_client("1.1.1.1")
    owner = make_client("2.2.2.2")

    for _ in range(5):
        response = await attacker.post(LOGIN, json={"email": EMAIL, "password": "incorrecta"})
        assert response.status_code == 401

    blocked = await attacker.post(LOGIN, json={"email": EMAIL, "password": DEFAULT_PASSWORD})
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "TOO_MANY_ATTEMPTS"
    assert int(blocked.headers["Retry-After"]) > 0

    from_other_ip = await owner.post(LOGIN, json={"email": EMAIL, "password": DEFAULT_PASSWORD})
    assert from_other_ip.status_code == 200

    frozen_clock.advance(timedelta(minutes=15))
    unlocked = await attacker.post(LOGIN, json={"email": EMAIL, "password": DEFAULT_PASSWORD})
    assert unlocked.status_code == 200
    assert await _attempts(db_session, "1.1.1.1") == 0


async def test_old_attempts_are_purged(
    make_client: ClientFactory, db_session: AsyncSession, frozen_clock: FakeClock
) -> None:
    await create_user(db_session)
    client = make_client("3.3.3.3")
    await client.post(LOGIN, json={"email": EMAIL, "password": "incorrecta"})
    frozen_clock.advance(timedelta(days=1, minutes=1))
    await client.post(LOGIN, json={"email": EMAIL, "password": "incorrecta"})
    assert await _attempts(db_session) == 1
