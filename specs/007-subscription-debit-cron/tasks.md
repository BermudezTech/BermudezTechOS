---
description: "Tareas para el débito automático diario de suscripciones y la zona horaria única del MVP"
---

# Tasks: Débito automático diario de suscripciones y zona horaria única del MVP

**Input**: Design documents from `/specs/007-subscription-debit-cron/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: incluidos.
- La spec los exige en FR-022 (periodos, fechas de cobro, idempotencia) y FR-030 (zonas horarias).
- La constitución pide pruebas para la lógica de montos y de sincronización.
- Las pruebas de cada historia se escriben primero y deben fallar antes de implementar.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: historia de usuario de [spec.md](./spec.md):
  - US1: cobro del día
  - US2: sin duplicados
  - US3: solo suscripciones vigentes
  - US4: operar el servicio
  - US5: zona horaria `America/Bogota`

## Path Conventions

- **Abreviaturas**: `API/` = `apps/api/`, `MOD/` = `apps/api/app/modules/subscription_debits/`, `MOB/` = `apps/mobile/`, `SRC/` = `apps/mobile/src/`.
- **Comandos del backend**: desde `apps/api`, con `uv run pytest`, `uv run ruff check . && uv run ruff format --check .` y `uv run mypy app`.
- **Comandos de la app**: desde `apps/mobile`, con `npm test` y `npm run typecheck`.
- **Pruebas con commits reales o concurrencia**: usan los fixtures `fresh_database` + `migrate` de `API/tests/conftest.py`, con el patrón `sessions` de `API/tests/integration/sync/test_pull_push_concurrency.py`. El `db_session` compartido hace rollback y no sirve para estos casos.
- **Pruebas puras**: usan `FakeClock` de `API/tests/conftest.py` para fijar el instante.
- **Convenciones del código existente**, que se mantienen:
  - comentarios y logs en español, identificadores en inglés;
  - montos siempre `Decimal` (`app.db.base.Money`), nunca `float`;
  - mypy estricto y ruff con las reglas de `API/pyproject.toml`;
  - en la app, todas las fechas pasan por `SRC/lib/dates.ts`, y las pruebas `*.test.ts` van junto al código.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: crear el esqueleto del módulo y de las carpetas de prueba. No se agregan dependencias (research R2, R8).

- [X] T001 Crear el paquete `MOD/` con `__init__.py` (docstring: "Débito automático diario de suscripciones (spec 007)") y los archivos vacíos de las carpetas de prueba `API/tests/unit/subscription_debits/__init__.py` y `API/tests/integration/subscription_debits/__init__.py`.
- [X] T002 [P] Agregar en `API/tests/integration/subscription_debits/conftest.py`:
  - el fixture `sessions` (base aparte migrada, `async_sessionmaker` con `NullPool`), copiado del patrón de `test_pull_push_concurrency.py`;
  - helpers `make_user`, `make_account(user_id, *, deleted=False, archived=False)`, `make_category(user_id, *, kind="EXPENSE", deleted=False)` y `make_subscription(user_id, account_id, *, cycle="MONTHLY", day, month=None, start_date, status="ACTIVE", amount=Decimal("44900.00"), category_id=None, deleted=False)`, que insertan con commit real y `created_at`/`updated_at` del `FakeClock`;
  - un helper `debits(sessions, subscription_id)` que devuelve las filas de `transactions` con ese `subscription_id`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: la zona horaria del servidor y la configuración del worker, que usan todas las historias del servicio.

**⚠️ CRITICAL**: ninguna historia del servicio (US1–US4) empieza antes de terminar esta fase. US5 (app) puede empezar en paralelo desde aquí.

- [X] T003 [P] Prueba en `API/tests/unit/test_timezone.py`, parametrizada con `monkeypatch.setenv("TZ", z)` + `time.tzset()` para `z` en `UTC`, `Asia/Tokyo` y `Pacific/Honolulu` (restaurando `TZ` al terminar). Casos:
  - `today_local(FakeClock en 2026-10-25T04:30:00Z)` devuelve `date(2026, 10, 24)`;
  - `today_local(2026-10-25T05:00:00Z)` devuelve `date(2026, 10, 25)`;
  - `local_midnight_utc(date(2026, 10, 15))` devuelve `2026-10-15T05:00:00+00:00`.
- [X] T004 Implementar `API/app/core/timezone.py` (research R8):
  - `APP_TIME_ZONE = ZoneInfo("America/Bogota")` con un comentario que remita a la spec 007 FR-023;
  - `today_local(clock: Clock) -> date`, que hace `clock.now().astimezone(APP_TIME_ZONE).date()`;
  - `local_midnight_utc(day: date) -> datetime`, que hace `datetime.combine(day, time(0), APP_TIME_ZONE).astimezone(UTC)`.

  Prohibido usar `date.today()` o `datetime.now()` sin zona.
- [X] T005 [P] Prueba en `API/tests/unit/subscription_debits/test_config.py`:
  - falla sin `BILLING_ACTIVATION_DATE`, y el mensaje nombra la variable sin mostrar su valor;
  - falla con una `DATABASE_URL` que no empieza por `postgresql+asyncpg://`;
  - con `BILLING_RUN_TIME` vacío toma el valor `time(0, 5)`, y `"25:00"` es inválido;
  - **no** exige `JWT_SECRET` ni `PASSWORD_RESET_PEPPER` (hacer `monkeypatch.delenv` de ambas).
