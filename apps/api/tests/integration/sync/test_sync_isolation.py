"""Aislamiento entre usuarios en el sync (US1, US2, SC-003)."""

import uuid
from datetime import timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.accounts import Account
from tests.integration.sync.conftest import Records, pull, push_ok


async def test_foreign_id_is_rejected_without_touching_the_owner(
    client: AsyncClient, token: str, other_token: str, records: Records, db_session: AsyncSession
) -> None:
    account = records.account(name="De A")
    await push_ok(client, token, {"accounts": [account]})

    # Mismo ID con una versión más reciente: ganaría por LWW si fuera del mismo usuario.
    hijack = account | {"name": "De B", "updatedAt": records.at(timedelta(minutes=5))}
    [result] = await push_ok(client, other_token, {"accounts": [hijack]})
    assert result["status"] == "REJECTED"
    assert result["code"] == "ID_CONFLICT"
    assert result["message"] == "No se pudo guardar este registro."

    db_session.expire_all()
    row = (
        await db_session.scalars(select(Account).where(Account.id == uuid.UUID(account["id"])))
    ).one()
    assert row.name == "De A"


async def test_foreign_reference_looks_like_a_missing_one(
    client: AsyncClient, token: str, other_token: str, records: Records
) -> None:
    account = records.account()
    await push_ok(client, token, {"accounts": [account]})

    foreign = records.transaction(account["id"])
    missing = records.transaction(str(uuid.uuid4()))
    results = await push_ok(client, other_token, {"transactions": [foreign, missing]})
    assert [r["code"] for r in results] == ["INVALID_REFERENCE", "INVALID_REFERENCE"]
    assert results[0]["message"] == results[1]["message"]


async def test_pull_only_returns_own_records(
    client: AsyncClient, token: str, other_token: str, records: Records
) -> None:
    mine, theirs = records.account(name="Mía"), records.account(name="Suya")
    await push_ok(client, token, {"accounts": [mine]})
    await push_ok(client, other_token, {"accounts": [theirs]})

    for own_token, own, foreign in ((token, mine, theirs), (other_token, theirs, mine)):
        data = await pull(client, own_token)
        ids = {record["id"] for record in data["changes"]["accounts"]["records"]}
        assert ids == {own["id"]}
        assert foreign["id"] not in ids
        categories = data["changes"]["categories"]["records"]
        assert len(categories) == 15
        for page in data["changes"].values():
            for record in page["records"]:
                assert "userId" not in record
