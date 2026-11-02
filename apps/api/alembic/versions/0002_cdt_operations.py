"""cdt operations (spec 009)

CDTs sin cuenta de origen, cadena de renovaciones en una misma cuenta INVESTMENT, valor final
ajustado por el banco y liquidación (bruto/retención/neto) de cada periodo.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-01 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

MONEY_COLUMNS = (
    "maturity_value_override",
    "settled_gross_interest",
    "settled_withholding",
    "settled_net_interest",
)

CHECKS = {
    "ck_cdts_settled_all_or_none": (
        "(settled_gross_interest IS NULL AND settled_withholding IS NULL"
        " AND settled_net_interest IS NULL) OR (settled_gross_interest IS NOT NULL"
        " AND settled_withholding IS NOT NULL AND settled_net_interest IS NOT NULL)"
    ),
    "ck_cdts_settled_consistent": (
        "settled_gross_interest IS NULL"
        " OR settled_gross_interest - settled_withholding = settled_net_interest"
    ),
    "ck_cdts_settled_non_negative": (
        "settled_gross_interest IS NULL OR (settled_gross_interest >= 0"
        " AND settled_withholding >= 0 AND settled_net_interest >= 0)"
    ),
    "ck_cdts_maturity_value_gte_principal": (
        "maturity_value_override IS NULL OR maturity_value_override >= principal"
    ),
}


def upgrade() -> None:
    op.alter_column("cdts", "source_account_id", existing_type=sa.Uuid(), nullable=True)
    op.drop_constraint("uq_cdts_account_id", "cdts", type_="unique")
    op.create_index("ix_cdts_user_id_account_id", "cdts", ["user_id", "account_id"], unique=False)
    for column in MONEY_COLUMNS:
        op.add_column("cdts", sa.Column(column, sa.Numeric(precision=14, scale=2), nullable=True))
    for name, condition in CHECKS.items():
        op.create_check_constraint(name, "cdts", condition)


def downgrade() -> None:
    bind = op.get_bind()
    orphans = bind.execute(sa.text("SELECT count(*) FROM cdts WHERE source_account_id IS NULL"))
    if orphans.scalar_one():
        raise RuntimeError(
            "No se puede revertir 0002: hay CDTs sin cuenta de origen (existentes o renovaciones)."
        )
    for name in reversed(CHECKS):
        op.drop_constraint(name, "cdts", type_="check")
    for column in reversed(MONEY_COLUMNS):
        op.drop_column("cdts", column)
    op.drop_index("ix_cdts_user_id_account_id", table_name="cdts")
    op.create_unique_constraint("uq_cdts_account_id", "cdts", ["account_id"])
    op.alter_column("cdts", "source_account_id", existing_type=sa.Uuid(), nullable=False)