- [X] T006 Implementar `MOD/config.py` (research R12, contracts/billing-service.md § Variables de entorno):
  - `BillingSettings(BaseSettings)` con `database_url: str`, `billing_activation_date: date` (obligatoria), `billing_run_time: time = time(0, 5)` (formato `HH:MM`) y `log_level: str = "INFO"`;
  - el mismo `model_config` (`env_ignore_empty`, `extra="ignore"`, `hide_input_in_errors`) y el mismo validador de prefijo que `API/app/core/config.py`;
  - `load_billing_settings()`, que lanza `ConfigError` usando `_describe` (importarlo; si es privado, renombrarlo a `describe_validation_error` en `API/app/core/config.py` y actualizar su uso).

**Checkpoint**: zona y configuración listas; ya pueden empezar las historias.

---

## Phase 3: User Story 1 - El cobro de una suscripción se registra solo el día que corresponde (Priority: P1) 🎯 MVP

**Goal**: `run_for_date(D)` registra un egreso por cada suscripción `ACTIVE` cuya fecha de cobro del periodo actual sea `<= D`, con el ID determinista, y la app lo recibe en el PULL.

**Independent Test**: crear una suscripción activa con cobro hoy y ejecutar `python -m app.modules.subscription_debits run`. Debe existir un único egreso con monto, cuenta, categoría, descripción, `occurred_at` y periodo correctos, y el siguiente PULL de ese usuario debe entregarlo.

### Tests for User Story 1

- [X] T007 [P] [US1] Prueba en `API/tests/unit/subscription_debits/test_periods.py` para `current_period(cycle, D)` y `billing_date(cycle, billing_day, billing_month, D)`:
  - mensual día 15 con `D=2026-10-24` → (`"2026-10"`, `2026-10-15`);
  - mensual día 31 en `2026-11` → `2026-11-30`, y en febrero de 2027 → `2027-02-28`;
  - anual día 10, mes 3 con `D=2026-10-24` → (`"2026"`, `2026-03-10`);
  - anual 29/02 en 2027 → `2027-02-28`, y en 2028 → `2028-02-29`;
  - el periodo cumple el formato `^\d{4}(-(0[1-9]|1[0-2]))?$` (CHECK `subscription_period_format`).
- [X] T008 [P] [US1] Prueba en `API/tests/unit/subscription_debits/test_debit_ids.py`:
  - `NAMESPACE == UUID("9d1e0cb1-0ae7-5d67-856e-c19860851ef1")` y es igual a `uuid5(NAMESPACE_URL, "https://bermudeztech.os/subscription-debit")`;
  - `debit_id(UUID("7f1c2a9e-0000-4000-8000-000000000001"), "2026-10") == UUID("e4bc34e4-a6ae-5090-9861-6968494a9467")` (vector fijo, research R4);
  - el mismo par da siempre el mismo ID y un periodo distinto da otro.
- [X] T009 [P] [US1] Prueba de integración en `API/tests/integration/subscription_debits/test_run.py` (fixture `sessions`, `FakeClock` en `2026-10-15T15:00:00Z`, activación `2026-10-01`):
  - una mensual día 15 por `Decimal("44900.00")` con categoría `EXPENSE` válida crea exactamente una fila con `type='EXPENSE'`, el mismo `account_id`, `category_id`, `category_source='MANUAL'`, `description` igual al nombre, `amount == Decimal("44900.00")` (sin `float`), `occurred_at == 2026-10-15T05:00:00Z`, `subscription_period == "2026-10"`, `id == debit_id(...)`, `user_id` igual al de la suscripción, `deleted_at IS NULL` y `created_at == updated_at ==` reloj;
  - una anual día 15, mes 10 crea periodo `"2026"`, y otra anual con mes 11 no crea nada;
  - con dos usuarios, cada egreso queda con su `user_id` y su propia cuenta (US1 escenario 5);
  - el resumen devuelto tiene `created == 2`.
