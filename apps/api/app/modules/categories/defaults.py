"""Set inicial de categorías que recibe cada usuario al registrarse (FR-016).

Ícono (Ionicons) y color coinciden con el cliente cuando la categoría ya existía allí.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from app.db.models.categories import Category


@dataclass(frozen=True)
class DefaultCategory:
    name: str
    kind: str
    icon: str
    color: str
    sort_order: int


DEFAULT_CATEGORIES: tuple[DefaultCategory, ...] = (
    DefaultCategory("Transporte", "EXPENSE", "car-outline", "#06B6D4", 0),
    DefaultCategory("Alimentación", "EXPENSE", "restaurant-outline", "#F97316", 1),
    DefaultCategory("Entretenimiento", "EXPENSE", "film-outline", "#EC4899", 2),
    DefaultCategory("Suscripciones", "EXPENSE", "repeat-outline", "#6366F1", 3),
    DefaultCategory("Servicios", "EXPENSE", "flash-outline", "#EAB308", 4),
    DefaultCategory("Mercado", "EXPENSE", "cart-outline", "#F59E0B", 5),
    DefaultCategory("Combustible", "EXPENSE", "speedometer-outline", "#EF4444", 6),
    DefaultCategory("Parqueadero", "EXPENSE", "location-outline", "#64748B", 7),
    DefaultCategory("Salud", "EXPENSE", "medkit-outline", "#10B981", 8),
    DefaultCategory("Fitness", "EXPENSE", "barbell-outline", "#D946EF", 9),
    DefaultCategory("Viajes", "EXPENSE", "airplane-outline", "#0EA5E9", 10),
    DefaultCategory("Ropa", "EXPENSE", "shirt-outline", "#A855F7", 11),
    DefaultCategory("Salario", "INCOME", "briefcase-outline", "#22C55E", 0),
    DefaultCategory("Rendimientos", "INCOME", "trending-up-outline", "#84CC16", 1),
    DefaultCategory("Otros ingresos", "INCOME", "cash-outline", "#14B8A6", 2),
)


def build_default_categories(user_id: uuid.UUID, now: datetime) -> list[Category]:
    return [
        Category(
            id=uuid.uuid4(),
            user_id=user_id,
            name=default.name,
            kind=default.kind,
            icon=default.icon,
            color=default.color,
            sort_order=default.sort_order,
            created_at=now,
            updated_at=now,
            # Sin `server_updated_at`: lo asigna la base (clock_timestamp()), la misma fuente que
            # usa el sync para sus cursores.
        )
        for default in DEFAULT_CATEGORIES
    ]
