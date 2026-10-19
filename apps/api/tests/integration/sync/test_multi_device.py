"""Dos dispositivos del mismo usuario convergen a la versión más reciente (US3, FR-008)."""

from datetime import timedelta
from typing import Any

import pytest
from httpx import AsyncClient

from tests.integration.sync.conftest import Records, pull, push_ok, statuses


class Device:
    """Base local mínima: guarda registros por (tabla, id) y sus cursores, como hará la app."""

    def __init__(self, client: AsyncClient, token: str) -> None:
        self._client = client
        self._token = token
        self.store: dict[tuple[str, str], dict[str, Any]] = {}
        self._dirty: dict[tuple[str, str], dict[str, Any]] = {}
        self._cursors: dict[str, str | None] = {}

    def save(self, table: str, record: dict[str, Any]) -> None:
        key = (table, record["id"])
        self.store[key] = record
        self._dirty[key] = record

    async def sync(self) -> list[str]:
        changes: dict[str, list[dict[str, Any]]] = {}
        for (table, _), record in self._dirty.items():
            changes.setdefault(table, []).append(record)
        results = await push_ok(self._client, self._token, changes) if changes else []
        for result in results:
            if result["status"] in ("APPLIED", "DISCARDED"):
                self._dirty.pop((result["table"], result["id"]), None)
        while True:
            data = await pull(self._client, self._token, self._cursors)
            for table, page in data["changes"].items():
                for record in page["records"]:
                    self.store[(table, record["id"])] = record
                self._cursors[table] = page["cursor"]
            if not data["hasMore"]:
                return statuses(results)

    def get(self, table: str, record_id: str) -> dict[str, Any]:
        return self.store[(table, record_id)]


@pytest.fixture
def devices(client: AsyncClient, token: str) -> tuple[Device, Device]:
    return Device(client, token), Device(client, token)


@pytest.mark.parametrize("a_first", [True, False], ids=["A-first", "B-first"])
async def test_latest_edit_wins_in_any_order(
    devices: tuple[Device, Device], records: Records, a_first: bool
) -> None:
    a, b = devices
    account = records.account(name="Original")
    a.save("accounts", account)
    await a.sync()
    await b.sync()

    a.save(
        "accounts",
        account | {"name": "A", "updatedAt": records.at(timedelta(seconds=1))},
    )
    b.save("accounts", account | {"name": "B", "updatedAt": records.at(timedelta(minutes=5))})
    first, second = (a, b) if a_first else (b, a)
    await first.sync()
    await second.sync()
    await first.sync()

    for device in (a, b):
        assert device.get("accounts", account["id"])["name"] == "B"


async def test_stale_push_is_discarded_and_the_winner_arrives(
    devices: tuple[Device, Device], records: Records
) -> None:
    a, b = devices
    account = records.account(name="Original")
    a.save("accounts", account)
    await a.sync()

    b.save("accounts", account | {"name": "B", "updatedAt": records.at(timedelta(minutes=5))})
    await b.sync()
    a.save("accounts", account | {"name": "A", "updatedAt": records.at(timedelta(minutes=1))})

    assert await a.sync() == ["DISCARDED"]
    assert a.get("accounts", account["id"])["name"] == "B"


async def test_later_delete_beats_earlier_edit(
    devices: tuple[Device, Device], records: Records
) -> None:
    a, b = devices
    account = records.account()
    a.save("accounts", account)
    await a.sync()
    await b.sync()

    b.save("accounts", account | {"name": "Editada", "updatedAt": records.at(timedelta(minutes=5))})
    deleted_at = records.at(timedelta(minutes=10))
    a.save("accounts", account | {"deletedAt": deleted_at, "updatedAt": deleted_at})
    await b.sync()
    await a.sync()
    await b.sync()

    for device in (a, b):
        assert device.get("accounts", account["id"])["deletedAt"] is not None


async def test_later_edit_restores_an_earlier_delete(
    devices: tuple[Device, Device], records: Records
) -> None:
    a, b = devices
    account = records.account()
    a.save("accounts", account)
    await a.sync()
    await b.sync()

    deleted_at = records.at(timedelta(minutes=5))
    a.save("accounts", account | {"deletedAt": deleted_at, "updatedAt": deleted_at})
    b.save(
        "accounts",
        account
        | {"name": "Editada", "deletedAt": None, "updatedAt": records.at(timedelta(minutes=10))},
    )
    await a.sync()
    await b.sync()
    await a.sync()

    for device in (a, b):
        record = device.get("accounts", account["id"])
        assert record["deletedAt"] is None
        assert record["name"] == "Editada"
