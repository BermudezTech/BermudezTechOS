# Implementation Plan: Débito automático diario de suscripciones y zona horaria única del MVP

**Branch**: `007-subscription-debit-cron` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-subscription-debit-cron/spec.md`

## Summary

Dos partes:

1. **Servicio de cobros** (US1–US4). Es un nuevo servicio `billing` en `docker-compose.yml` que usa **la misma imagen y el mismo código que `apps/api`**, con otro punto de entrada: `python -m app.modules.subscription_debits serve`. Así reutiliza los modelos, el lock de sincronización por usuario y la infraestructura de pruebas, y no duplica el conocimiento del esquema (research R1).
   - Un bucle `asyncio` propio, sin librería de cron (R2), ejecuta el proceso al arrancar y después cada día a las 00:05 de Bogotá.
   - Por cada usuario abre una transacción, toma el lock exclusivo de sync e inserta un egreso por cada suscripción vencida del periodo actual con `INSERT … ON CONFLICT DO NOTHING`. El ID es UUIDv5 de `"{subscription_id}:{period}"` con un namespace fijo (R4, R5).
   - Cada suscripción va en su propio `SAVEPOINT`, para que el fallo de una no afecte a las demás.
   - Un archivo de latido alimenta el healthcheck (R7). La ejecución manual es `… run [--date]`.
2. **Zona horaria única** (US5). Hay una constante `America/Bogota` por componente.
   - **API:** `app/core/timezone.py`, que usa el servicio de cobros.
   - **App:** `src/lib/dates.ts` cambia `deviceTimeZone()` por `APP_TIME_ZONE`. Además se corrigen los pocos usos directos de la hora del dispositivo: el saludo, los días propuestos en los formularios y el día inicial del selector de fecha en Android (R9, R10).
   - **Pruebas:** la suite de Jest se ejecuta también con `TZ=Asia/Tokyo` y `TZ=Pacific/Honolulu`, y pytest prueba los cálculos con el reloj del sistema en otras zonas (R11).

No hay cambios de esquema ni migraciones.

## Technical Context

**Language/Version**:
- Servicio de cobros: Python 3.13, el mismo proyecto que `apps/api`.
- App: TypeScript estricto con Expo/React Native (sin cambios de versión).

**Primary Dependencies**:
- Servicio: SQLAlchemy 2 async, asyncpg, pydantic-settings y `zoneinfo` de la biblioteca estándar. **No se agregan dependencias** (R2, R8).
- App: `date-fns` 4 y `@date-fns/tz`, que ya están instaladas.

**Storage**: PostgreSQL 17. Se escribe solo en `transactions` y se leen `subscriptions`, `accounts`, `categories`, `users` y `alembic_version`. Sin migraciones.

**Testing**:
- **pytest + testcontainers** (ya configurados):
  - Unitarias: periodos, fecha de cobro, ID, hora de ejecución y configuración.
  - Integración: cobro, idempotencia, concurrencia, reglas de exclusión, cursor del PULL y CLI.
- **Jest** (jest-expo): las pruebas existentes de fechas, más casos nuevos de zona horaria. Toda la suite corre en tres zonas.

**Target Platform**:
- Servicio: contenedor Linux en Coolify, en la misma composición que `api` y `db`.
- App: Android y web.

**Project Type**: servicio en segundo plano (worker) del backend, más cambios en la app móvil/web.

**Performance Goals**: una ejecución en menos de 1 minuto con 10.000 suscripciones activas (SC-005).

**Constraints**:
- El proceso es idempotente y cada cobro es atómico (FR-013 a FR-015).
- Toma el lock de sync por usuario (FR-016).
- Montos `Decimal`, nunca `float`.
- Configuración solo por variables de entorno.
- El servicio no ejecuta migraciones (FR-019).
- Ningún cálculo depende de la zona horaria del sistema (FR-024).

**Scale/Scope**:
- Servicio: decenas de usuarios y hasta unas 10.000 suscripciones.
- App: unos 12 archivos tocados, la mayoría con cambios de una línea.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
|---|---|---|
| **I. Offline-first** | La app sigue leyendo y escribiendo en SQLite y los cobros llegan por el PULL normal. Los movimientos generados tienen UUID, `created_at`, `updated_at` y `deleted_at` (`is_dirty` existe solo en el cliente). | ✅ |
| **II. Sincronización incremental y determinista** | `server_updated_at` lo asigna la base (`clock_timestamp()`). El proceso toma el lock exclusivo por usuario que exige `sync/core/lock.py`, así que ningún PULL concurrente deja un cobro detrás de su cursor. El ID es UUIDv5 determinista y la inserción es idempotente (`ON CONFLICT DO NOTHING`). | ✅ |
| **III. Aislamiento multiusuario y seguridad** | `user_id` sale de la suscripción y nunca de una entrada externa. Las FKs compuestas impiden referencias entre usuarios. La URL de la base va en una variable de entorno. Los logs registran solo identificadores, sin montos ni nombres. | ✅ |
| **IV. Precisión monetaria y temporal** | Los montos pasan `NUMERIC` → `Decimal` → `NUMERIC` sin convertirse nunca a `float`. Se almacena en UTC. La constitución dice "zona local al mostrar"; en el MVP esa zona es `America/Bogota`. No contradice el principio, pero conviene aclarar la redacción (ver la nota debajo de esta tabla). | ✅ (con nota) |
| **V. Modularidad y alcance controlado** | Solo finanzas. El servicio vive en `apps/api` como módulo `subscription_debits`, sin un tercer proyecto. Es la opción más simple: misma imagen, sin dependencias nuevas y un bucle propio en vez de una librería de cron. | ✅ |
| **VI. Multiplataforma liquid glass** | En Android y web las fechas se comportan igual (FR-028). No hay cambios visuales. | ✅ |
| **Calidad: pruebas de montos y sync** | Hay pruebas del cálculo de periodos, la idempotencia, la concurrencia y el cursor del PULL. Las pruebas de fechas de la app corren en tres zonas. | ✅ |
| **Infraestructura (Coolify)** | El servicio es nuevo en el mismo compose. Usa variables de entorno, tiene healthcheck y espera a que `api` esté sana (o sea, con migraciones aplicadas). No necesita volúmenes porque no guarda estado. | ✅ |

**Nota sobre la constitución y `CLAUDE.md`**: proponer una enmienda **PATCH** con `/speckit-constitution` que aclare en el Principio IV: "en el MVP, la zona local es `America/Bogota` para calcular y mostrar". Hay que alinear igual la línea de `CLAUDE.md` y agregar a FR-035 de la spec 001 una nota de que lo reemplaza FR-027 de la spec 007. Esto es documentación y no bloquea la implementación (tarea de cierre).

**Re-check post-diseño (Phase 1)**: sin cambios. [data-model.md](./data-model.md), [contracts/billing-service.md](./contracts/billing-service.md) y [contracts/app-dates.md](./contracts/app-dates.md) mantienen todos los puntos. No hay entradas en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/007-subscription-debit-cron/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── billing-service.md   # CLI, variables de entorno, healthcheck, log de ejecución
│   └── app-dates.md         # comportamiento de src/lib/dates.ts con zona fija
├── checklists/
│   └── requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
docker-compose.yml                       # + servicio `billing` (misma build que `api`)
README.md                                # + servicio billing y comandos run/health
apps/api/.env.example                    # + BILLING_ACTIVATION_DATE, BILLING_RUN_TIME (se copia a .env de la raíz)

apps/api/
├── app/
│   ├── core/
│   │   └── timezone.py                  # APP_TIME_ZONE = ZoneInfo("America/Bogota"), today_local()
│   └── modules/
│       └── subscription_debits/
│           ├── __init__.py
│           ├── __main__.py              # CLI: serve | run [--date] (contracts/billing-service.md)
│           ├── config.py                # BillingSettings (DATABASE_URL, activación, hora, log)
│           ├── periods.py               # puro: periodo actual, fecha de cobro, elegibilidad (R3)
│           ├── debit_ids.py             # NAMESPACE + debit_id(subscription_id, period) (R4)
│           ├── repository.py            # SQL: usuarios candidatos, suscripciones, INSERT ON CONFLICT
│           ├── service.py               # run_for_date(): por usuario, lock, savepoints, resumen (R5)
│           ├── schema_check.py          # alembic_version == head de la imagen (R6)
│           └── scheduler.py             # bucle diario, latido, reintentos (R2, R7)
└── tests/
    ├── unit/subscription_debits/
    │   ├── test_periods.py              # incluye meses cortos, bisiesto, activación, TZ del sistema
    │   ├── test_debit_ids.py            # vector fijo compartido con la app futura
    │   ├── test_scheduler.py            # próxima ejecución en Bogotá, latido
    │   └── test_config.py
    └── integration/subscription_debits/
        ├── test_run.py                  # cobro, exclusiones, categoría inválida, cuenta borrada
        ├── test_idempotency.py          # repetido, paralelo, débito borrado/editado
        ├── test_sync_visibility.py      # el PULL lo entrega; lock frente a PULL concurrente
        └── test_cli.py                  # run --date, fecha futura, sin activación, esquema

apps/mobile/
├── package.json                         # + script test:tz
└── src/
    ├── lib/
    │   ├── dates.ts                     # APP_TIME_ZONE; elimina deviceTimeZone(); todayParts()
    │   ├── dates.test.ts                # casos 19:00–23:59 Bogotá, cambio de mes/año
    │   └── greeting.ts                  # hora de Bogotá
    ├── components/ui/form/DateInput.tsx # día inicial = hoy en Bogotá
    └── modules/finance/components/
        ├── subscriptions/SubscriptionForm.tsx       # día de cobro propuesto = hoy en Bogotá
        └── recurringIncome/RecurringIncomeForm.tsx  # día esperado propuesto = hoy en Bogotá

docs/db-finanzas.md                      # §5: namespace UUIDv5 de débitos y hora de occurred_at
```

**Structure Decision**: el servicio es un **módulo de `apps/api`**, desplegado como un **contenedor aparte** desde la misma imagen. Cumple lo que se pidió: un contenedor y un proceso independientes, en Python, con conexión directa a la base y sin llamar a la API. Además evita duplicar modelos, el lock y la infraestructura de pruebas (research R1). Los cambios de zona horaria en la app se concentran en `src/lib/dates.ts`, que ya centraliza casi todos los cálculos.

## Complexity Tracking

Sin violaciones que justificar.
