"""Orquesta el PUSH y el PULL sobre el núcleo del sync y las entidades registradas.

El servicio no conoce ninguna tabla concreta: recorre `SYNC_ENTITIES` en orden de dependencias y
delega en cada entidad su validación, referencias y coherencia.
"""

import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any

from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.core.clock import Clock
from app.core.errors import AppError, validation_details
from app.modules.sync.core import config
from app.modules.sync.core.batch import BatchContext, Outcome
from app.modules.sync.core.cursor import InvalidCursorError, decode_cursor, encode_cursor
from app.modules.sync.core.entity import SyncEntity, SyncRecord
from app.modules.sync.core.ordering import topological_order
from app.modules.sync.core.reasons import RejectCode, Rejection
from app.modules.sync.core.references import (
    ResolvedRefs,
    check_reference,
    resolve_references,
)
from app.modules.sync.core.registry import SYNC_ENTITIES
from app.modules.sync.core.sync_repository import SyncRepository
from app.modules.sync.schemas import (
    PullRequest,
    PullResponse,
    PushRequest,
    PushResponse,
    RecordResult,
    TablePage,
)

# Violaciones de la base que no tienen un código propio en la entidad (SQLSTATE).
_FOREIGN_KEY_VIOLATION = "23503"
_UNIQUE_VIOLATION = "23505"


class PushTooLargeError(AppError):
    def __init__(self) -> None:
        super().__init__(
            413,
            "PUSH_TOO_LARGE",
            f"El lote supera el máximo de {config.MAX_PUSH_RECORDS} registros. Divídelo.",
        )


