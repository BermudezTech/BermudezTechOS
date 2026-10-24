"""El worker no migra (FR-019): solo verifica que la base esté en el head de la imagen, que la API
ya aplicó al arrancar (research R6)."""

from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

_ALEMBIC_INI = Path(__file__).resolve().parents[3] / "alembic.ini"


def expected_head() -> str | None:
    return ScriptDirectory.from_config(Config(str(_ALEMBIC_INI))).get_current_head()


async def check_schema(session: AsyncSession) -> str | None:
    """Mensaje de error si el esquema no es el esperado; None si coincide."""
    try:
        current = await session.scalar(text("SELECT version_num FROM alembic_version"))
    except ProgrammingError:
        # Sin tabla alembic_version: la base no está migrada.
        await session.rollback()
        current = None
    expected = expected_head()
    if current != expected:
        return f"Esquema inesperado: base={current} esperado={expected}; no se escribe nada"
    return None
