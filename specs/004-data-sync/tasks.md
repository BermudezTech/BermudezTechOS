---
description: "Tareas para implementar la sincronización PUSH/PULL de las tablas de finanzas"
---

# Tasks: Sincronización de datos de finanzas (PUSH/PULL)

**Input**: Design documents from `/specs/004-data-sync/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [quickstart.md](./quickstart.md)

**Tests**: incluidos.
- La constitución exige pruebas automatizadas de la lógica de sincronización ("Flujo y calidad").
- SC-002, SC-003, SC-004 y SC-007 piden resultados medibles en pruebas.
- Las pruebas de cada historia se escriben primero y deben fallar antes de implementar.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: historia de usuario de [spec.md](./spec.md): US1 (PUSH), US2 (PULL) y US3 (multi-dispositivo).

## Path Conventions

- Abreviaturas: `API/` = `apps/api/`, `APP/` = `apps/api/app/`, `SYNC/` = `apps/api/app/modules/sync/`, `TESTS/` = `apps/api/tests/`.
- **Comandos**: se ejecutan desde `apps/api` con `uv run …`.
- **Convenciones del código existente** (spec 003), que se mantienen:
  - controlador (solo rutas) → servicio → repositorio con alcance de usuario;
  - providers en `dependencies.py`;
  - DTOs que heredan de `CamelModel` (`APP/common/schemas.py`), con fechas `UtcDateTime`;
  - errores con `AppError` (`APP/core/errors.py`);
  - docstrings y comentarios en español e identificadores en inglés.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: esqueleto del módulo `sync` según plan.md → Source Code.

- [X] T001 Create the package skeleton with empty `__init__.py` files: `SYNC/__init__.py`, `SYNC/core/__init__.py`, `SYNC/entities/__init__.py`, and one package per entity under `SYNC/entities/`: `categories/`, `reimbursement_groups/`, `assets/`, `accounts/`, `subscriptions/`, `recurring_incomes/`, `cdts/`, `transactions/`. Also create `TESTS/unit/sync/__init__.py` and `TESTS/integration/sync/__init__.py`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: núcleo del sync y declaración de las 8 entidades. Lo usan tanto el PUSH como el PULL.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta terminar esta fase.

### Tipos y marca del servidor

- [X] T002 [P] Add exact-decimal string types to `APP/common/schemas.py` (research S8):
  - `MoneyStr`: accepts **only JSON strings** matching `^\d{1,12}(\.\d{1,2})?$`; JSON numbers are rejected. Parses to `Decimal`, never `float`, and serializes as a string with exactly 2 decimals (`"0.10"`).
  - `RateStr`: pattern `^\d{1,3}(\.\d{1,4})?$`, serialized with 4 decimals (for `NUMERIC(7,4)`).
  - `PercentStr`: pattern `^\d{1,3}(\.\d{1,2})?$`, serialized with 2 decimals (for `NUMERIC(5,2)`).

  Values are never rounded. Use `Annotated` + `BeforeValidator` / `PlainSerializer(when_used="json")`, in the same style as `UtcDateTime`.
- [X] T003 [P] Unit tests for T002 in `TESTS/unit/sync/test_money_types.py`:
  - `"0.10"`, `"0.20"` and `"0.30"` round-trip unchanged.
  - `"1234.5"` serializes as `"1234.50"`.
  - Rejected inputs: `1234.5` (number), `"1.234"`, `"-1.00"`, `"1e3"`, `""` and 13 integer digits.
- [X] T004 Change `UserScopedRepository.add` and `UserScopedRepository.touch` in `APP/common/repository.py` (research S2):
  - Set `server_updated_at` to `func.clock_timestamp()` instead of `self._clock.now()`. Keep the ownership assignment and checks.
  - Update the docstring to explain why: there must be a single time source for cursors.
  - Then fix any test in `TESTS/integration/test_seed.py` or `TESTS/integration/test_user_registration.py` that compares `server_updated_at` with the frozen clock: assert it is not null and ordered instead. Run `uv run pytest tests/integration -k "seed or registration"` and confirm it passes.

### Núcleo `SYNC/core/`

- [X] T005 [P] Create `SYNC/core/config.py` with module constants and docstrings that point to research S9:
  - `MAX_PUSH_RECORDS = 500`
  - `PULL_PAGE_SIZE = 1000`
  - `MAX_FUTURE_SKEW = timedelta(hours=24)`
  - `MAX_PUSH_BODY_BYTES = 2 * 1024 * 1024`
- [X] T006 [P] Create `SYNC/core/reasons.py`:
  - `class RecordStatus(StrEnum)`: `APPLIED`, `DISCARDED`, `REJECTED`.
  - `class RejectCode(StrEnum)`: `VALIDATION_ERROR`, `INVALID_REFERENCE`, `DEPENDENCY_REJECTED`, `INCOHERENT`, `DUPLICATE`, `ID_CONFLICT`, `CLOCK_AHEAD`.
  - A dict of default Spanish messages per code. `ID_CONFLICT` must use a generic text that reveals nothing about other users, e.g. "No se pudo guardar este registro."
  - A frozen dataclass `Rejection(code, message, details=None)`.
- [X] T007 [P] Create `SYNC/core/cursor.py` (research S3):
  - `encode_cursor(server_updated_at: datetime, record_id: uuid.UUID) -> str`: base64url, no padding, of compact JSON `{"t": iso_utc_with_microseconds, "id": str}`.
  - `decode_cursor(value: str) -> tuple[datetime, uuid.UUID]`: raises `InvalidCursorError` on any malformed input.
  - Add `InvalidCursorError(AppError)` here with status 422 and code `INVALID_CURSOR`. Its `details` include the table (`[{"table": name}]`).
- [X] T008 [P] Unit tests in `TESTS/unit/sync/test_cursor.py`:
  - Round-trip preserves microseconds and the UUID.
  - `"basura"`, a valid base64 of non-JSON, JSON without `t` or `id`, and an invalid UUID all raise `InvalidCursorError`.
- [X] T009 [P] Create `SYNC/core/lock.py` (research S1):
  - `async def user_sync_lock(session: AsyncSession, user_id: uuid.UUID, *, shared: bool) -> None`. It runs `SELECT pg_advisory_xact_lock_shared(:k1, :k2)` when shared and `SELECT pg_advisory_xact_lock(:k1, :k2)` otherwise.
  - Use the two-int form: `k1` = a fixed namespace constant `SYNC_LOCK_NAMESPACE` that differs from the bootstrap lock key in `APP/bootstrap.py` (check it); `k2` = the first 4 bytes of `user_id` as a signed int32.
  - The docstring states the rule: every server-side writer of finance data MUST take this lock in exclusive mode.
- [X] T010 [P] Create `SYNC/core/ordering.py`:
  - `topological_order(records: list[T], key: Callable[[T], UUID], parent: Callable[[T], UUID | None]) -> tuple[list[T], list[T]]` returns `(ordered, cyclic)`.
  - Parents present in the list come before their children. Parents not in the list are ignored (they are resolved against the DB later). Records that take part in a cycle go to `cyclic`.
  - The order is stable for records that are unrelated.
- [X] T011 [P] Unit tests in `TESTS/unit/sync/test_ordering.py`: child before parent in the input gets reordered; parent outside the batch; a 2-node cycle and a self-cycle go to `cyclic`; stable order is kept.
- [X] T012 Create `SYNC/core/entity.py` with the contract every entity implements (plan.md → Structure Decision). Use an abstract base class `SyncEntity[ModelT, RecordT]` with:
  - class attributes:
    - `table: str` and `model: type[ModelT]` (existing SQLAlchemy model);
    - `record_schema: type[RecordT]` (a `SyncRecord` subclass);
    - `references: tuple[Reference, ...]`, where `Reference = (field: str, target_table: str)` is a frozen dataclass;
    - `self_reference: str | None = None`;
    - `reference_fields: dict[str, tuple[str, ...]]`: the columns to fetch from each target table for coherence, e.g. `{"categories": ("kind",)}`;
    - `constraint_codes: dict[str, RejectCode]`: DB constraint name → reject code.
  - method `check_coherence(self, record: RecordT, refs: ResolvedRefs, batch: BatchContext) -> Rejection | None`, which returns `None` by default.
  - Also define `SyncRecord(CamelModel)`, the base of every record schema:
    - fields `id: uuid.UUID`, `created_at: UtcDateTime`, `updated_at: UtcDateTime`, `deleted_at: UtcDateTime | None = None`, `server_updated_at: UtcDateTime | None = None`;
    - `model_config = ConfigDict(extra="ignore")`, so `userId` and `isDirty` are dropped;
    - `server_updated_at` is ignored on input (the service never writes it from the record) and always filled on output.
- [X] T013 Create `SYNC/core/batch.py`, the `BatchContext` (research S6). Per table it keeps:
  - `applied: set[UUID]` (applied or discarded = exists);
  - `rejected: dict[UUID, RejectCode]`;
  - `accepted_records: dict[UUID, SyncRecord]` (the version accepted in this batch, used for coherence);
  - `results: list[RecordResult]` in input order.

  Helpers: `mark_applied`, `mark_discarded`, `mark_rejected(table, id | None, Rejection)`, `is_rejected(table, id)` and `accepted(table, id)` (depends on T006, T012).
- [X] T014 Create `SYNC/core/sync_repository.py`, a user-scoped repository constructed like `UserScopedRepository` (`session`, `user_id`; no clock needed), with:
  - `upsert_lww(entity, values: dict) -> bool` (research S4):
    - a single `postgresql.insert(model).values(**values, user_id=self.user_id).on_conflict_do_update(index_elements=["id"], set_={all columns except id, user_id, created_at… use the incoming values} | {"server_updated_at": func.clock_timestamp()}, where=(model.user_id == self.user_id) & (insert.excluded.updated_at > model.updated_at)).returning(model.id)`;
    - returns `True` if a row was returned.
    - `created_at` is set on insert and **not** overwritten on update.
  - `exists_for_user(entity, record_id) -> bool`, including soft-deleted rows.
  - `fetch_refs(target_entity, ids: set[UUID], fields: tuple[str, ...]) -> dict[UUID, Row]`: one query `WHERE user_id = :u AND id = ANY(:ids)`, including soft-deleted rows.
  - `fetch_children_exist(entity_model, parent_field, ids) -> set[UUID]`: used by `accounts` to know which IDs already have sub-accounts.
  - `pull_page(entity, after: tuple[datetime, UUID] | None, limit: int) -> list[Model]`: `WHERE user_id = :u AND (server_updated_at, id) > (:t, :id) ORDER BY server_updated_at, id LIMIT :limit`. No condition on `deleted_at`, so deletions are included.

  No method accepts a `user_id` argument.
- [X] T015 Create `SYNC/core/references.py`:
  - `async def resolve_references(entity, records, batch, repo) -> ResolvedRefs`. It collects the referenced IDs per target table from the valid records, **excluding** IDs accepted or rejected in the batch, and calls `repo.fetch_refs` once per target table with `entity.reference_fields.get(target, ())`.
  - `def check_reference(ref: Reference, value: UUID | None, resolved, batch) -> Rejection | None`, in the order from research S6:
    1. `None` → ok;
    2. rejected in the batch → `DEPENDENCY_REJECTED`;
    3. accepted in the batch → ok;
    4. in `resolved` → ok;
    5. otherwise → `INVALID_REFERENCE`.

    The message never says whether the ID belongs to another user.
  - `ResolvedRefs` gives `get(target_table, id)`, which returns the batch-accepted record if present, else the DB row (depends on T013, T014).
- [X] T016 Create the request/response DTOs in `SYNC/schemas.py` (contracts/http-api.md):
  - `PushRequest`: `changes: dict[TableName, list[dict[str, Any]]]`. `TableName` is a `Literal` of the 8 tables, so an unknown table → 422 `VALIDATION_ERROR` from the existing handler. Records stay as raw dicts so each one is validated individually.
  - `RecordResult`: `table`, `id: UUID | None`, `status: RecordStatus`, `code: RejectCode | None = None`, `message: str | None = None`, `details: list[dict] | None = None`. Serialize without null `code`, `message` and `details`.
  - `PushResponse`: `results: list[RecordResult]`, `server_time: UtcDateTime`.
  - `PullRequest`: `cursors: dict[TableName, str | None] = {}`.
  - `TablePage`: `records: list[dict[str, Any]]`, `cursor: str | None`, `has_more: bool`.
  - `PullResponse`: `changes: dict[str, TablePage]` (all 8 tables, in registry order) and `has_more: bool`.

  All of them inherit from `CamelModel`.

### Entidades `SYNC/entities/<tabla>/`

Cada entidad tiene `schemas.py` (el registro, que hereda de `SyncRecord`) y `entity.py` (la subclase de `SyncEntity` con `table`, `model`, `record_schema`, `references`, `self_reference`, `reference_fields` y `constraint_codes`). Las reglas de **un solo registro** van en `schemas.py` como `model_validator`. Las reglas de **coherencia** se añaden en US1 (T026–T030). Los campos son los de data-model.md §2. Las cadenas opcionales son `str | None = None`.

- [X] T017 [P] `SYNC/entities/categories/`:
  - Fields: `name` (1–50), `kind: Literal["INCOME","EXPENSE"]`, `icon: str | None` (≤50), `color: str | None` (≤50), `sort_order: int = 0`.
  - `references = ()`.
  - `constraint_codes = {"uq_categories_user_name_kind": DUPLICATE}`.
- [X] T018 [P] `SYNC/entities/reimbursement_groups/`:
  - Fields: `name` (1–100), `payer: str | None` (≤100), `kind: Literal["REIMBURSEMENT","ADVANCE"]`, `status: Literal["OPEN","SUBMITTED","SETTLED"] = "OPEN"`, `notes: str | None`.
  - `references = ()`.
- [X] T019 [P] `SYNC/entities/assets/`:
  - Fields: `name` (1–100), `value: MoneyStr` ("CHECK ≥ 0"), `valid_until: date`.
  - `references = ()`.
- [X] T020 [P] `SYNC/entities/accounts/`:
  - Fields: `parent_account_id: UUID | None`, `name` (1–100), `type: Literal["CHECKING","SAVINGS","CASH","CREDIT_CARD","POCKET","INVESTMENT"]`, `nature: Literal["ASSET","LIABILITY"]`, `currency: Literal["COP"] = "COP"`, `icon`/`color: str | None` (≤50), `opening_balance: MoneyStr = "0.00"`, `credit_limit: MoneyStr | None`, `statement_day`/`payment_due_day: int | None` (1–31), `is_excluded_from_net_worth: bool = False`, `is_archived: bool = False`, `sort_order: int = 0`.
  - Record rules: "`CREDIT_CARD` ⇒ `nature = LIABILITY`" and "`parentAccountId ≠ id`".
  - `references = (Reference("parent_account_id", "accounts"),)`, `self_reference = "parent_account_id"`, `reference_fields = {"accounts": ("parent_account_id", "type")}`.
- [X] T021 [P] `SYNC/entities/subscriptions/`:
  - Fields: `account_id: UUID`, `category_id: UUID | None`, `name` (1–100), `icon` (≤100), `amount: MoneyStr` ("CHECK > 0"), `billing_cycle: Literal["MONTHLY","YEARLY"] = "MONTHLY"`, `billing_day` (1–31), `billing_month: int | None` (1–12), `start_date: date`, `status: Literal["ACTIVE","PAUSED","CANCELLED"] = "ACTIVE"`.
  - Record rule: "`billingMonth` obligatorio si y solo si el ciclo es `YEARLY`".
  - References: `account_id → accounts`, `category_id → categories`. `reference_fields = {"categories": ("kind",)}`.
- [X] T022 [P] `SYNC/entities/recurring_incomes/`:
  - Fields: `account_id`, `category_id: UUID | None`, `name` (1–100), `icon` (≤100), `expected_amount: MoneyStr` (> 0), `cycle: Literal["MONTHLY","YEARLY"] = "MONTHLY"`, `expected_day` (1–31), `expected_month: int | None` (1–12), `start_date: date`, `status: Literal["ACTIVE","PAUSED"] = "ACTIVE"`.
  - Record rule: "`expectedMonth` obligatorio si y solo si el ciclo es `YEARLY`".
  - References: `account_id → accounts`, `category_id → categories`. `reference_fields = {"categories": ("kind",)}`.
- [X] T023 [P] `SYNC/entities/cdts/`:
  - Fields: `account_id`, `issuer` (1–100), `certificate_number: str | None` (≤50), `principal: MoneyStr` (> 0), `annual_rate_ea: RateStr`, `annual_rate_nominal: RateStr`, `term_days: int` (> 0), `opened_on: date`, `matures_on: date`, `interest_payment: Literal["AT_MATURITY","MONTHLY","QUARTERLY","SEMIANNUAL","ANNUAL"]`, `withholding_rate: PercentStr = "4.00"`, `source_account_id: UUID`, `payout_account_id: UUID | None`, `status: Literal["ACTIVE","MATURED","RENEWED","CANCELLED"] = "ACTIVE"`, `renewed_from_cdt_id: UUID | None`.
  - Record rule: "`renewedFromCdtId ≠ id`".
  - References: `account_id`, `source_account_id`, `payout_account_id → accounts`; `renewed_from_cdt_id → cdts`. `self_reference = "renewed_from_cdt_id"`, `reference_fields = {"accounts": ("type",)}`.
  - `constraint_codes`: the unique constraint on `cdts.account_id` → `DUPLICATE`. Read its exact name in `APP/db/models/cdts.py` or `API/alembic/versions/0001_initial_schema.py`.
- [X] T024 [P] `SYNC/entities/transactions/`:
  - Fields: `account_id`, `counter_account_id: UUID | None`, `type: Literal["INCOME","EXPENSE","TRANSFER"]`, `amount: MoneyStr` (> 0), `category_id: UUID | None`, `category_source: Literal["MANUAL","AI"] = "MANUAL"`, `occurred_at: UtcDateTime`, `description: str | None`, `reimbursement_group_id`, `subscription_id`, `recurring_income_id`, `cdt_id: UUID | None`, `subscription_period`/`recurring_income_period: str | None` matching `^\d{4}(-(0[1-9]|1[0-2]))?$`.
  - Record rules:
    - "`TRANSFER` ⇔ `counterAccountId`, distinta de `accountId`; una `TRANSFER` no lleva `categoryId`";
    - "`recurringIncomeId` ⇔ `recurringIncomePeriod`, solo con `INCOME`";
    - "`subscriptionId` solo con `EXPENSE`".
  - References: the 7 FKs of data-model.md §2.8. `reference_fields = {"categories": ("kind",)}`.
  - `constraint_codes = {"uq_transactions_subscription_id_subscription_period": DUPLICATE}`.
- [X] T025 Create `SYNC/core/registry.py`:
  - `SYNC_ENTITIES: tuple[SyncEntity, ...]`, instantiated **in this order**: categories, reimbursement_groups, assets, accounts, subscriptions, recurring_incomes, cdts, transactions. The docstring states that the order is the apply and delivery order.
  - `ENTITY_BY_TABLE: dict[str, SyncEntity]`.
  - `TableName = Literal[...]` with the same 8 names. Have `SYNC/schemas.py` import `TableName` from here (adjust T016).
  - An import-time assertion that every `Reference.target_table` is registered **before** its entity, except `self_reference` (depends on T017–T024).

**Checkpoint**: el núcleo y las entidades existen; `uv run pytest tests/unit` y `uv run mypy app` pasan.

---

## Phase 3: User Story 1 - Subir los cambios hechos en el dispositivo (Priority: P1) 🎯 MVP

**Goal**: `POST /api/v1/sync/push` aplica cada registro con LWW, valida esquema, referencias y coherencia, y responde un resultado por registro.

**Independent Test**: enviar una cuenta y una transacción que la referencia en el mismo lote → ambas `APPLIED`; reenviar → `DISCARDED`, sin duplicados (quickstart #2–#10, #12–#14).

### Tests for User Story 1 (escribir primero, deben fallar)

- [X] T026 [P] [US1] Create `TESTS/integration/sync/conftest.py`:
  - factories that return a valid camelCase record dict for each of the 8 tables (`make_account(**overrides)`, `make_transaction(...)`, …), with fresh `uuid4` IDs and `createdAt`/`updatedAt` from `frozen_clock`;
  - helpers `push(client, token, changes) -> Response` and `pull(client, token, cursors=None) -> Response`;
  - a fixture `logged_in(user)` that returns a token. Reuse `TESTS/factories.py` and the existing login fixtures.
- [X] T027 [P] [US1] Unit tests for coherence rules in `TESTS/unit/sync/test_coherence.py`, using fake `ResolvedRefs`/`BatchContext` (one test per rule of FR-009a):
  - `EXPENSE` with an `INCOME` category → `INCOHERENT`, and vice versa;
  - a subscription with an `INCOME` category; a recurring income with an `EXPENSE` category;
  - an account whose parent has a parent; an account that has children receiving a parent;
  - a CDT whose `accountId` is not `INVESTMENT`; a CDT with `sourceAccountId == accountId`;
  - valid cases return `None`.
- [X] T028 [P] [US1] Integration tests for LWW in `TESTS/integration/sync/test_push_lww.py`:
  - new → `APPLIED`; newer `updatedAt` → `APPLIED` and the row changes; equal → `DISCARDED`; older → `DISCARDED`, unchanged;
  - `server_updated_at` changes only on `APPLIED`;
  - `created_at` is not overwritten;
  - soft delete with `deletedAt` → `APPLIED` and the row still exists; restore with `deletedAt: null` + newer `updatedAt` → `APPLIED`;
  - pushing the same batch 5 times leaves the same row count and values (SC-002).
- [X] T029 [P] [US1] Integration tests for batch behavior in `TESTS/integration/sync/test_push_batch.py`:
  - a transaction listed **before** its account in the JSON is applied (FR-010);
  - a sub-account before its parent in the same batch;
  - mixed valid and invalid records → only the invalid one is `REJECTED / VALIDATION_ERROR` with `details`;
  - a missing `accountId` → `INVALID_REFERENCE`; a record depending on a rejected one → `DEPENDENCY_REJECTED`;
  - an account cycle → both `INVALID_REFERENCE`;
  - a duplicate category name+kind → `DUPLICATE`; a second debit with another ID for the same subscription period → `DUPLICATE`;
  - `updatedAt` = now + 25 h → `CLOCK_AHEAD`; now + 23 h → `APPLIED`;
  - `amount` as a JSON number → `VALIDATION_ERROR`;
  - a record without a valid `id` → result with `id: null`;
  - `userId`/`serverUpdatedAt`/`isDirty` in a record are ignored;
  - 501 records → 413 `PUSH_TOO_LARGE` and nothing applied;
  - an unknown table → 422;
  - a result exists for every record, in input order.
- [X] T030 [P] [US1] Integration tests for each entity in `TESTS/integration/sync/test_push_entities.py`: each of the 8 tables accepts a full valid record and stores every field (compare against the DB row). Money values are stored as exact `Decimal`.
- [X] T031 [P] [US1] Integration tests for isolation in `TESTS/integration/sync/test_sync_isolation.py` (PUSH part):
  - user B pushes a record with an `id` that user A owns → `ID_CONFLICT` with the generic message, and A's row is unchanged;
  - user B references A's account → `INVALID_REFERENCE`, with a message identical to the one for a nonexistent ID (SC-003).

### Implementation for User Story 1

- [X] T032 [P] [US1] Implement `check_coherence` in `SYNC/entities/transactions/entity.py`: "si `categoryId` existe, el `kind` de la categoría = `type` del movimiento" (FR-009a).
- [X] T033 [P] [US1] Implement `check_coherence` in `SYNC/entities/subscriptions/entity.py` ("la categoría, si hay, tiene `kind = EXPENSE`") and in `SYNC/entities/recurring_incomes/entity.py` ("la categoría, si hay, tiene `kind = INCOME`").
- [X] T034 [P] [US1] Implement `check_coherence` in `SYNC/entities/accounts/entity.py`:
  - "la cuenta padre no tiene padre (un solo nivel)";
  - "una cuenta que tiene subcuentas (en la base o en el lote) no puede recibir `parentAccountId`". Use `repo.fetch_children_exist` together with the batch's accepted records. Expose the needed data through `ResolvedRefs`, or through an optional `async def prefetch(records, repo)` hook on `SyncEntity`; if you add it, document the hook in `SYNC/core/entity.py`.
- [X] T035 [P] [US1] Implement `check_coherence` in `SYNC/entities/cdts/entity.py`: "`accountId` es una cuenta `INVESTMENT`" and "`sourceAccountId ≠ accountId`".
- [X] T036 [US1] Implement `SyncService.push(request: PushRequest) -> PushResponse` in `SYNC/sync_service.py`, following plan.md → "Flujo del PUSH":
  1. Count the records; if there are more than `MAX_PUSH_RECORDS`, raise `AppError(413, "PUSH_TOO_LARGE", …)`.
  2. `await user_sync_lock(session, user_id, shared=False)`.
  3. For each entity in `SYNC_ENTITIES` with records in the request:
     1. validate each raw dict with `record_schema` (a `ValidationError` → `VALIDATION_ERROR` with `details` = field/message pairs; `id` taken from the raw dict if it parses as a UUID);
     2. reject `updated_at > clock.now() + MAX_FUTURE_SKEW` → `CLOCK_AHEAD`;
     3. if there is a `self_reference`, run `topological_order` and reject cyclic records → `INVALID_REFERENCE`;
     4. run `resolve_references`;
     5. for each record: `check_reference` for every reference, then `check_coherence`, then `async with session.begin_nested()` → `repo.upsert_lww`. On `IntegrityError`, map the constraint name through `constraint_codes` (default `VALIDATION_ERROR`).
     6. If `upsert_lww` returns False → `exists_for_user` ? `DISCARDED` : `ID_CONFLICT`.
  4. Store the result in `BatchContext`.
  5. Return the results **in input order** plus `server_time = clock.now()`.

  The values for the upsert come from `record.model_dump(exclude={"server_updated_at"})`, mapped to model columns. Never include `user_id` from input.
- [X] T037 [US1] Create `SYNC/dependencies.py`: providers `get_sync_repository(user: CurrentUser, session: SessionDep) -> SyncRepository` and `get_sync_service(repository, session, clock) -> SyncService`, following the pattern in `APP/modules/categories/dependencies.py`.
- [X] T038 [US1] Create `SYNC/sync_controller.py`:
  - `router = APIRouter(prefix="/sync", tags=["sync"])` with `POST /push` (`response_model=PushResponse`) that only delegates to the service.
  - Enforce `MAX_PUSH_BODY_BYTES`: reject with 413 `PUSH_TOO_LARGE` when `Content-Length` exceeds it, before parsing, via a small dependency in `SYNC/dependencies.py`.
  - No DB imports (`TESTS/contract/test_architecture.py`).
- [X] T039 [US1] Register the router in `APP/modules/__init__.py`: import `router as sync_router` from `SYNC/sync_controller.py` and append it to `CONTROLLERS`.
- [X] T040 [US1] Run `uv run pytest tests/unit/sync tests/integration/sync -k "push or coherence or entities or isolation"` until T027–T031 pass. Run `uv run pytest tests/contract` too: the existing protected-routes and architecture tests must cover `/api/v1/sync/push`.

**Checkpoint**: el PUSH funciona y se puede probar solo (quickstart #2–#10, #12–#14).

---

## Phase 4: User Story 2 - Recibir los cambios del servidor (Priority: P1)

**Goal**: `POST /api/v1/sync/pull` devuelve los cambios por tabla desde cada cursor, incluidos los borrados, paginado, sin datos ajenos y sin perder cambios concurrentes.

**Independent Test**: un usuario recién creado hace PULL con `{}` y recibe sus 15 categorías; un segundo PULL con el cursor devuelto no trae nada (quickstart #1, #11, #15).

### Tests for User Story 2 (escribir primero, deben fallar)

- [X] T041 [P] [US2] Integration tests in `TESTS/integration/sync/test_pull_first_sync.py`:
  - a new user, `pull({})` → `categories.records` has exactly the 15 seed categories; all 8 tables are present in registry order; `hasMore=false`;
  - a second pull with the returned cursors → all `records` empty, and the cursors are unchanged;
  - an empty table without a cursor → `cursor: null`;
  - records have no `userId` and include `serverUpdatedAt`.
- [X] T042 [P] [US2] Integration tests in `TESTS/integration/sync/test_pull_pagination.py`. Monkeypatch `PULL_PAGE_SIZE` to 3:
  - 7 accounts → pages of 3/3/1 with `hasMore` true/true/false; the union equals all 7 with no repeats;
  - records that share the **same** `server_updated_at` (force it with a direct `UPDATE … SET server_updated_at = <fixed>`) are neither lost nor repeated across pages;
  - the budget is shared across tables in registry order;
  - after a PUSH, a pull with the old cursors returns only the changed records, including soft-deleted ones with `deletedAt`;
  - `{"cursors": {"accounts": "basura"}}` → 422 `INVALID_CURSOR` with `details[0].table == "accounts"`.
- [X] T043 [P] [US2] Add PULL isolation tests to `TESTS/integration/sync/test_sync_isolation.py`: users A and B both with data; each pull returns only its own records (SC-003).
- [X] T044 [P] [US2] Integration test in `TESTS/integration/sync/test_money_roundtrip.py` (SC-007):
  - push three transactions with `"0.10"`, `"0.20"` and `"0.30"`, plus an account with `openingBalance: "9999999999.99"`;
  - pull → the strings are exactly equal; a CDT's `annualRateEa: "10.2500"` and `withholdingRate: "4.00"` round-trip unchanged.
- [X] T045 [US2] Concurrency test in `TESTS/integration/sync/test_pull_push_concurrency.py` (FR-019, SC-004). Use **two real connections** from the `engine` fixture, not the shared `db_session`:
  1. Connection 1 opens a transaction, takes `user_sync_lock(shared=False)`, and upserts an account through `SyncRepository` **without committing**.
  2. Concurrently, a task runs the service `pull` on connection 2.
  3. Assert the pull has not finished after ~200 ms (it is blocked).
  4. Commit connection 1 and await the pull; it must return the account.
  5. Second scenario: the pull runs first and returns cursor C. Then a push commits. A pull with C returns the new record.

  Mark the test `@pytest.mark.timeout` if the plugin is available; otherwise use `asyncio.wait_for`.

### Implementation for User Story 2

- [X] T046 [US2] Implement `SyncService.pull(request: PullRequest) -> PullResponse` in `SYNC/sync_service.py`, following plan.md → "Flujo del PULL":
  1. `await user_sync_lock(session, user_id, shared=True)`.
  2. Decode every provided cursor first; on failure raise `InvalidCursorError` with the table.
  3. Set `budget = PULL_PAGE_SIZE`. For each entity in `SYNC_ENTITIES`:
     - if `budget == 0`: `TablePage(records=[], cursor=<received cursor>, has_more=True)`;
     - else `rows = repo.pull_page(entity, after, budget + 1)`; `has_more = len(rows) > budget`; keep `rows[:budget]`;
     - serialize each row with `entity.record_schema.model_validate(row).model_dump(mode="json", by_alias=True)`;
     - the new cursor is `encode_cursor(last.server_updated_at, last.id)` if there are rows, else the received cursor (or `None`);
     - `budget -= len(rows)`.
  4. The total `has_more` is the `any` of the per-table values.
- [X] T047 [US2] Add `POST /pull` (`response_model=PullResponse`) to `SYNC/sync_controller.py`, delegating to `SyncService.pull`.
- [X] T048 [US2] Run `uv run pytest tests/integration/sync -k "pull or money or isolation or concurrency"` until T041–T045 pass, plus `uv run pytest tests/contract`.

**Checkpoint**: el ciclo PUSH → PULL completo funciona (quickstart #1–#16).

---

## Phase 5: User Story 3 - Uso desde varios dispositivos sin perder datos (Priority: P2)

**Goal**: dos clientes del mismo usuario convergen a la versión con `updatedAt` más reciente, incluido borrado contra edición.

**Independent Test**: quickstart → "Multi-dispositivo (US3)".

- [X] T049 [P] [US3] Integration tests in `TESTS/integration/sync/test_multi_device.py`. Simulate devices A and B as two independent local "stores" (dicts keyed by table+id) that apply pull results, both using the same user token:
  - (1) A edits at 10:00 and B at 10:05; sync in both orders → both stores end with B's version (US3-1);
  - (2) A deletes at 10:10 after B's 10:05 edit → both end deleted; reversed (B edits after A deletes) → both end restored with B's data (US3-2);
  - (3) A's stale push returns `DISCARDED`, and A's next pull brings the winning version (FR-008).
- [X] T050 [US3] If T049 shows a gap, fix it in `SYNC/sync_service.py` or `SYNC/core/sync_repository.py`. Otherwise mark it done. Run `uv run pytest tests/integration/sync/test_multi_device.py`.

**Checkpoint**: las tres historias pasan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T051 [P] Update `docs/db-finanzas.md` §9 (data-model.md → "Cambio documental"):
  - rename `sync_metadata.last_pulled_server_at` to `pull_cursor` (TEXT, opaque server cursor; NULL = never synced);
  - add a short "Sincronización" note: one PUSH/PULL pair for all tables, delivery in dependency order, deletions via `deleted_at`, and a link to `specs/004-data-sync/contracts/http-api.md`.
- [X] T052 [P] Update `README.md` (API section) with the two sync routes and a link to the contract, following the existing README style and language.
- [X] T053 [P] Add the module docstring in `SYNC/__init__.py` with a short guide titled "Cómo agregar una tabla al sync":
  1. create `entities/<tabla>/schemas.py` + `entity.py`;
  2. add it to `SYNC_ENTITIES` in dependency order;
  3. add a factory in `TESTS/integration/sync/conftest.py` and a case in `test_push_entities.py`.
- [X] T054 Run the full quality gate from `apps/api`: `uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest`. Fix every failure.
- [ ] T055 Run quickstart.md → "Escenarios manuales" #1–#16 against `docker compose up --build` via Swagger (`/docs` shows `sync` with both routes) and note any deviation.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories.
- **US1 (PUSH)** depends only on Phase 2.
- **US2 (PULL)** depends on Phase 2. Its tests use PUSH (T036–T039) to create data, so in practice it goes **after US1**. Only T041 (first sync with seed categories) can run without US1.
- **US3** depends on US1 + US2.
- **Polish** goes last.

### Within Phase 2

- T002 → T003. T007 → T008. T010 → T011.
- T006 + T012 → T013 → T014 → T015.
- T012 + T002 → T017–T024 (in parallel) → T025 → adjust T016.
- T004 is independent.

### Within US1

- Tests T026–T031 first; T026 before the other integration tests.
- T032–T035 in parallel → T036 → T037 → T038 → T039 → T040.

### Within US2

- Tests T041–T045 → T046 → T047 → T048.

## Parallel Example

```text
# Phase 2, once T012 exists:
T017 categories · T018 reimbursement_groups · T019 assets · T020 accounts
T021 subscriptions · T022 recurring_incomes · T023 cdts · T024 transactions

# US1 tests:
T027 coherence (unit) · T028 lww · T029 batch · T030 entities · T031 isolation

# US1 coherence rules:
T032 transactions · T033 subscriptions+recurring_incomes · T034 accounts · T035 cdts
```

## Implementation Strategy

1. **MVP = Phase 1 + Phase 2 + US1 (PUSH)**: the server can already receive and store everything the app creates offline, which is testable in Swagger.
2. **+ US2 (PULL)**: completes the sync cycle (multi-device, reinstall, seed categories in the app).
3. **+ US3**: end-to-end validation of convergence across devices.
4. **Polish**: docs and full quality gate.

Stop at each checkpoint to validate before continuing. Commits stay small and per task group, and only when the user asks for them.
