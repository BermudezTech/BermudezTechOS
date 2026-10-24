"""ID determinista del débito: cliente y servidor generan el mismo para el mismo periodo."""

from uuid import UUID, uuid5

# uuid5(NAMESPACE_URL, 'https://bermudeztech.os/subscription-debit'). No cambiar: la app generará
# el mismo ID y un namespace distinto duplicaría cobros.
NAMESPACE = UUID("9d1e0cb1-0ae7-5d67-856e-c19860851ef1")


def debit_id(subscription_id: UUID, period: str) -> UUID:
    return uuid5(NAMESPACE, f"{subscription_id}:{period}")