- [X] T010 [P] [US1] Prueba de integración en `API/tests/integration/subscription_debits/test_sync_visibility.py`:
  - tras `run_for_date`, un `SyncService.pull` del usuario, con el cursor que tenía antes de ejecutar, entrega el egreso en `transactions` con `amount` como string `"44900.00"` (US1 escenario 4, SC-004);
  - el PULL de otro usuario no lo entrega.

### Implementation for User Story 1

- [X] T011 [P] [US1] Implementar `MOD/periods.py` (puro, sin E/S; research R3, data-model.md § Periodo y fecha de cobro): `current_period(cycle: Literal["MONTHLY","YEARLY"], d: date) -> str` y `billing_date(cycle, billing_day: int, billing_month: int | None, d: date) -> date`, con el ajuste "min(billing_day, días del mes)" (`calendar.monthrange`). Un `YEARLY` sin `billing_month` lanza `ValueError`.
- [X] T012 [P] [US1] Implementar `MOD/debit_ids.py`:
  - `NAMESPACE = UUID("9d1e0cb1-0ae7-5d67-856e-c19860851ef1")`, con un comentario: "uuid5(NAMESPACE_URL, 'https://bermudeztech.os/subscription-debit'). No cambiar: la app generará el mismo ID";
  - `debit_id(subscription_id: UUID, period: str) -> UUID`, que hace `uuid5(NAMESPACE, f"{subscription_id}:{period}")`.
- [X] T013 [US1] Implementar `MOD/repository.py` con SQLAlchemy Core sobre los modelos existentes (data-model.md § Entradas/Salida):
  - `candidate_user_ids(session) -> list[UUID]`: usuarios con suscripciones `status = 'ACTIVE'` y `deleted_at IS NULL`, con `JOIN users`;
  - `candidate_subscriptions(session, user_id) -> list[SubscriptionRow]` (dataclass): `id`, `account_id`, `name`, `amount: Decimal`, `billing_cycle`, `billing_day`, `billing_month`, `start_date`, más `account_ok: bool` (= existe y `accounts.deleted_at IS NULL`; `is_archived` **no** cuenta) y `valid_category_id: UUID | None` (= `category_id` si `kind = 'EXPENSE' AND deleted_at IS NULL`, si no `NULL`), con `LEFT JOIN` por `(user_id, id)`;
  - `insert_debit(session, row, period, billing_date, now) -> bool`: `INSERT INTO transactions … ON CONFLICT DO NOTHING RETURNING id` sin objetivo, con los valores de la tabla "Salida" de data-model.md (`counter_account_id`, `reimbursement_group_id`, `recurring_income_*` y `cdt_id` en `NULL`; `occurred_at = local_midnight_utc(billing_date)`; sin fijar `server_updated_at`). Devuelve `True` si insertó.
- [X] T014 [US1] Implementar `MOD/service.py` (research R5):
  - `RunSummary` (dataclass) con `run_date`, `trigger`, `users`, `subscriptions`, `created`, `existing`, `not_due`, `skipped_account`, `failed`, `failures: list[tuple[UUID, str]]` y `duration_ms`;
  - `SubscriptionDebitService(sessions: async_sessionmaker, clock: Clock, activation_date: date)` con `async run_for_date(d: date, trigger: str) -> RunSummary`. Por cada usuario de `candidate_user_ids` abre una sesión y una transacción, llama a `user_sync_lock(session, user_id, shared=False)` (`API/app/modules/sync/core/lock.py`), recorre `candidate_subscriptions`, calcula periodo y fecha de cobro, inserta si `billing_date <= d` y hace commit.
- [X] T015 [US1] Implementar `MOD/__main__.py` con `argparse` y el subcomando `run [--date YYYY-MM-DD]` (por defecto `today_local(SystemClock())`):
  - carga `load_billing_settings()` y `configure_logging(settings.log_level)`;
  - crea el engine (`NullPool`), ejecuta `run_for_date(d, "manual")`, registra el resumen y sale con 0.

  Los subcomandos `serve` y `health` y las validaciones de `--date` se agregan en US4.
- [X] T016 [US1] Documentar en `docs/db-finanzas.md` §5, bajo "Generación idempotente":
  - el namespace literal `9d1e0cb1-0ae7-5d67-856e-c19860851ef1` y su derivación;
  - el formato del nombre `"{subscription_id}:{period}"` (UUID en minúsculas con guiones) y el vector de prueba de T008;
  - la regla de que `occurred_at` del débito es la fecha de cobro a las 00:00 `America/Bogota`.

  Agregar en `docs/modulo-finanzas.md` §4 que el servidor genera los débitos con el servicio `billing` (spec 007).

**Checkpoint**: US1 funciona con `run`. Es el MVP del servicio.

---

## Phase 4: User Story 2 - Nunca se cobra dos veces el mismo periodo (Priority: P1)

