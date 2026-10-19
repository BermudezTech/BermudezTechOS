"""Lock de sincronización por usuario (research S1).

El PUSH lo toma exclusivo y el PULL compartido, ambos hasta el fin de la transacción. Así un PULL
nunca lee mientras un PUSH del mismo usuario está sin confirmar, y un PUSH posterior asigna marcas
mayores que todo lo que ese PULL entregó: ningún cambio confirmado queda detrás de un cursor
(FR-019).

Regla: todo proceso del servidor que escriba datos de finanzas (p. ej. una futura generación de
débitos de suscripciones) MUST tomar este lock en modo exclusivo.
"""

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Espacio de claves propio ("SYNC") con la forma de dos enteros; el bootstrap usa un bigint.
SYNC_LOCK_NAMESPACE = 0x53594E43


def _user_key(user_id: uuid.UUID) -> int:
    return int.from_bytes(user_id.bytes[:4], "big", signed=True)


async def user_sync_lock(session: AsyncSession, user_id: uuid.UUID, *, shared: bool) -> None:
    function = "pg_advisory_xact_lock_shared" if shared else "pg_advisory_xact_lock"
    await session.execute(
        text(f"SELECT {function}(:namespace, :key)"),
        {"namespace": SYNC_LOCK_NAMESPACE, "key": _user_key(user_id)},
    )
