"""Ningún monto cambia en el viaje PUSH → servidor → PULL (SC-007)."""

from httpx import AsyncClient

from tests.integration.sync.conftest import Records, pull, push_ok, statuses


async def test_amounts_round_trip_exactly(
    client: AsyncClient, token: str, records: Records
) -> None:
    account = records.account(openingBalance="9999999999.99")
    investment = records.account(type="INVESTMENT", name="CDT", openingBalance="0.10")
    amounts = ["0.10", "0.20", "0.30"]
    transactions = [records.transaction(account["id"], amount=amount) for amount in amounts]
    cdt = records.cdt(
        investment["id"], account["id"], annualRateEa="10.2500", withholdingRate="4.00"
    )
    results = await push_ok(
        client,
        token,
        {"accounts": [account, investment], "cdts": [cdt], "transactions": transactions},
    )
    assert set(statuses(results)) == {"APPLIED"}

    data = await pull(client, token)
    pulled = {
        record["id"]: record for page in data["changes"].values() for record in page["records"]
    }
    assert [pulled[t["id"]]["amount"] for t in transactions] == amounts
    assert pulled[account["id"]]["openingBalance"] == "9999999999.99"
    assert pulled[investment["id"]]["openingBalance"] == "0.10"
    assert pulled[cdt["id"]]["annualRateEa"] == "10.2500"
    assert pulled[cdt["id"]]["annualRateNominal"] == "9.7800"
    assert pulled[cdt["id"]]["withholdingRate"] == "4.00"
