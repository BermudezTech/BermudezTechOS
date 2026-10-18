# Implementation Plan: Backend base con autenticación JWT y datos privados por usuario

**Branch**: `003-backend-jwt-auth` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-backend-jwt-auth/spec.md`

## Summary

Crear `apps/api`, una API **FastAPI** organizada en módulos con un **controlador** (rutas) y un **servicio** (lógica) cada uno, al estilo NestJS, con inyección de dependencias por `Depends`. Incluye:

- **Base de datos**: el esquema completo de `docs/db-finanzas.md` en PostgreSQL con SQLAlchemy 2 async y una migración inicial de Alembic. El aislamiento por usuario se aplica dos veces: con un repositorio común que siempre filtra por el usuario de la sesión y con FKs compuestas `(user_id, id)`.
- **Autenticación**:
  - Token de acceso JWT de 15 min y token de renovación opaco de 7 días con rotación y detección de reutilización.
  - Varias sesiones a la vez (una por dispositivo, sin límite). Una reutilización cierra solo la sesión afectada.
  - Bloqueo por correo + IP tras 5 fallos en 15 min.
  - Recuperación de contraseña con un código de 6 dígitos enviado por Resend, que al validarse entrega un permiso de cambio de 10 min.
- **Guards**: un guard global protege todas las rutas y el decorador `@public` marca las excepciones.
- **Registro de usuarios**: un servicio interno (`UserRegistrationService`, sin ruta pública) crea cada usuario junto con sus 15 categorías iniciales en una transacción. Es la única vía para crear usuarios.
- **Arranque**: un *bootstrap* ejecuta las migraciones y la seed antes de uvicorn, bajo un *advisory lock*. La seed registra el primer usuario con ese servicio, solo si no hay usuarios.
- **Rutas de datos**: `GET /api/v1/categories` es la ruta de referencia del patrón.
- **Despliegue**: Docker Compose (API + PostgreSQL) compatible con Coolify.

## Technical Context

**Language/Version**: Python 3.13, con type hints estrictos (`mypy --strict`).

**Primary Dependencies**: FastAPI, uvicorn, SQLAlchemy 2 (asyncio) + asyncpg, Alembic, Pydantic v2 + pydantic-settings, PyJWT, pwdlib[argon2], httpx (API REST de Resend) y email-validator. Gestión con **uv** (research R14).

**Storage**: PostgreSQL 17 (contenedor `db`, volumen persistente).

**Testing**: pytest + pytest-asyncio, httpx `ASGITransport`, testcontainers[postgres], respx; ruff y mypy (research R13).

**Target Platform**: contenedor Linux (`python:3.13-slim`) desplegado en Coolify detrás de su proxy.

**Project Type**: servicio web (REST API) dentro del monorepo, en `apps/api`.

**Performance Goals**: login, renovación y perfil en menos de 1 s en el p95 (SC-008). Argon2id con parámetros por defecto tarda unos 50–100 ms. El resto es una consulta indexada.

**Constraints**:
- Ruta nueva protegida por defecto.
- Nunca guardar secretos en claro.
- Respuestas genéricas que no permitan enumerar usuarios.
- Arranque menor a 2 min desde vacío (SC-007).
- Controladores sin acceso a la base de datos.

**Scale/Scope**: 1 usuario en el MVP, diseñado para varios. 12 tablas (8 de finanzas, `users` y 3 de autenticación), 9 rutas y 6 módulos (`auth`, `users`, `categories`, `health`, `mail`, `bootstrap`).

No quedan **NEEDS CLARIFICATION**: todas las incógnitas están resueltas en [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Verificación | Estado |
|---|---|---|
| I. Offline-first | El servidor no impone conexión al cliente. Las tablas de finanzas aceptan IDs UUID del cliente y tienen `created_at`, `updated_at` y `deleted_at`. `is_dirty` es solo del cliente y no existe en el servidor (FR-002). | ✅ |
| II. Sincronización | Fuera de alcance (PUSH/PULL en otra feature), pero la estructura queda lista: `server_updated_at` lo asigna el servidor con `clock_timestamp()`, con índice (`user_id`, `server_updated_at`), y `UNIQUE (subscription_id, subscription_period)` para los débitos idempotentes. Queda anotado el riesgo de que el cursor salte transacciones confirmadas tarde (R15). | ✅ |
| III. Multiusuario y seguridad | Toda tabla de datos tiene `user_id`, y el servidor filtra siempre por el usuario del JWT con el repositorio común y las FKs compuestas (R9). Ningún DTO acepta ni devuelve `user_id`. Token de acceso corto y renovación con rotación. Secretos solo en variables de entorno, con `.env.example` versionado y `.env` ignorado (R11). La clave de Resend vive solo en el backend. | ✅ |
| IV. Precisión monetaria y temporal | `NUMERIC(14,2)` ↔ `Decimal`, montos como string en JSON (R10), `TIMESTAMPTZ` en UTC y moneda en `accounts.currency`. Los saldos no se almacenan. | ✅ |
| V. Modularidad y alcance | Solo finanzas y autenticación. Monorepo `apps/api`. Los módulos se registran desde una lista, así que un módulo nuevo no modifica los existentes. Se eligió lo más simple en cada caso: sin Redis, sin contenedor de DI, sin RLS (R1, R5, R9). | ✅ |
| VI. Liquid glass | No aplica: no hay interfaz. Los mensajes de la API están en español y los identificadores en inglés. | ✅ N/A |
| Restricciones técnicas | FastAPI, Pydantic, SQLAlchemy 2 async, Alembic y PostgreSQL. Compose compatible con Coolify, con variables de entorno, healthchecks y volumen (R12). Alembic se ejecuta al arrancar (R8). | ✅ |
| Flujo y calidad | Spec aclarada y este plan. Pruebas automatizadas de autenticación, aislamiento y seed (R13). No hay lógica de montos ni de sync que probar en esta feature. | ✅ |

**Resultado (pre-research)**: PASA. **Resultado (post-design)**: PASA, sin violaciones nuevas.

## Project Structure

### Documentation (this feature)

```text
specs/003-backend-jwt-auth/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones R1–R16
├── data-model.md        # Fase 1: tablas, restricciones, estados y seed
├── quickstart.md        # Fase 1: guía de validación
├── contracts/
│   ├── http-api.md      # Rutas, cuerpos y errores
│   └── configuration.md # Variables de entorno, arranque y compose
├── checklists/requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks; no lo crea este comando)
```

### Source Code (repository root)

```text
.gitignore                         # nuevo (.env, __pycache__, .venv, etc.)
docker-compose.yml                 # nuevo: db + api (Coolify)
docker-compose.override.yml        # nuevo: puertos y .env para desarrollo
docs/db-finanzas.md                # + columnas y tablas nuevas, FKs compuestas, único parcial
README.md                          # + sección "API" (FR-025)

