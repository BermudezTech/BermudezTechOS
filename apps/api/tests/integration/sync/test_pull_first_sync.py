"""Primer PULL y PULL sin cambios (US2, FR-016, FR-020, FR-021)."""

from httpx import AsyncClient

from app.modules.sync.core.registry import SYNC_ENTITIES
from tests.integration.sync.conftest import pull


async def test_first_pull_brings_the_initial_categories(client: AsyncClient, token: str) -> None:
    data = await pull(client, token)

    assert list(data["changes"]) == [entity.table for entity in SYNC_ENTITIES]
    assert data["hasMore"] is False
    categories = data["changes"]["categories"]
    assert len(categories["records"]) == 15
    assert categories["hasMore"] is False
    assert categories["cursor"]
    for record in categories["records"]:
        assert "userId" not in record
        assert record["serverUpdatedAt"].endswith("Z")
        assert record["deletedAt"] is None
    # Tablas vacías y sin cursor previo: cursor nulo.
    for table in ("accounts", "transactions"):
        assert data["changes"][table] == {"records": [], "cursor": None, "hasMore": False}


async def test_pull_with_returned_cursors_brings_nothing_new(
    client: AsyncClient, token: str
) -> None:
    first = await pull(client, token)
    cursors = {table: page["cursor"] for table, page in first["changes"].items()}

    second = await pull(client, token, cursors)

    assert all(page["records"] == [] for page in second["changes"].values())
    assert {table: page["cursor"] for table, page in second["changes"].items()} == cursors
    assert second["hasMore"] is False
