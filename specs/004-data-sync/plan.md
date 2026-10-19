# Implementation Plan: Sincronización de datos de finanzas (PUSH/PULL)

**Branch**: `004-data-sync` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-data-sync/spec.md`

## Summary

Añadir a `apps/api` un módulo **`sync`** con dos rutas genéricas para las ocho tablas de finanzas:

- **`POST /api/v1/sync/push`**:
  - Aplica cada registro con last-write-wins usando un único `INSERT … ON CONFLICT DO UPDATE WHERE updated_at más nuevo AND mismo usuario`.
  - Procesa en orden de dependencias. Cada registro va en un SAVEPOINT para aislar su resultado (`APPLIED` / `DISCARDED` / `REJECTED` con código).
  - Valida esquema, referencias y coherencia por entidad.
  - Es idempotente.
- **`POST /api/v1/sync/pull`**:
  - Devuelve los cambios por tabla con paginación por *keyset* y un cursor opaco `(server_updated_at, id)`, incluidos los borrados lógicos.
  - Máximo 1000 registros por respuesta.

La garantía de que ningún cambio confirmado queda detrás de un cursor (FR-019) se logra con un **advisory lock por usuario**: exclusivo en el PUSH y compartido en el PULL. Además, `server_updated_at` se toma siempre del reloj de la base de datos.

**Organización** (petición del usuario): el módulo `sync` tiene un **núcleo** (`core/`) con la configuración y la mecánica común, y una **carpeta por entidad** (`entities/<tabla>/`) que declara cómo se comporta esa tabla en la sincronización: esquema del registro, referencias, reglas de coherencia y traducción de restricciones. Agregar una tabla = crear su carpeta y registrarla en una lista.

No hay cambios de esquema ni migraciones.

## Technical Context

**Language/Version**: Python 3.13, `mypy --strict`.

**Primary Dependencies**: las de la spec 003 (FastAPI, SQLAlchemy 2 async + asyncpg, Pydantic v2). **Sin dependencias nuevas**.

**Storage**: PostgreSQL 17. Se reutilizan las ocho tablas y los índices `(user_id, server_updated_at)` de la migración `0001_initial_schema`.

**Testing**: pytest + pytest-asyncio, testcontainers[postgres] y httpx `ASGITransport` (research S11). La prueba de concurrencia usa dos conexiones reales del `engine`.

**Target Platform**: contenedor Linux en Coolify (sin cambios).

**Project Type**: servicio web (REST API) en `apps/api`.

**Performance Goals**: un PUSH de 200 registros y su PULL en menos de 3 s en total (SC-005). Las referencias se resuelven con una consulta agrupada por tabla referenciada, y cada registro cuesta un `INSERT … ON CONFLICT` dentro de su savepoint. Primer PULL de unos 5.000 registros en 5–6 páginas de 1000 (SC-006).

**Constraints**:
- Nunca se usa punto flotante en montos.
- No se acepta ni se devuelve `user_id`.
- Los controladores no acceden a la base de datos (prueba de arquitectura existente).
- PUSH de como máximo 500 registros y 2 MB.
- Tolerancia de reloj adelantado: 24 h.

**Scale/Scope**: 8 entidades, 2 rutas, 1 módulo nuevo (`sync`) con 8 submódulos de entidad. 1 usuario en el MVP, diseñado para varios.

No quedan **NEEDS CLARIFICATION**: todas las decisiones están en [research.md](./research.md) (S1–S11).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Verificación | Estado |
|---|---|---|
| I. Offline-first | El servidor solo intercambia cambios; la app nunca depende de él para leer. IDs del cliente, `created_at`, `updated_at` y `deleted_at` se respetan tal cual. `is_dirty` se ignora (solo cliente). Los resultados `APPLIED` y `DISCARDED` permiten a la app limpiar `is_dirty`. | ✅ |
| II. Sincronización incremental y determinista | Orden PUSH → PULL documentado en el contrato. LWW estricto (`>`) en una sola sentencia (S4). Cursor basado en una marca del servidor (`clock_timestamp()` de la base, S2) con desempate por `id` (S3). Sin cambios confirmados detrás del cursor (S1). Borrados lógicos incluidos en el PULL. Solo el primer sync descarga todo. PUSH idempotente y débitos de suscripción con su UUIDv5 tratados por LWW. | ✅ |
| III. Multiusuario y seguridad | `user_id` siempre desde la sesión. `ON CONFLICT … WHERE user_id = :u` impide sobrescribir filas ajenas. `ID_CONFLICT` no revela datos ajenos. Las referencias se resuelven solo dentro del usuario y las FKs compuestas siguen como segunda barrera. Rutas protegidas por el guard global. | ✅ |
| IV. Precisión monetaria y temporal | `MoneyStr`, `RateStr` y `PercentStr` solo aceptan strings y se convierten a `Decimal` (S8). Se rechazan los números JSON y no se redondea nunca. Moneda en la cuenta (COP). Fechas UTC ISO-8601. Los saldos no se tocan. | ✅ |
| V. Modularidad y alcance | Solo finanzas. Módulo `sync` autocontenido con núcleo y entidades declarativas: una tabla nueva (incluso de otro módulo futuro) se añade sin tocar el núcleo. Se eligió lo más simple en cada caso: advisory lock en lugar de secuencia + snapshot, y savepoints en lugar de transacción por registro. | ✅ |
| VI. Liquid glass | No aplica: no hay interfaz. Mensajes de rechazo en español e identificadores y códigos en inglés. | ✅ N/A |
| Restricciones técnicas | FastAPI, Pydantic, SQLAlchemy async y PostgreSQL. Sin dependencias nuevas, sin migraciones y sin cambios en Compose o Coolify. | ✅ |
| Flujo y calidad | Spec aclarada (3 preguntas) y este plan. La lógica de sync tiene pruebas automatizadas unitarias, de integración y de concurrencia (S11), como exige la constitución. | ✅ |

**Resultado (pre-research)**: PASA. **Resultado (post-design)**: PASA, sin violaciones; Complexity Tracking queda vacío.

## Project Structure

### Documentation (this feature)

```text
specs/004-data-sync/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones S1–S11
├── data-model.md        # Fase 1: registros por entidad, reglas, resultados y cursor
├── quickstart.md        # Fase 1: guía de validación
├── contracts/
│   └── http-api.md      # POST /sync/push y POST /sync/pull
├── checklists/requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── common/
│   │   ├── schemas.py                 # + MoneyStr, RateStr, PercentStr (S8)
│   │   └── repository.py              # add/touch: server_updated_at = clock_timestamp() (S2)
│   └── modules/
│       ├── __init__.py                # + sync_router en CONTROLLERS
│       └── sync/
│           ├── __init__.py
│           ├── sync_controller.py     # POST /sync/push, POST /sync/pull (solo rutas)
│           ├── sync_service.py        # Orquesta: lock → validar → aplicar → resultados; PULL paginado
│           ├── dependencies.py        # Providers: repositorio con alcance de usuario, servicio
│           ├── schemas.py             # PushRequest/Response, PullRequest/Response, RecordResult
│           │
│           ├── core/                  # Configuración y mecánica común del sync
│           │   ├── __init__.py
│           │   ├── config.py          # MAX_PUSH_RECORDS, PULL_PAGE_SIZE, MAX_FUTURE_SKEW, MAX_BODY_BYTES
│           │   ├── entity.py          # SyncEntity: contrato que implementa cada entidad
│           │   ├── registry.py        # SYNC_ENTITIES en orden de dependencias + búsqueda por tabla
│           │   ├── reasons.py         # RejectCode (enum) y mensajes en español
│           │   ├── batch.py           # BatchContext: aplicados/rechazados/aceptados del lote
│           │   ├── references.py      # Resolución agrupada de referencias (S6)
│           │   ├── ordering.py        # Orden topológico para autorreferencias y detección de ciclos
│           │   ├── cursor.py          # Codificar/decodificar el cursor opaco (S3)
│           │   ├── lock.py            # user_sync_lock(session, user_id, shared=…) (S1)
│           │   └── sync_repository.py # upsert LWW (S4), consulta keyset del PULL, existe-para-usuario
│           │
│           └── entities/              # Una carpeta por tabla: cómo se sincroniza
│               ├── __init__.py
│               ├── categories/
│               │   ├── __init__.py
│               │   ├── schemas.py     # CategoryRecord (entrada/salida, camelCase)
│               │   └── entity.py      # CategoriesSyncEntity: modelo, sin referencias, uq → DUPLICATE
│               ├── reimbursement_groups/   # schemas.py, entity.py
│               ├── assets/                 # schemas.py, entity.py
│               ├── accounts/               # + autorreferencia parent, un nivel, CREDIT_CARD ⇒ LIABILITY
│               ├── subscriptions/          # + categoría EXPENSE, billingMonth en YEARLY
│               ├── recurring_incomes/      # + categoría INCOME, expectedMonth en YEARLY
│               ├── cdts/                   # + cuenta INVESTMENT, autorreferencia renewed_from
│               └── transactions/           # + kind de categoría = type, reglas TRANSFER/suscripción/ingreso
└── tests/
    ├── unit/sync/
    │   ├── test_cursor.py
    │   ├── test_ordering.py
    │   ├── test_money_types.py
    │   └── test_coherence_<entidad>.py     # reglas FR-009a con referencias simuladas
    ├── integration/sync/
    │   ├── conftest.py                     # fábricas de registros por entidad y helpers push/pull
    │   ├── test_push_lww.py
    │   ├── test_push_batch.py              # resultado por registro, dependencias, cascada, límites
    │   ├── test_push_entities.py           # ida y vuelta de las 8 entidades
    │   ├── test_pull_pagination.py
    │   ├── test_pull_first_sync.py         # 15 categorías iniciales
    │   ├── test_sync_isolation.py          # ID_CONFLICT, referencias ajenas, PULL sin datos ajenos
    │   ├── test_money_roundtrip.py
    │   └── test_pull_push_concurrency.py   # FR-019 con dos conexiones reales
    └── contract/
        └── test_routes_protected.py        # (existente) cubre las rutas nuevas
