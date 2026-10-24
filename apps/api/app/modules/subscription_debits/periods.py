"""Periodo actual y fecha de cobro (research R3). Puro: sin E/S ni reloj.

Misma regla que `nextBillingDate` de la app: el día se ajusta al último del mes si este es más
corto (31 en noviembre → 30; 29/02 en año no bisiesto → 28).
"""

from calendar import monthrange
from datetime import date
from typing import Literal

BillingCycle = Literal["MONTHLY", "YEARLY"]


def current_period(cycle: BillingCycle, d: date) -> str:
    """`YYYY-MM` en mensuales y `YYYY` en anuales."""
    return f"{d.year:04}-{d.month:02}" if cycle == "MONTHLY" else f"{d.year:04}"


def billing_date(cycle: BillingCycle, billing_day: int, billing_month: int | None, d: date) -> date:
    """Fecha de cobro del periodo que contiene `d`."""
    if cycle == "MONTHLY":
        month = d.month
    elif billing_month is None:
        raise ValueError("una suscripción anual necesita billing_month")
    else:
        month = billing_month
    return date(d.year, month, min(billing_day, monthrange(d.year, month)[1]))


def is_due(billing_date: date, start_date: date, activation_date: date, d: date) -> bool:
    """Se cobra si la fecha ya llegó (hoy o antes, dentro del periodo actual: FR-007), no es
    anterior al inicio de la suscripción (FR-006) ni a la activación del servicio (FR-007a)."""
    return start_date <= billing_date <= d and billing_date >= activation_date