**Goal**: que repetir, reintentar o ejecutar en paralelo nunca duplique un cobro, que nunca se recree ni modifique un débito borrado o editado, y que el fallo de una suscripción no afecte a las demás.

**Independent Test**: ejecutar `run` dos veces seguidas y dos en paralelo. Debe quedar una sola fila por suscripción y periodo, y la segunda ejecución debe reportar `created=0` y `existing=1`.

### Tests for User Story 2

- [X] T017 [P] [US2] Prueba de integración en `API/tests/integration/subscription_debits/test_idempotency.py`:
  - dos `run_for_date` seguidos → una fila; la segunda da `created == 0` y `existing == 1`;
  - 10 ejecuciones con `asyncio.gather` sobre la misma fecha → una fila por suscripción (SC-002);
  - marcar la fila con `deleted_at` y volver a ejecutar → sigue borrada, con `updated_at` intacto (FR-014);
  - editar `amount` a `Decimal("50000.00")` y volver a ejecutar → el monto se conserva;
  - existe un débito con **otro** `id` para el mismo `(subscription_id, subscription_period)` → no se inserta nada (`existing`), gracias a `uq_transactions_subscription_id_subscription_period`.
- [X] T018 [P] [US2] Prueba de integración en `API/tests/integration/subscription_debits/test_failure_isolation.py`:
  - con dos suscripciones del mismo usuario, donde `insert_debit` lanza una excepción para la primera (con `monkeypatch`), la segunda se crea, el resumen da `failed == 1` con su `subscription_id` y la ejecución no lanza;
  - al reintentar sin el fallo se crea la primera y la segunda cuenta como `existing` (US2 escenario 4).
- [X] T019 [P] [US2] Prueba de concurrencia con el PULL en `API/tests/integration/subscription_debits/test_sync_visibility.py`:
  - mientras una sesión mantiene `user_sync_lock(shared=True)` abierta (simulando un PULL), `run_for_date` espera;
  - al liberar, un PULL con el cursor que entregó el PULL simulado recibe el egreso (FR-016). Seguir el patrón de `API/tests/integration/sync/test_pull_push_concurrency.py`.

### Implementation for User Story 2

- [X] T020 [US2] En `MOD/service.py`, envolver cada suscripción en `async with session.begin_nested():`.
  - Una excepción hace rollback solo del savepoint, se suma a `failed` y a `failures` con el nombre de la clase de error (sin el mensaje, que podría incluir datos) y se registra `WARNING Cobro fallido: subscription=<uuid> period=<p> motivo=<Clase>` (contracts/billing-service.md § Log).
  - `insert_debit` con `False` suma `existing`.
  - Un error fuera de los savepoints (conexión) hace rollback del usuario, se registra y continúa con el siguiente usuario.

**Checkpoint**: US1 + US2 son seguras ante repeticiones, concurrencia y fallos parciales.

---

## Phase 5: User Story 5 - Las fechas significan lo mismo en todas partes: `America/Bogota` (Priority: P1)

**Goal**: la app calcula y muestra todo en `America/Bogota`, sin importar la zona del dispositivo o del navegador (FR-023 a FR-030).

**Independent Test**: `npm run test:tz` pasa con `TZ=Asia/Tokyo` y con `TZ=Pacific/Honolulu` sin cambiar ningún valor esperado. En web, con la zona emulada en Tokio, la fecha propuesta, el grupo "Hoy" y el mes coinciden con Bogotá (quickstart.md §8).

> Independiente de US1–US4: toca solo `apps/mobile` y los docs. Puede ir en paralelo desde la fase 2.

### Tests for User Story 5

- [X] T021 [P] [US5] Agregar en `MOB/package.json` el script `"test:tz": "TZ=Asia/Tokyo jest && TZ=Pacific/Honolulu jest"` (research R11).
- [X] T022 [P] [US5] Ampliar `SRC/lib/dates.test.ts` con los casos de contracts/app-dates.md. Fijar el instante con `jest.useFakeTimers().setSystemTime(...)` y restaurar con `jest.useRealTimers()`:
  - `todayLocal()` y `todayParts()` en `2026-10-25T04:30:00Z` → `"2026-10-24"` y `{ year: 2026, month: 10, day: 24 }`;
  - `localDayKey("2026-11-01T01:00:00Z")` → `"2026-10-31"`;
  - `localTimeParts("2026-10-25T04:30:00Z")` → `{ hours: 23, minutes: 30 }`;
  - `localDateTimeToUtc("2026-03-10", 12, 0)` → `"2026-03-10T17:00:00.000Z"`;
  - `periodRangeUtc` de octubre de 2026 → `2026-10-01T05:00:00.000Z` / `2026-11-01T05:00:00.000Z`, y de 2026 → `2026-01-01T05:00:00.000Z` / `2027-01-01T05:00:00.000Z`;
  - `formatDateLocal("2026-10-25T04:30:00Z", "d 'de' MMMM HH:mm")` → `"24 de octubre 23:30"`;
  - `formatRelativeDay` → `"Hoy"`/`"Ayer"` según el día de Bogotá a las 23:30 de Bogotá;
  - cambio de año: `localDayKey("2027-01-01T03:00:00Z")` → `"2026-12-31"`.

  Quitar del archivo cualquier uso de `deviceTimeZone`; la constante `ZONE` local pasa a ser `APP_TIME_ZONE`.
