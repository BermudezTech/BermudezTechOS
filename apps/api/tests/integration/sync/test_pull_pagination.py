"""Paginación y cambios incrementales del PULL (US2, FR-016–FR-018)."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.accounts import Account
from app.db.models.users import User
from app.modules.sync.core import config
from tests.factories import auth_headers
from tests.integration.sync.conftest import PULL, Records, pull, push_ok


async def _pull_all(client: AsyncClient, token: str) -> tuple[list[dict[str, Any]], int]:
    """Repite el PULL mientras haya más; devuelve todos los registros y el número de páginas."""
    cursors: dict[str, str | None] = {}
    collected: list[dict[str, Any]] = []
    pages = 0
    while True:
        data = await pull(client, token, cursors)
        pages += 1
        for table, page in data["changes"].items():
            collected.extend({"table": table, **record} for record in page["records"])
            cursors[table] = page["cursor"]
        if not data["hasMore"]:
            return collected, pages


async def test_budget_is_shared_and_pages_neither_lose_nor_repeat(
    client: AsyncClient, token: str, records: Records, monkeypatch: pytest.MonkeyPatch
) -> None:
    accounts = [records.account(name=f"Cuenta {i}") for i in range(7)]
    await push_ok(client, token, {"accounts": accounts})
    monkeypatch.setattr(config, "PULL_PAGE_SIZE", 3)

    first = await pull(client, token)
    assert sum(len(page["records"]) for page in first["changes"].values()) == 3
    assert first["changes"]["categories"]["hasMore"] is True
    assert first["changes"]["accounts"] == {"records": [], "cursor": None, "hasMore": True}

    collected, pages = await _pull_all(client, token)
    ids = [(item["table"], item["id"]) for item in collected]
    assert len(ids) == len(set(ids)) == 15 + 7
    assert pages == 8  # ceil(22 / 3)


async def test_records_sharing_the_same_mark_are_not_lost(
    client: AsyncClient,
    token: str,
    records: Records,
    user: User,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    accounts = [records.account(name=f"Cuenta {i}") for i in range(7)]
    await push_ok(client, token, {"accounts": accounts})
    same_mark = datetime(2030, 1, 1, tzinfo=UTC)
    await db_session.execute(
        update(Account).where(Account.user_id == user.id).values(server_updated_at=same_mark)
    )
    monkeypatch.setattr(config, "PULL_PAGE_SIZE", 3)

    collected, _ = await _pull_all(client, token)

    account_ids = sorted(item["id"] for item in collected if item["table"] == "accounts")
    assert account_ids == sorted(account["id"] for account in accounts)


async def test_incremental_pull_includes_changes_and_deletions(
    client: AsyncClient, token: str, records: Records
) -> None:
    kept, removed = records.account(name="Queda"), records.account(name="Se borra")
    await push_ok(client, token, {"accounts": [kept, removed]})
    baseline = await pull(client, token)
    cursors = {table: page["cursor"] for table, page in baseline["changes"].items()}

    later = records.at(timedelta(minutes=1))
    await push_ok(
        client,
        token,
        {
            "accounts": [
                kept | {"name": "Editada", "updatedAt": later},
                removed | {"deletedAt": later, "updatedAt": later},
            ]
        },
    )
    data = await pull(client, token, cursors)

    changed = {record["id"]: record for record in data["changes"]["accounts"]["records"]}
    assert set(changed) == {kept["id"], removed["id"]}
    assert changed[kept["id"]]["name"] == "Editada"
    assert changed[removed["id"]]["deletedAt"] is not None
    assert data["changes"]["categories"]["records"] == []


async def test_malformed_cursor_is_reported_with_its_table(client: AsyncClient, token: str) -> None:
    response = await client.post(
        PULL, json={"cursors": {"accounts": "basura"}}, headers=auth_headers(token)
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "INVALID_CURSOR"
    assert error["details"] == [{"table": "accounts"}]


async def test_unknown_table_in_cursors_is_rejected(client: AsyncClient, token: str) -> None:
    response = await client.post(
        PULL, json={"cursors": {"users": None}}, headers=auth_headers(token)
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