apps/api/
├── pyproject.toml                 # deps, ruff, mypy, pytest
├── uv.lock
├── Dockerfile                     # multi-stage con uv, usuario no root
├── docker-entrypoint.sh           # bootstrap y luego uvicorn --proxy-headers
├── .env.example
├── alembic.ini
├── alembic/
│   ├── env.py                     # async, usa Base.metadata
│   └── versions/0001_initial_schema.py
├── app/
│   ├── main.py                    # create_app(): guard global, handlers, CORS, routers
│   ├── bootstrap.py               # advisory lock → upgrade head → seed
│   ├── core/
│   │   ├── config.py              # Settings (pydantic-settings)
│   │   ├── database.py            # engine, sessionmaker, get_session
│   │   ├── security.py            # hash de contraseñas, JWT, tokens opacos, HMAC
│   │   ├── clock.py               # Clock inyectable
│   │   ├── errors.py              # AppError, sobre de error y handlers
│   │   └── logging.py             # configuración y filtro de datos sensibles
│   ├── common/
│   │   ├── guards.py              # auth_guard (global), current_user, CurrentUser
│   │   ├── decorators.py          # @public
│   │   ├── repository.py          # UserScopedRepository[ModelT]
│   │   └── schemas.py             # CamelModel base y ErrorResponse
│   ├── db/
│   │   ├── base.py                # Base, naming convention, mixins
│   │   └── models/                # users.py, auth.py (refresh, reset, login_attempts),
│   │                              # accounts.py, categories.py, transactions.py,
│   │                              # reimbursement_groups.py, subscriptions.py,
│   │                              # recurring_incomes.py, cdts.py, assets.py
│   └── modules/
│       ├── __init__.py            # CONTROLLERS = [health, auth, users, categories]
│       ├── health/health_controller.py, health_service.py
│       ├── auth/
│       │   ├── auth_controller.py
│       │   ├── auth_service.py           # login, refresh, logout
│       │   ├── password_reset_service.py # forgot, verify, reset
│       │   ├── login_throttle.py         # bloqueo por correo + IP
│       │   ├── repositories.py           # refresh tokens, códigos, intentos
│       │   ├── schemas.py
│       │   └── dependencies.py
│       ├── users/users_controller.py, users_service.py, users_repository.py,
│       │         user_registration_service.py,   # usuario + categorías iniciales
│       │         schemas.py, dependencies.py
│       ├── categories/categories_controller.py, categories_service.py,
│       │              categories_repository.py, schemas.py, dependencies.py, defaults.py
│       ├── mail/mail_service.py, templates.py       # Resend (httpx)
│       └── seed/seed_service.py                     # usuario inicial vía UserRegistrationService
└── tests/
    ├── conftest.py                # contenedor PG, migraciones, sesión con rollback, cliente, clock, respx
    ├── factories.py               # crear usuarios y tokens
    ├── unit/                      # security, código HMAC, config
    ├── integration/               # login, throttle, refresh, logout, password reset,
    │                              # users/me, categories, isolation, bootstrap, health,
    │                              # secrets_at_rest
    └── contract/                  # routes_protected, architecture, error envelope
