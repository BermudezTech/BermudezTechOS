from fastapi import FastAPI
from httpx import AsyncClient

from app.common.decorators import is_public
from app.modules.health.dependencies import get_health_service
from app.modules.health.health_controller import health


async def test_health_ok_without_token(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


async def test_health_reports_database_down(app: FastAPI, client: AsyncClient) -> None:
    class _Broken:
        async def check(self) -> bool:
            return False

    app.dependency_overrides[get_health_service] = _Broken
    response = await client.get("/health")
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "unavailable"}


def test_health_is_public() -> None:
    assert is_public(health)
