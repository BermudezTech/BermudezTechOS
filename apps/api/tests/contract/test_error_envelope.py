from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from app.common.decorators import public


class _Payload(BaseModel):
    sort_order: int


async def _client_for(app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    return AsyncClient(transport=transport, base_url="http://test")


async def test_unknown_path_uses_envelope(client: AsyncClient) -> None:
    response = await client.get("/no-existe")
    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "NOT_FOUND", "message": "No encontrado.", "details": None}
    }


async def test_unexpected_error_hides_details(app: FastAPI) -> None:
    @app.get("/__boom")
    @public
    async def boom() -> None:
        raise RuntimeError("detalle interno secreto")

    async with await _client_for(app) as client:
        response = await client.get("/__boom")
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "secreto" not in response.text


async def test_validation_error_reports_camel_case_fields(app: FastAPI) -> None:
    @app.post("/__echo")
    @public
    async def echo(payload: _Payload) -> _Payload:
        return payload

    async with await _client_for(app) as client:
        response = await client.post("/__echo", json={"sort_order": "x"})
        malformed = await client.post(
            "/__echo", content=b"{", headers={"Content-Type": "application/json"}
        )
    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "VALIDATION_ERROR"
    assert body["details"][0]["field"] == "sortOrder"
    assert malformed.status_code == 422
    assert malformed.json()["error"]["code"] == "VALIDATION_ERROR"
