import logging

import pytest
from pydantic import SecretStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.security import verify_password
from app.db.models.categories import Category
from app.db.models.users import User
from app.modules.seed.seed_service import SeedConfigError, SeedResult, SeedService
from app.modules.users.user_registration_service import UserRegistrationService
from app.modules.users.users_repository import UsersRepository
from tests.conftest import FakeClock
from tests.factories import create_user

PASSWORD = "clave-inicial-segura"

EXPECTED = [
    # (sort_order, name, kind, icon, color) — data-model.md "Categorías iniciales del usuario"
    (0, "Transporte", "EXPENSE", "car-outline", "#06B6D4"),
    (1, "Alimentación", "EXPENSE", "restaurant-outline", "#F97316"),
    (2, "Entretenimiento", "EXPENSE", "film-outline", "#EC4899"),
    (3, "Suscripciones", "EXPENSE", "repeat-outline", "#6366F1"),
    (4, "Servicios", "EXPENSE", "flash-outline", "#EAB308"),
    (5, "Mercado", "EXPENSE", "cart-outline", "#F59E0B"),
    (6, "Combustible", "EXPENSE", "speedometer-outline", "#EF4444"),
    (7, "Parqueadero", "EXPENSE", "location-outline", "#64748B"),
    (8, "Salud", "EXPENSE", "medkit-outline", "#10B981"),
    (9, "Fitness", "EXPENSE", "barbell-outline", "#D946EF"),
    (10, "Viajes", "EXPENSE", "airplane-outline", "#0EA5E9"),
    (11, "Ropa", "EXPENSE", "shirt-outline", "#A855F7"),
    (0, "Salario", "INCOME", "briefcase-outline", "#22C55E"),
    (1, "Rendimientos", "INCOME", "trending-up-outline", "#84CC16"),
    (2, "Otros ingresos", "INCOME", "cash-outline", "#14B8A6"),
]


def _settings(**values: object) -> Settings:
    defaults: dict[str, object] = {
        "initial_user_email": " Yo@Test.DEV ",
        "initial_user_password": SecretStr(PASSWORD),
        "initial_user_display_name": "Juan",
    }
    defaults.update(values)
    return get_settings().model_copy(update=defaults)


def _service(session: AsyncSession, clock: FakeClock, settings: Settings) -> SeedService:
    users = UsersRepository(session)
    return SeedService(users, UserRegistrationService(session, users, clock), settings)


async def _count(session: AsyncSession, model: type[User] | type[Category]) -> int:
    return await session.scalar(select(func.count()).select_from(model)) or 0


async def test_seed_creates_user_and_categories(
    db_session: AsyncSession, frozen_clock: FakeClock, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    result = await _service(db_session, frozen_clock, _settings()).run()

    assert result is SeedResult.CREATED
    user = (await db_session.scalars(select(User))).one()
    assert user.email == "yo@test.dev"
    assert user.display_name == "Juan"
    assert verify_password(PASSWORD, user.password_hash)

    categories = (
        await db_session.scalars(
            select(Category).order_by(Category.kind.desc(), Category.sort_order)
        )
    ).all()
    expense = [c for c in categories if c.kind == "EXPENSE"]
    income = [c for c in categories if c.kind == "INCOME"]
    actual = [(c.sort_order, c.name, c.kind, c.icon, c.color) for c in expense + income]
    assert actual == EXPECTED
    assert all(c.deleted_at is None and c.user_id == user.id for c in categories)
    assert PASSWORD not in caplog.text


async def test_seed_skips_when_a_user_exists(
    db_session: AsyncSession, frozen_clock: FakeClock
) -> None:
    existing = await create_user(db_session, email="ya@test.dev", password="otra-clave-123")
    original_hash = existing.password_hash

    result = await _service(
        db_session, frozen_clock, _settings(initial_user_password=None, initial_user_email=None)
    ).run()

    assert result is SeedResult.SKIPPED
    assert await _count(db_session, User) == 1
    assert await _count(db_session, Category) == 0
    assert existing.password_hash == original_hash


@pytest.mark.parametrize(
    ("values", "variable"),
    [
        ({"initial_user_email": None}, "INITIAL_USER_EMAIL"),
        ({"initial_user_email": "no-es-correo"}, "INITIAL_USER_EMAIL"),
        ({"initial_user_password": None}, "INITIAL_USER_PASSWORD"),
        ({"initial_user_password": SecretStr("x" * 7)}, "INITIAL_USER_PASSWORD"),
        ({"initial_user_password": SecretStr("x" * 129)}, "INITIAL_USER_PASSWORD"),
        ({"initial_user_display_name": "n" * 101}, "INITIAL_USER_DISPLAY_NAME"),
    ],
)
async def test_seed_rejects_invalid_variables(
    db_session: AsyncSession, frozen_clock: FakeClock, values: dict[str, object], variable: str
) -> None:
    with pytest.raises(SeedConfigError, match=variable) as error:
        await _service(db_session, frozen_clock, _settings(**values)).run()
    assert "x" * 7 not in str(error.value)
    assert await _count(db_session, User) == 0
    assert await _count(db_session, Category) == 0
