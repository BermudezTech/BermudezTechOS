import asyncio
import logging
from collections.abc import AsyncIterator

import pytest
from pydantic import SecretStr
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.bootstrap import run_bootstrap
from app.core.config import Settings, get_settings
from app.db.models.categories import Category
from app.db.models.users import User


def _settings(url: str, **values: object) -> Settings:
    defaults: dict[str, object] = {
        "database_url": url,
        "initial_user_email": "yo@test.dev",
        "initial_user_password": SecretStr("clave-inicial-segura"),
    }
    defaults.update(values)
    return get_settings().model_copy(update=defaults)


async def _counts(url: str) -> tuple[int, int]:
    engine = create_async_engine(url, poolclass=NullPool)
    async with engine.connect() as connection:
        users = await connection.scalar(select(func.count()).select_from(User))
        categories = await connection.scalar(select(func.count()).select_from(Category))
    await engine.dispose()
    return users or 0, categories or 0


@pytest.fixture
async def url(fresh_database: str) -> AsyncIterator[str]:
    yield fresh_database


async def test_bootstrap_migrates_and_seeds_once(
    url: str, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    assert await run_bootstrap(_settings(url)) == 0
    assert await _counts(url) == (1, 15)

    caplog.clear()
    assert await run_bootstrap(_settings(url, initial_user_password=None)) == 0
    assert "Seed omitida: ya existe un usuario" in caplog.text
    assert await _counts(url) == (1, 15)


async def test_parallel_bootstraps_create_a_single_user(url: str) -> None:
    results = await asyncio.gather(run_bootstrap(_settings(url)), run_bootstrap(_settings(url)))
    assert list(results) == [0, 0]
    assert await _counts(url) == (1, 15)


async def test_invalid_seed_variables_abort_without_data(url: str) -> None:
    assert await run_bootstrap(_settings(url, initial_user_password=None)) != 0
    engine = create_async_engine(url, poolclass=NullPool)
    async with engine.connect() as connection:
        users = await connection.scalar(text("SELECT count(*) FROM users"))
    await engine.dispose()
    assert users == 0
