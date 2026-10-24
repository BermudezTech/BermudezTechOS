"""Ejecución de cobros para una fecha (research R5).

Una transacción por usuario con el lock exclusivo de sincronización: ningún PULL concurrente del
usuario deja un cobro detrás de su cursor (FR-016).
"""

import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from itertools import batched

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.clock import Clock
from app.modules.subscription_debits import repository
from app.modules.subscription_debits.periods import billing_date, current_period, is_due
from app.modules.sync.core.lock import user_sync_lock

logger = logging.getLogger("app.subscription_debits")

BATCH_SIZE = 500


@dataclass
class RunSummary:
    run_date: date
    trigger: str
    users: int = 0
    subscriptions: int = 0
    created: int = 0
    existing: int = 0
    not_due: int = 0
    skipped_account: int = 0
    failed: int = 0
    failures: list[tuple[uuid.UUID, str]] = field(default_factory=list)
    duration_ms: int = 0


class SubscriptionDebitService:
    def __init__(
        self, sessions: async_sessionmaker[AsyncSession], clock: Clock, activation_date: date
    ) -> None:
        self._sessions = sessions
        self._clock = clock
        self._activation_date = activation_date

    async def run_for_date(self, d: date, trigger: str) -> RunSummary:
        summary = RunSummary(run_date=d, trigger=trigger)
        started = time.monotonic()
        logger.info("Ejecución de cobros: fecha=%s trigger=%s", d, trigger)
        async with self._sessions() as session:
            user_ids = await repository.candidate_user_ids(session)
        for user_id in user_ids:
            try:
                await self._run_for_user(user_id, d, summary)
            except Exception as error:
                # Fallo fuera de los savepoints (p. ej. conexión): se deshace solo este usuario.
                logger.warning(
                    "Cobros del usuario fallidos: user=%s motivo=%s", user_id, type(error).__name__
                )
        summary.users = len(user_ids)
        summary.duration_ms = round((time.monotonic() - started) * 1000)
        # Siempre, también con todo en 0: así se ve que la ejecución ocurrió (US4).
        logger.info(
            "Resumen de cobros: fecha=%s trigger=%s usuarios=%s suscripciones=%s creados=%s "
            "existentes=%s no_vencidos=%s omitidos=%s fallidos=%s duracion_ms=%s",
            summary.run_date,
            summary.trigger,
            summary.users,
            summary.subscriptions,
            summary.created,
            summary.existing,
            summary.not_due,
            summary.skipped_account,
            summary.failed,
            summary.duration_ms,
        )
        return summary

    async def _run_for_user(self, user_id: uuid.UUID, d: date, summary: RunSummary) -> None:
        async with self._sessions() as session, session.begin():
            await user_sync_lock(session, user_id, shared=False)
            rows = await repository.candidate_subscriptions(session, user_id)
            now = self._clock.now()
            pending: list[repository.PendingDebit] = []
            for row in rows:
                summary.subscriptions += 1
                period = current_period(row.billing_cycle, d)
                due = billing_date(row.billing_cycle, row.billing_day, row.billing_month, d)
                if not is_due(due, row.start_date, self._activation_date, d):
                    summary.not_due += 1
                elif not row.account_ok:
                    summary.skipped_account += 1
                    logger.info(
                        "Cobro omitido: subscription=%s period=%s motivo=cuenta no disponible",
                        row.id,
                        period,
                    )
                else:
                    pending.append(repository.PendingDebit(row, period, due))
            # Bloques acotados: PostgreSQL admite como máximo 32.767 parámetros por sentencia.
            for chunk in batched(pending, BATCH_SIZE, strict=False):
                await self._insert(session, list(chunk), now, summary)

    async def _insert(
        self,
        session: AsyncSession,
        pending: list[repository.PendingDebit],
        now: datetime,
        summary: RunSummary,
    ) -> None:
        # Camino normal: un INSERT por usuario (SC-005). Si falla, se repite uno por uno, cada
        # cobro en su savepoint, para aislar el que falla (FR-015).
        try:
            async with session.begin_nested():
                created = await repository.insert_debits(session, pending, now)
        except Exception:
            for debit in pending:
                await self._insert_one(session, debit, now, summary)
            return
        summary.created += created
        summary.existing += len(pending) - created

    async def _insert_one(
        self,
        session: AsyncSession,
        debit: repository.PendingDebit,
        now: datetime,
        summary: RunSummary,
    ) -> None:
        try:
            async with session.begin_nested():
                created = await repository.insert_debit(
                    session, debit.row, debit.period, debit.billing_date, now
                )
        except Exception as error:
            # Solo la clase: el mensaje podría incluir datos del registro.
            reason = type(error).__name__
            summary.failed += 1
            summary.failures.append((debit.row.id, reason))
            logger.warning(
                "Cobro fallido: subscription=%s period=%s motivo=%s",
                debit.row.id,
                debit.period,
                reason,
            )
            return
        if created:
            summary.created += 1
        else:
            summary.existing += 1
