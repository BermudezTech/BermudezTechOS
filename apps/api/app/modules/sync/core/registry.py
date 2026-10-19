"""Registro de tablas sincronizables.

**El orden de `SYNC_ENTITIES` es el orden de dependencias**: el PUSH aplica y el PULL entrega las
tablas en este orden, así una tabla siempre va después de las que referencia. Agregar una tabla =
crear `entities/<tabla>/` y añadirla aquí en su lugar (y en `TableName`).
"""

from typing import Any, Literal, get_args

from app.modules.sync.core.entity import SyncEntity
from app.modules.sync.entities.accounts.entity import AccountsSyncEntity
from app.modules.sync.entities.assets.entity import AssetsSyncEntity
from app.modules.sync.entities.categories.entity import CategoriesSyncEntity
from app.modules.sync.entities.cdts.entity import CdtsSyncEntity
from app.modules.sync.entities.recurring_incomes.entity import RecurringIncomesSyncEntity
from app.modules.sync.entities.reimbursement_groups.entity import ReimbursementGroupsSyncEntity
from app.modules.sync.entities.subscriptions.entity import SubscriptionsSyncEntity
from app.modules.sync.entities.transactions.entity import TransactionsSyncEntity

SYNC_ENTITIES: tuple[SyncEntity[Any], ...] = (
    CategoriesSyncEntity(),
    ReimbursementGroupsSyncEntity(),
    AssetsSyncEntity(),
    AccountsSyncEntity(),
    SubscriptionsSyncEntity(),
    RecurringIncomesSyncEntity(),
    CdtsSyncEntity(),
    TransactionsSyncEntity(),
)

TableName = Literal[
    "categories",
    "reimbursement_groups",
    "assets",
    "accounts",
    "subscriptions",
    "recurring_incomes",
    "cdts",
    "transactions",
]

ENTITY_BY_TABLE: dict[str, SyncEntity[Any]] = {entity.table: entity for entity in SYNC_ENTITIES}


def _check_registry() -> None:
    """Falla al importar si el registro no respeta el orden de dependencias."""
    if set(get_args(TableName)) != set(ENTITY_BY_TABLE):
        raise RuntimeError("TableName no coincide con SYNC_ENTITIES")
    seen: set[str] = set()
    for entity in SYNC_ENTITIES:
        for reference in entity.references:
            if reference.target != entity.table and reference.target not in seen:
                raise RuntimeError(
                    f"{entity.table}.{reference.field} referencia a {reference.target}, "
                    "que debe registrarse antes"
                )
        seen.add(entity.table)


_check_registry()
