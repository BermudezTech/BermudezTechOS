"""Los modelos coinciden con el esquema que dejan las migraciones de Alembic."""

from typing import Any

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy.ext.asyncio import AsyncSession

import app.db.models  # noqa: F401  (registra todos los modelos en Base.metadata)
from app.db.base import Base


async def test_models_match_migrations(db_session: AsyncSession) -> None:
    connection = await db_session.connection()

    def diff(sync_connection: Any) -> list[Any]:
        context = MigrationContext.configure(sync_connection)
        return list(compare_metadata(context, Base.metadata))

    assert await connection.run_sync(diff) == []