```

**Structure Decision**:
- **Se crea `apps/api`**, ya previsto por la constitución (Principio V) y el `README.md`. `apps/mobile` no se toca.
- **Los modelos SQLAlchemy viven en `app/db/models/`**, separados de los módulos. La mayoría de las tablas de finanzas aún no tiene módulo, y Alembic necesita importar todo el `metadata` desde un solo lugar.
- **Cada módulo de `app/modules/` sigue la misma forma**: `*_controller.py`, `*_service.py`, `schemas.py` y `dependencies.py`, más repositorios cuando accede a datos.
- **Los compose van en la raíz del repo**, para que Coolify despliegue desde ahí.

## Diseño clave

1. **Flujo de una solicitud protegida**: `auth_guard` (global) → controlador → servicio → repositorio con alcance de usuario.
   - El guard deja pasar los endpoints marcados con `@public`.
   - Para el resto valida el bearer y pone el usuario en `request.state.user`.
   - El *provider* del repositorio depende de `CurrentUser`, así que un servicio de datos no puede existir sin usuario (R2, R9).
2. **Sesiones y rotación**: cada login crea un `session_id` que heredan todos los tokens de renovación de ese dispositivo. La rotación se hace con `SELECT … FOR UPDATE`. Un token ya rotado se trata como reutilización y se revocan solo los tokens de su sesión. Logout cierra solo su sesión. Restablecer la contraseña cierra todas (R3).
3. **Recuperación de contraseña**:
   - El correo se envía con `BackgroundTasks`. Si el envío falla, el código queda invalidado.
   - El código se guarda con HMAC y *pepper*, y admite 5 intentos.
   - Al validarlo se entrega un permiso opaco de 10 min. Al cambiar la contraseña se revocan las sesiones y se borran los bloqueos (R6, R7).
4. **Bootstrap**: con un *advisory lock*, ejecuta las migraciones y crea la seed (usuario y categorías en una transacción) solo si no hay usuarios. Cualquier error impide arrancar (R8).
5. **Errores**: un único sobre `{"error": {code, message, details}}`, con mensajes en español (R10).

## Riesgos y seguimiento

- **Varias renovaciones en paralelo cierran la sesión de ese dispositivo** (no las demás). La integración del cliente debe serializar las renovaciones, por ejemplo con un mutex alrededor de la renovación (R3).
- **`FORWARDED_ALLOW_IPS` mal configurado en Coolify convierte el bloqueo en solo por correo.** Hay que verificar en el primer despliegue que `request.client.host` es la IP real (quickstart §4).
- **Cursor de PULL con `server_updated_at`.** Hay que revisarlo en la feature de sincronización (R15).
- **`docs/db-finanzas.md` debe actualizarse** con lo marcado como **(nuevo)** en [data-model.md](./data-model.md).

## Complexity Tracking

No aplica: el Constitution Check no tiene violaciones.