```

**Structure Decision**: se sigue el patrón de la spec 003 (controlador → servicio → repositorio con alcance de usuario, providers en `dependencies.py`) y se añade la división pedida:

- **`sync/core/`** contiene todo lo que **no** depende de una tabla concreta: límites, lock, cursor, orden, contexto del lote, upsert LWW y el contrato `SyncEntity`. El servicio solo habla con este núcleo y con el registro.
- **`sync/entities/<tabla>/`** contiene todo lo que **sí** depende de la tabla, de forma declarativa. Cada `SyncEntity` define:
  - `table` y `model`: nombre público y modelo SQLAlchemy existente.
  - `record_schema`: el modelo Pydantic del registro, que se usa para validar en el PUSH y serializar en el PULL.
  - `references`: lista de `(campo, tabla destino)`. El núcleo la usa para resolver, ordenar y rechazar en cascada.
  - `self_reference`: campo de autorreferencia opcional, para el orden topológico.
  - `reference_fields`: columnas que el núcleo debe traer de cada referencia para la coherencia (p. ej. `kind` de `categories`).
  - `check_coherence(record, refs, batch)`: devuelve `None` o un rechazo `INCOHERENT` con mensaje.
  - `constraint_codes`: traduce nombres de restricciones de la base a códigos (`uq_categories_user_name_kind` → `DUPLICATE`).
- **`sync/core/registry.py`** declara `SYNC_ENTITIES = [categories, reimbursement_groups, assets, accounts, subscriptions, recurring_incomes, cdts, transactions]`. **El orden de la lista es el orden de aplicación y de entrega**. Sumar una tabla consiste en crear su carpeta y añadirla aquí; el núcleo, el controlador y el contrato no cambian.

Flujo del PUSH en `SyncService.push`:
1. Validar el sobre: tablas conocidas y ≤ 500 registros.
2. `user_sync_lock(exclusive)`.
3. Para cada entidad del registro, en orden:
   1. Validar cada registro con `record_schema`, aplicar `CLOCK_AHEAD` y ordenar por autorreferencia.
   2. Resolver referencias agrupadas.
   3. Para cada registro: comprobar dependencias y coherencia, y luego hacer el upsert en un savepoint.
   4. Anotar el resultado en el `BatchContext`.
4. Responder. El commit ocurre antes de enviar la respuesta (`SessionDep` con `scope="function"`).

Flujo del PULL en `SyncService.pull`:
1. `user_sync_lock(shared)`.
2. Decodificar los cursores.
3. Recorrer las entidades en orden, consumiendo el presupuesto de 1000 registros con la consulta keyset.
4. Serializar con `record_schema`.

## Cambios fuera del módulo

- `app/common/schemas.py`: tipos `MoneyStr`, `RateStr` y `PercentStr`, reutilizables por futuras rutas.
- `app/common/repository.py`: `add/touch` asignan `server_updated_at` con `func.clock_timestamp()` en lugar de `Clock.now()` (S2). Hay que ajustar las pruebas de la seed que comparen con el reloj congelado.
- `app/modules/__init__.py`: registrar `sync_router`.
- `docs/db-finanzas.md` §9: `sync_metadata.last_pulled_server_at` pasa a `pull_cursor` (cursor opaco) y se anota el orden de entrega del PULL.
- `GET /api/v1/categories` se mantiene sin cambios (FR-022).

## Complexity Tracking

Sin violaciones de la constitución que justificar.
