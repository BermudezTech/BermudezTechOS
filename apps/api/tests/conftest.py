"""Infraestructura de pruebas: PostgreSQL real (testcontainers o TEST_DATABASE_URL), migraciones,
sesión por prueba con rollback, reloj controlable y cliente HTTP contra la app."""

import os
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

# Secretos de prueba: deben existir antes de importar la app.
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-" + "x" * 40)
os.environ.setdefault("PASSWORD_RESET_PEPPER", "test-reset-pepper-" + "y" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://placeholder:placeholder@localhost/x")
for _var in ("RESEND_API_KEY", "MAIL_FROM", "INITIAL_USER_EMAIL", "INITIAL_USER_PASSWORD"):
    os.environ.pop(_var, None)


def clear_caches() -> None:
    from app.core.config import get_settings
    from app.core.database import get_engine, get_sessionmaker

    get_settings.cache_clear()
    get_engine.cache_clear()
    get_sessionmaker.cache_clear()


def run_migrations(database_url: str) -> None:
    from alembic import command
    from alembic.config import Config

    config = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)
    config.attributes["configure_logger"] = False
    command.upgrade(config, "head")


class FakeClock:
    def __init__(self) -> None:
        self.current = datetime.now(UTC).replace(microsecond=0)

    def now(self) -> datetime:
        return self.current

    def advance(self, delta: timedelta) -> None:
        self.current += delta


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    external = os.environ.get("TEST_DATABASE_URL")
    if external:
        url = external.replace("postgresql://", "postgresql+asyncpg://", 1)
        os.environ["DATABASE_URL"] = url
        clear_caches()
        run_migrations(url)
        yield url
        return

    from testcontainers.community.postgres import PostgresContainer

    with PostgresContainer("postgres:17-alpine", driver="asyncpg") as container:
        url = container.get_connection_url()
        os.environ["DATABASE_URL"] = url
        clear_caches()
        run_migrations(url)
        yield url


@pytest.fixture(scope="session")
async def engine(database_url: str) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(database_url, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """Sesión dentro de una transacción externa que se deshace al terminar la prueba."""
    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
        )
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()


@pytest.fixture
def frozen_clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def app(db_session: AsyncSession, frozen_clock: FakeClock):  # type: ignore[no-untyped-def]
    from app.core.clock import get_clock
    from app.core.database import get_session, get_session_factory
    from app.main import create_app

    application = create_app()

    async def _session() -> AsyncIterator[AsyncSession]:
        yield db_session
        await db_session.commit()

    @asynccontextmanager
    async def _factory() -> AsyncIterator[AsyncSession]:
        yield db_session

    application.dependency_overrides[get_session] = _session
    application.dependency_overrides[get_clock] = lambda: frozen_clock
    application.dependency_overrides[get_session_factory] = lambda: _factory
    return application


ClientFactory = Callable[..., AsyncClient]


@pytest.fixture
async def make_client(app) -> AsyncIterator[ClientFactory]:  # type: ignore[no-untyped-def]
    clients: list[AsyncClient] = []

    def _make(ip: str = "127.0.0.1") -> AsyncClient:
        transport = ASGITransport(app=app, raise_app_exceptions=False, client=(ip, 123))
        client = AsyncClient(transport=transport, base_url="http://test")
        clients.append(client)
        return client

    yield _make
    for client in clients:
        await client.aclose()


@pytest.fixture
def client(make_client: ClientFactory) -> AsyncClient:
    return make_client()


@pytest.fixture
async def fresh_database(database_url: str) -> AsyncIterator[str]:
    """Base vacía y aparte, para pruebas que necesitan commits reales o concurrencia."""
    name = f"test_{uuid.uuid4().hex[:12]}"
    admin = create_async_engine(database_url, isolation_level="AUTOCOMMIT", poolclass=NullPool)
    async with admin.connect() as connection:
        await connection.execute(text(f'CREATE DATABASE "{name}"'))
    url = make_url(database_url).set(database=name).render_as_string(hide_password=False)
    try:
        yield url
    finally:
        async with admin.connect() as connection:
            await connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        await admin.dispose()


@pytest.fixture
def migrate() -> Callable[[str], Awaitable[None]]:
    """Aplica las migraciones en otra hebra (Alembic usa su propio event loop)."""
    import asyncio

    async def _migrate(url: str) -> None:
        await asyncio.to_thread(run_migrations, url)

    return _migrate