- [X] T023 [P] [US5] Reescribir `SRC/lib/greeting.test.ts`: los casos dejan de usar `new Date(2026, 9, 17, h, m)` (hora del runner) y pasan a instantes UTC equivalentes en Bogotá, `new Date(Date.UTC(2026, 9, 17, h + 5, m))`, manteniendo los mismos límites (4:59, 5:00, 11:59, 12:00, 18:59, 19:00). Agregar un caso: `2026-10-24T23:30:00Z` → `"Buenas tardes"`.
- [X] T024 [P] [US5] Prueba de guardia en `SRC/lib/timezoneGuard.test.ts`: lee con `fs` los archivos de `SRC/` (sin `*.test.*` ni `SRC/lib/dates.ts`) y falla si encuentra `resolvedOptions().timeZone`, `.getHours()` o `new Date().getDate()` (research R10). Excepción permitida, con comentario: la conversión `getFullYear/getMonth/getDate` del `Date` que devuelve el selector en `SRC/components/ui/form/DateInput.tsx`.

### Implementation for User Story 5

- [X] T025 [US5] En `SRC/lib/dates.ts` (research R9, contracts/app-dates.md):
  - agregar `export const APP_TIME_ZONE = 'America/Bogota';` con un comentario que remita a la spec 007 FR-023;
  - cambiar el valor por defecto `zone = deviceTimeZone()` por `zone = APP_TIME_ZONE` en `todayLocal`, `localDateTimeToUtc`, `localDayKey`, `localTimeParts`, `formatDateLocal` y `periodRangeUtc`;
  - eliminar `deviceTimeZone()`;
  - agregar `export function todayParts(zone = APP_TIME_ZONE): { year: number; month: number; day: number }`, que devuelve `parseIsoDate(todayLocal(zone))`.
- [X] T026 [P] [US5] En `SRC/lib/greeting.ts`, calcular la hora con `localTimeParts(date.toISOString()).hours` (Bogotá) y actualizar el comentario a "Saludo según la hora de Bogotá (FR-007; spec 007 FR-027)".
- [X] T027 [P] [US5] En `SRC/modules/finance/components/subscriptions/SubscriptionForm.tsx:56`, cambiar `new Date().getDate()` por `todayParts().day`, importado de `@/lib/dates`.
- [X] T028 [P] [US5] En `SRC/modules/finance/components/recurringIncome/RecurringIncomeForm.tsx:61`, cambiar `new Date().getDate()` por `todayParts().day`.
- [X] T029 [P] [US5] En `SRC/components/ui/form/DateInput.tsx:21`, cuando no hay valor, abrir el selector en `todayParts()` (`new Date(t.year, t.month - 1, t.day)`) en lugar de `new Date()`. Mantener la conversión de vuelta `isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate())`, con un comentario: el selector trabaja en el calendario del dispositivo y la ida y vuelta conserva el día elegido (FR-028).
- [X] T030 [US5] Ejecutar `npm test`, `npm run test:tz` y `npm run typecheck` en `MOB/`. Corregir cualquier prueba existente que dependa de la zona del runner, por ejemplo en `SRC/modules/finance/domain/*.test.ts` o `SRC/sync/status.test.ts`, expresando sus instantes en UTC equivalentes a Bogotá y **sin** cambiar la lógica para que pasen.

**Checkpoint**: la app es independiente de la zona del dispositivo (SC-007).

---

## Phase 6: User Story 3 - Solo se cobran las suscripciones vigentes (Priority: P2)

**Goal**: no cobrar suscripciones pausadas, canceladas, borradas, con `start_date` posterior a la fecha de cobro o con fecha de cobro anterior a la activación. Omitir si la cuenta no está disponible y registrar sin categoría si la categoría no es válida.

**Independent Test**: preparar suscripciones `PAUSED`, `CANCELLED`, borradas, con `start_date` futura y con cuenta borrada, todas con cobro hoy, y ejecutar `run`. Ninguna debe generar egreso, la de cuenta borrada debe aparecer como omitida en el log y la de cuenta archivada sí debe cobrarse.

### Tests for User Story 3