class SyncService:
    def __init__(self, repository: SyncRepository, clock: Clock) -> None:
        self._repository = repository
        self._clock = clock

    # --- PUSH -----------------------------------------------------------------------------

    async def push(self, request: PushRequest) -> PushResponse:
        total = sum(len(records) for records in request.changes.values())
        if total > config.MAX_PUSH_RECORDS:
            raise PushTooLargeError()

        await self._repository.lock(shared=False)
        # Posición de cada registro en la petición: la respuesta conserva ese orden.
        positioned: dict[str, list[tuple[int, dict[str, Any]]]] = defaultdict(list)
        position = 0
        for table, raws in request.changes.items():
            for raw in raws:
                positioned[table].append((position, raw))
                position += 1

        batch = BatchContext()
        for entity in SYNC_ENTITIES:
            if positioned.get(entity.table):
                await self._push_table(entity, positioned[entity.table], batch)
        return PushResponse(
            results=[_result(outcome) for outcome in batch.outcomes()],
            server_time=self._clock.now(),
        )

    async def _push_table(
        self,
        entity: SyncEntity[Any],
        raws: list[tuple[int, dict[str, Any]]],
        batch: BatchContext,
    ) -> None:
        table = entity.table
        valid: list[tuple[int, SyncRecord]] = []
        latest_allowed = self._clock.now() + config.MAX_FUTURE_SKEW
        for position, raw in raws:
            try:
                record = entity.record_schema.model_validate(raw)
            except ValidationError as exc:
                rejection = Rejection(
                    RejectCode.VALIDATION_ERROR,
                    "El registro tiene datos inválidos.",
                    validation_details(exc.errors()),
                )
                batch.rejected(position, table, _raw_id(raw), rejection)
                continue
            if record.updated_at > latest_allowed:
                batch.rejected(position, table, record.id, Rejection.of(RejectCode.CLOCK_AHEAD))
                continue
            valid.append((position, record))

        if entity.self_reference is not None:
            field = entity.self_reference
            valid, cyclic = topological_order(
                valid, lambda item: item[1].id, lambda item: getattr(item[1], field)
            )
            for position, record in cyclic:
                rejection = Rejection.of(
                    RejectCode.INVALID_REFERENCE, "Las referencias del registro forman un ciclo."
                )
                batch.rejected(position, table, record.id, rejection)

        records = [record for _, record in valid]
        refs = await resolve_references(entity, records, batch, self._repository)
        await entity.prefetch(records, self._repository, refs)

        for position, record in valid:
            problem = _reference_problem(entity, record, refs) or entity.check_coherence(
                record, refs, batch
            )
            if problem is not None:
                batch.rejected(position, table, record.id, problem)
                continue
            await self._write(entity, position, record, batch)

    # --- PULL -----------------------------------------------------------------------------

    async def pull(self, request: PullRequest) -> PullResponse:
        await self._repository.lock(shared=True)
        received: dict[str, str | None] = {str(t): c for t, c in request.cursors.items()}
        positions: dict[str, tuple[datetime, uuid.UUID]] = {}
        for table, cursor in received.items():
            if cursor is None:
                continue
            try:
                positions[table] = decode_cursor(cursor)
            except ValueError:
                raise InvalidCursorError(table) from None

        # Presupuesto común a todas las tablas, que se reparte en orden de dependencias.
        budget = config.PULL_PAGE_SIZE
        changes: dict[str, TablePage] = {}
        for entity in SYNC_ENTITIES:
            # Se pide uno más para saber si quedan cambios (con presupuesto 0, solo eso).
            rows = await self._repository.pull_page(
                entity.model, positions.get(entity.table), budget + 1
            )
            has_more = len(rows) > budget
            rows = rows[:budget]
            budget -= len(rows)
            cursor = received.get(entity.table)
            if rows:
                cursor = encode_cursor(rows[-1].server_updated_at, rows[-1].id)
            changes[entity.table] = TablePage(
                records=[
                    entity.to_record(row).model_dump(mode="json", by_alias=True) for row in rows
                ],
                cursor=cursor,
                has_more=has_more,
            )
        return PullResponse(
            changes=changes,
            has_more=any(page.has_more for page in changes.values()),
        )

    async def _write(
        self, entity: SyncEntity[Any], position: int, record: SyncRecord, batch: BatchContext
    ) -> None:
        values = record.model_dump(exclude={"server_updated_at"}, by_alias=False)
        try:
            async with self._repository.savepoint():
                written = await self._repository.upsert_lww(entity.model, values)
        except IntegrityError as exc:
            batch.rejected(position, entity.table, record.id, _integrity_rejection(entity, exc))
            return
        if written:
            batch.applied(position, entity.table, record)
        elif await self._repository.exists_for_user(entity.model, record.id):
            batch.discarded(position, entity.table, record.id)
        else:
            # El ID existe a nombre de otro usuario: no se revela ni se sobrescribe.
            batch.rejected(position, entity.table, record.id, Rejection.of(RejectCode.ID_CONFLICT))


def _reference_problem(
    entity: SyncEntity[Any], record: SyncRecord, refs: ResolvedRefs
) -> Rejection | None:
    for reference in entity.references:
        rejection = check_reference(reference, getattr(record, reference.field), refs)
        if rejection is not None:
            return rejection
    return None


def _raw_id(raw: dict[str, Any]) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(raw.get("id")))
    except ValueError:
        return None


def _integrity_rejection(entity: SyncEntity[Any], error: IntegrityError) -> Rejection:
    cause = getattr(error.orig, "__cause__", None)
    constraint = getattr(cause, "constraint_name", None)
    if constraint in entity.constraint_codes:
        return Rejection.of(entity.constraint_codes[constraint])
    sqlstate = getattr(cause, "sqlstate", None)
    if sqlstate == _FOREIGN_KEY_VIOLATION:
        return Rejection.of(RejectCode.INVALID_REFERENCE)
    if sqlstate == _UNIQUE_VIOLATION:
        return Rejection.of(RejectCode.DUPLICATE)
    return Rejection.of(RejectCode.VALIDATION_ERROR)


def _result(outcome: Outcome) -> RecordResult:
    rejection = outcome.rejection
    return RecordResult(
        table=outcome.table,
        id=outcome.id,
        status=outcome.status,
        code=rejection.code if rejection else None,
        message=rejection.message if rejection else None,
        details=rejection.details if rejection else None,
    )
