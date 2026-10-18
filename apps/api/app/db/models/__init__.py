"""Importa todos los modelos para que `Base.metadata` esté completo (Alembic, pruebas)."""

from app.db.models.accounts import Account
from app.db.models.assets import Asset
from app.db.models.auth import LoginAttempt, PasswordResetCode, RefreshToken
from app.db.models.categories import Category
from app.db.models.cdts import Cdt
from app.db.models.recurring_incomes import RecurringIncome
from app.db.models.reimbursement_groups import ReimbursementGroup
from app.db.models.subscriptions import Subscription
from app.db.models.transactions import Transaction
from app.db.models.users import User

__all__ = [
    "Account",
    "Asset",
    "Category",
    "Cdt",
    "LoginAttempt",
    "PasswordResetCode",
    "RecurringIncome",
    "RefreshToken",
    "ReimbursementGroup",
    "Subscription",
    "Transaction",
    "User",
]