- [X] T031 [P] [US3] Ampliar `API/tests/unit/subscription_debits/test_periods.py` con `is_due(billing_date, start_date, activation_date, d) -> bool`:
  - `billing_date > d` → `False`;
  - `billing_date < start_date` → `False` (creada el 20 con día 15 → `False`; FR-006);
  - `billing_date < activation_date` → `False` (activación `2026-10-24`: día 15 → `False`, día 28 con `d=2026-10-28` → `True`; FR-007a);
  - vencido en el periodo actual (`billing_date=2026-10-15`, `d=2026-10-17`) → `True` (FR-007).
- [X] T032 [P] [US3] Ampliar `API/tests/integration/subscription_debits/test_run.py`:
  - `PAUSED`, `CANCELLED`, `deleted_at` con valor y `start_date` futura → 0 filas;
  - cuenta con `deleted_at` → 0 filas y `skipped_account == 1`;
  - cuenta con `is_archived = true` → 1 fila;
  - categoría borrada, categoría `kind='INCOME'` o sin categoría → 1 fila con `category_id IS NULL`;
  - vencida el 15 y ejecutada el 17 → `occurred_at == 2026-10-15T05:00:00Z`;
  - día de cobro anterior a la activación → `not_due`;
  - suscripción de un usuario borrado entre la consulta de usuarios y la de suscripciones → no es un error (sin filas y `failed == 0`).

### Implementation for User Story 3

- [X] T033 [US3] Agregar `is_due(billing_date, start_date, activation_date, d)` en `MOD/periods.py`: `billing_date <= d and billing_date >= start_date and billing_date >= activation_date` (data-model.md § Elegibilidad).
- [X] T034 [US3] En `MOD/service.py`, aplicar la elegibilidad antes de insertar:
  - `not is_due(...)` suma `not_due`;
  - `not row.account_ok` suma `skipped_account` y registra `INFO Cobro omitido: subscription=<uuid> period=<p> motivo=cuenta no disponible`;
  - si no, inserta con `category_id = row.valid_category_id`.

  Verificar en `MOD/repository.py` que `candidate_subscriptions` filtra `status = 'ACTIVE' AND deleted_at IS NULL` y que `account_ok` ignora `is_archived`.

**Checkpoint**: US1–US3 completas: el cobro es correcto en todos los estados.

---

## Phase 7: User Story 4 - Operar y vigilar el servicio (Priority: P3)

**Goal**: que el servicio se despliegue en el compose, se ejecute solo cada día a las 00:05 de Bogotá, exponga el latido, verifique el esquema, reintente y deje un resumen en el log.

**Independent Test**: `docker compose up --build -d` deja `billing` en estado healthy, el log muestra el arranque y el resumen `trigger=startup`, y `run --date <mañana>` sale con 2 (quickstart.md §2 y §7).

### Tests for User Story 4

- [X] T035 [P] [US4] Prueba en `API/tests/unit/subscription_debits/test_scheduler.py`, parametrizada con `TZ` en `UTC`, `Asia/Tokyo` y `Pacific/Honolulu`:
  - `next_run_at(now, run_time=time(0, 5))` con `now = 2026-10-24T05:04:00Z` (00:04 en Bogotá) → `2026-10-24T05:05:00Z`; con `now = 2026-10-24T05:06:00Z` → `2026-10-25T05:05:00Z`;
  - `is_heartbeat_fresh(path, now, max_age=180 s)` es `True` con `mtime` de hace 60 s y `False` con uno de hace 200 s o si el archivo no existe;
  - en el bucle con un reloj falso y `run_for_date` simulado: una ejecución `startup` al iniciar y una `scheduled` al cruzar la hora, sin repetirla en el mismo día.
- [X] T036 [P] [US4] Prueba de integración en `API/tests/integration/subscription_debits/test_cli.py`:
  - `run --date` con una fecha posterior a `today_local` → código 2 y sin filas;
  - `run --date 2026-13-01` → código 2;
  - sin `BILLING_ACTIVATION_DATE` → código 1 y log `Configuración inválida: BILLING_ACTIVATION_DATE es obligatoria.`;
  - con `alembic_version` cambiado a `"0000"` → código 1, log `Esquema inesperado` y sin filas (FR-019);
  - el resumen tiene las claves `fecha trigger usuarios suscripciones creados existentes no_vencidos omitidos fallidos duracion_ms` y no contiene el monto ni el nombre de la suscripción (FR-020, `caplog`).
- [X] T037 [P] [US4] Prueba de rendimiento en `API/tests/integration/subscription_debits/test_performance.py`: con 10.000 suscripciones activas repartidas en 50 usuarios (inserción masiva con `insert().values([...])`), `run_for_date` termina en menos de 60 s (SC-005). Marcarla con `@pytest.mark.slow` y registrar el marcador en `API/pyproject.toml` (`[tool.pytest.ini_options] markers`).

### Implementation for User Story 4

