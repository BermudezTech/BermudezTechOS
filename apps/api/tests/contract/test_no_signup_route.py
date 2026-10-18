from fastapi import FastAPI

from app.main import registered_routes


def test_there_is_no_way_to_create_users_through_the_api(app: FastAPI) -> None:
    routes = list(registered_routes(app))
    assert routes, "la app no tiene rutas registradas"
    for path, route in routes:
        lowered = path.lower()
        assert not any(word in lowered for word in ("register", "signup", "sign-up")), path
        if path.rstrip("/") == "/api/v1/users":
            assert "POST" not in route.methods