- [X] T038 [P] [US4] Implementar `MOD/schema_check.py`: `async expected_head() -> str`, que lee el head con `ScriptDirectory.from_config(Config(alembic.ini))` (misma ruta que `API/app/bootstrap.py`), y `async check_schema(session) -> str | None`, que compara con `SELECT version_num FROM alembic_version` y devuelve un mensaje de error o `None`.
- [X] T039 [US4] Implementar `MOD/scheduler.py` (research R2, R7):
  - `HEARTBEAT_PATH = Path("/tmp/billing-heartbeat")` (configurable en pruebas);
  - `next_run_at(now, run_time) -> datetime`, en `APP_TIME_ZONE` y devuelto en UTC;
  - `is_heartbeat_fresh(path, now, max_age)`;
  - `wait_for_database(engine)`: reintenta `SELECT 1` con espera de 5, 10, 20… s, con un tope de 60 s por espera y 10 minutos en total, y lanza un error al agotarse;
  - `serve(service, clock, settings)`:
    1. Valida `ZoneInfo`.
    2. Registra `INFO Servicio de cobros iniciado: activación=… hora=HH:MM America/Bogota próxima=…`.
    3. Hace una ejecución `startup`.
    4. En el bucle, cada 60 s, hace `touch` del latido y, si `clock.now() >= next`, ejecuta `scheduled` y recalcula `next`.
  - Antes de cada ejecución llama a `check_schema`; si falla, registra `ERROR Esquema inesperado: base=<rev> esperado=<rev>; no se escribe nada` y no ejecuta.
  - Si la ejecución falla por la base, reintenta a 1, 5 y 15 min, y después espera a la siguiente hora programada.
- [X] T040 [US4] Completar `MOD/__main__.py` (contracts/billing-service.md § Comandos y Códigos de salida):
  - subcomando `serve`, que llama a `scheduler.serve`;
  - subcomando `health`, que sale con 0 si `is_heartbeat_fresh` y con 1 si no;
  - en `run`: `--date` futura o mal formada → `parser.exit(2, …)`, verificar el esquema antes de ejecutar (código 1 si falla) y `wait_for_database`;
  - `ConfigError` → registrar y salir con 1.
- [X] T041 [US4] En `MOD/service.py`, registrar al inicio `INFO Ejecución de cobros: fecha=<D> trigger=<t>` y al final siempre `INFO Resumen de cobros: fecha=… trigger=… usuarios=… suscripciones=… creados=… existentes=… no_vencidos=… omitidos=… fallidos=… duracion_ms=…`, también cuando todo es 0. Usar el logger `logging.getLogger("app.subscription_debits")`.
- [X] T042 [US4] Agregar el servicio `billing` a `docker-compose.yml` según contracts/billing-service.md § Compose:
  - `build.context: ./apps/api`;
  - `entrypoint: ["python", "-m", "app.modules.subscription_debits", "serve"]`;
  - `restart: unless-stopped`;
  - `depends_on: api: condition: service_healthy`;
  - variables `DATABASE_URL` y `BILLING_ACTIVATION_DATE` con `:?`, y `BILLING_RUN_TIME` y `LOG_LEVEL` con valor por defecto;
  - healthcheck `["CMD", "python", "-m", "app.modules.subscription_debits", "health"]` con `interval 60s`, `timeout 10s`, `retries 3` y `start_period 120s`;
  - sin puertos ni volúmenes.

  Actualizar el comentario de cabecera del compose ("API + PostgreSQL + servicio de cobros").
- [X] T043 [P] [US4] En `API/.env.example`, agregar `BILLING_ACTIVATION_DATE=` (con un comentario: "Obligatoria. Día del primer despliegue del servicio de cobros; nunca se cobra una fecha anterior (spec 007 FR-007a)") y `BILLING_RUN_TIME=00:05` (con un comentario: "Hora diaria en hora de Bogotá").
- [X] T044 [P] [US4] En `README.md`, agregar el servicio `billing` en la sección de Docker, los comandos `run [--date]` y `health` en la tabla de comandos y una línea de que la zona del MVP es `America/Bogota`.

**Checkpoint**: todas las historias completas y desplegables en Coolify.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T045 Ejecutar en `API/` `uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest`. Corregir sin desactivar reglas.
- [X] T046 [P] Agregar una nota bajo FR-035 en `specs/001-finance-ui-mockup/spec.md`: "> Reemplazado por la spec 007 FR-027: las fechas se muestran en `America/Bogota`, no en la zona del dispositivo."
- [X] T047 [P] Actualizar en `CLAUDE.md`, sección Finanzas, la línea "Fechas en UTC en almacenamiento; convertir a zona local solo para mostrar" por "Fechas en UTC en almacenamiento; calcular y mostrar en `America/Bogota` (zona única del MVP, spec 007)".
- [X] T048 Proponer al usuario ejecutar `/speckit-constitution` para la enmienda **PATCH** del Principio IV ("en el MVP, la zona local es `America/Bogota` para calcular y mostrar"), según la nota del Constitution Check de plan.md. **No** editar `.specify/memory/constitution.md` directamente.
- [ ] T049 Recorrer [quickstart.md](./quickstart.md) §1–§8 contra la composición local y anotar en la PR el resultado de cada paso (incluida la emulación de zona en web).
  - **Avance (2026-10-24)**: §1–§7 y §8.3 verificados en un compose aislado (`-p bt007check`). Quedan pendientes, por ser manuales, §8.1 (web con la zona emulada) y §8.2 (Android con otra zona).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)** → **Foundational (Fase 2)** → historias.
- **US1 (Fase 3)** depende de la Fase 2. Es el MVP del servicio.
- **US2 (Fase 4)** depende de US1, porque modifica `service.py` y amplía `test_sync_visibility.py`.
- **US5 (Fase 5)** solo depende de la Fase 1 (y de nada en la práctica, porque es solo `apps/mobile`). Puede ir en paralelo con US1–US4.
- **US3 (Fase 6)** depende de US1 (`periods.py`, `service.py`, `repository.py`). Puede ir en paralelo con US2 si se coordinan los cambios en `service.py`.
- **US4 (Fase 7)** depende de US1 (`__main__.py`, `service.py`). Conviene hacerla después de US2 y US3 para que el log refleje todos los conteos.
- **Polish (Fase 8)**: al final.

### User Story Dependencies

```text
Setup → Foundational ─┬─ US1 ─┬─ US2 ─┐
                      │       ├─ US3 ─┼─ US4 ─ Polish
                      │       └───────┘
                      └─ US5 (apps/mobile, independiente) ───────── Polish
```

### Within Each User Story

- Primero las pruebas, que deben fallar.
- Después las funciones puras (`periods`, `debit_ids`), luego `repository` y `service`, y al final la CLI y el compose.
- Cada checkpoint se verifica antes de pasar a la siguiente fase.

### Parallel Opportunities

- **Fase 2:** T003 y T005 (pruebas en archivos distintos).
- **US1:** T007, T008, T009 y T010 (pruebas), y luego T011 y T012 (módulos puros independientes).
- **US2:** T017, T018 y T019.
- **US5:** T021–T024 (pruebas y script); T026–T029 después de T025.
- **US3:** T031 y T032.
- **US4:** T035, T036 y T037, más T038, T043 y T044.
- **Entre historias:** US5 completa en paralelo con US1–US4 (otro directorio).

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo (archivos distintos):
Task: "T007 test_periods.py: periodo y fecha de cobro"
Task: "T008 test_debit_ids.py: namespace y vector fijo"
Task: "T009 test_run.py: cobro básico y dos usuarios"
Task: "T010 test_sync_visibility.py: el PULL entrega el egreso"

# Módulos puros en paralelo:
Task: "T011 MOD/periods.py"
Task: "T012 MOD/debit_ids.py"
```

## Parallel Example: User Story 5

```bash
Task: "T021 script test:tz en MOB/package.json"
Task: "T022 casos de zona en SRC/lib/dates.test.ts"
Task: "T023 greeting.test.ts con instantes UTC"
Task: "T024 prueba de guardia timezoneGuard.test.ts"
# Tras T025 (dates.ts):
Task: "T026 greeting.ts"  Task: "T027 SubscriptionForm"  Task: "T028 RecurringIncomeForm"  Task: "T029 DateInput"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Fases 1 y 2.
2. Fase 3 (US1): `run` registra los cobros de hoy y el PULL los entrega.
3. **Parar y validar** con quickstart.md §3, ejecutando `run` a mano.

### Incremental Delivery

1. US1 → US2: el cobro ya es seguro ante repeticiones y es el mínimo para dejarlo programado.
2. US5 en paralelo: la app coincide con el servidor en el día de cobro.
3. US3: exclusiones y casos de cuenta o categoría.
4. US4: despliegue automático en Coolify. **Antes de desplegar en producción**, definir `BILLING_ACTIVATION_DATE` en Coolify con el día del despliegue.
5. Polish: documentación, constitución y quickstart completo.

---

## Notes

- `[P]` = archivos distintos y sin dependencias pendientes.
- No hacer commit ni push sin que el usuario lo pida (CLAUDE.md).
- El namespace `9d1e0cb1-0ae7-5d67-856e-c19860851ef1` **no se cambia nunca**: cambiarlo duplicaría cobros cuando la app genere débitos.
- El worker nunca ejecuta migraciones ni modifica `subscriptions` (FR-017, FR-019).
