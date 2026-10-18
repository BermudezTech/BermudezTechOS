---
description: "Tareas para implementar el backend base con autenticación JWT y datos privados por usuario"
---

# Tasks: Backend base con autenticación JWT y datos privados por usuario

**Input**: Design documents from `/specs/003-backend-jwt-auth/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [contracts/configuration.md](./contracts/configuration.md), [quickstart.md](./quickstart.md)

**Tests**: incluidos.
- La spec exige pruebas verificables: SC-002 pide una prueba que recorra todas las rutas, y SC-003, SC-005, SC-006 y SC-009 piden 0 casos en pruebas.
- El plan define las suites (research R13).
- Las pruebas de cada historia se escriben primero y deben fallar antes de implementar.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: historia de usuario de [spec.md](./spec.md): US1–US5.

## Path Conventions

- **Backend**: `apps/api/`. Abreviaturas: `API/` = `apps/api/`, `APP/` = `apps/api/app/`, `TESTS/` = `apps/api/tests/`.
- **Raíz del repo**: `docker-compose*.yml`, `.gitignore`, `README.md`, `docs/`.
- **Comandos**: todos se ejecutan desde `apps/api` con `uv run …`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: crear el proyecto `apps/api` con sus dependencias y herramientas.

- [X] T001 Create the `apps/api` project skeleton per plan.md → Source Code:
  - Packages with empty `__init__.py`: `APP/`, `APP/core/`, `APP/common/`, `APP/db/`, `APP/db/models/`, `APP/modules/` and its subpackages `health`, `auth`, `users`, `categories`, `mail`, `seed`.
  - Test packages: `TESTS/unit/`, `TESTS/integration/`, `TESTS/contract/`.
  - `API/pyproject.toml`:
    - `requires-python = ">=3.13"`.
    - Runtime deps (research R14): `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]>=2.0`, `asyncpg`, `alembic`, `pydantic>=2`, `pydantic-settings`, `email-validator`, `pyjwt`, `pwdlib[argon2]`, `httpx`.
    - Dev dependency group: `pytest`, `pytest-asyncio`, `testcontainers[postgres]`, `respx`, `ruff`, `mypy`.
    - `[tool.pytest.ini_options]` with `asyncio_mode = "auto"` and `testpaths = ["tests"]`.
    - `[tool.ruff]` with `target-version = "py313"`, `line-length = 100` and lint rules `E,F,I,UP,B,ASYNC,S`.
    - `[tool.mypy]` with `strict = true` and the `pydantic.mypy` plugin.
- [X] T002 [P] Create the root `.gitignore`: `.env`, `**/.env`, `__pycache__/`, `.venv/`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `*.pyc`, plus `node_modules/`, `.expo/` and `dist/` for `apps/mobile`. Keep `apps/api/.env.example` tracked.
- [X] T003 [P] Create `API/.env.example` with every variable from contracts/configuration.md → "Variables de entorno":
  - Placeholders only, no real secrets; mark `JWT_SECRET` and `PASSWORD_RESET_PEPPER` with "≥ 32 caracteres aleatorios: `openssl rand -base64 48`".
  - Default `DATABASE_URL=postgresql+asyncpg://bt:bt@db:5432/bermudeztech` and `DOCS_ENABLED=false`.
- [X] T004 Run `uv sync` in `apps/api` to resolve and pin dependencies into `API/uv.lock`, and verify `uv run ruff check .` and `uv run pytest` run, with no tests collected (depends on T001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: configuración, base de datos con el esquema completo, primitivas de seguridad, guard global, manejo de errores y la infraestructura de pruebas que usan todas las historias.

**⚠️ CRITICAL**: ninguna historia puede empezar antes de completar esta fase.

### Core

- [X] T005 Create `APP/core/config.py` with a `Settings(BaseSettings)` class (pydantic-settings, reads env and `.env`). Fields:
  - **Required**: `database_url: str` (must start with `postgresql+asyncpg://`), `jwt_secret: SecretStr` ("≥ 32 caracteres"), `password_reset_pepper: SecretStr` ("≥ 32 caracteres").
  - **Optional**: `resend_api_key: SecretStr | None`, `mail_from: str | None`, `initial_user_email: str | None`, `initial_user_password: SecretStr | None`, `initial_user_display_name: str | None`, `cors_origins: list[str]` (comma-separated, default empty), `docs_enabled: bool = False`, `log_level: str = "INFO"`.
  - **Constants**: `access_token_ttl = 15 min`, `refresh_token_ttl = 7 days`, `reset_code_ttl = 30 min`, `reset_grant_ttl = 10 min`.
  - **Model validator**: `resend_api_key` set without `mail_from` is invalid.
  - **Accessor**: `get_settings()` with `lru_cache`.
  - **Errors**: every validation error message names the variable in UPPER_CASE and never its value, e.g. "Configuración inválida: JWT_SECRET debe tener al menos 32 caracteres."
- [X] T006 [P] Create `APP/core/clock.py`: a `Clock` protocol with `now() -> datetime` (aware UTC), `SystemClock`, and the dependency `get_clock()`, so tests can override it to control expirations.
- [X] T007 [P] Create `APP/core/logging.py`:
  - `configure_logging(level)` with a stdlib `logging` format that includes the logger name.
  - A `SensitiveDataFilter` that redacts values under keys or attributes named `password`, `password_hash`, `token`, `refresh_token`, `access_token`, `reset_token`, `code`, `code_hash`, `grant_hash`, `authorization` (case-insensitive) in `extra` and in record args that are dicts (SC-006).
- [X] T008 [P] Create `APP/core/errors.py` with the envelope from contracts/http-api.md → "Sobre de error":
  - `AppError(status_code, code, message, details=None, headers=None)`.
  - Subclasses: `UnauthenticatedError` (401 `UNAUTHENTICATED`, header `WWW-Authenticate: Bearer`), `NotFoundError` (404 `NOT_FOUND`), `InvalidCredentialsError` (401 `INVALID_CREDENTIALS`, message "Correo o contraseña incorrectos."), `TooManyAttemptsError` (429 `TOO_MANY_ATTEMPTS`, header `Retry-After`), `InvalidRefreshTokenError` (401 `INVALID_REFRESH_TOKEN`), `InvalidCodeError` (400 `INVALID_CODE`), `InvalidResetTokenError` (400 `INVALID_RESET_TOKEN`).
  - `register_exception_handlers(app)`:
    - `AppError` → `{"error": {"code", "message", "details"}}`.
    - `RequestValidationError` → 422 `VALIDATION_ERROR`, with `details=[{"field": <camelCase loc without "body">, "message": <Spanish>}]`.
    - `StarletteHTTPException` 404/405 → envelope.
    - Unhandled `Exception` → 500 `INTERNAL_ERROR` "Ocurrió un error inesperado." without traceback in the body, logging the exception server-side.
- [X] T009 [P] Create `APP/common/schemas.py`:
  - `CamelModel(BaseModel)` with `alias_generator=to_camel`, `populate_by_name=True`, `from_attributes=True`; datetimes serialized as ISO-8601 UTC with `Z` (research R10).
  - `ErrorBody` and `ErrorResponse`, for OpenAPI.
- [X] T010 Create `APP/core/database.py`:
  - `create_async_engine(settings.database_url, pool_pre_ping=True)` and `async_sessionmaker(expire_on_commit=False)`.
  - The dependency `get_session()`: yields an `AsyncSession`, commits on success, rolls back on exception.
  - `dispose_engine()` for the lifespan (depends on T005)

### Esquema de base de datos (data-model.md)

- [X] T011 Create `APP/db/base.py`:
  - `Base(DeclarativeBase)` with `MetaData(naming_convention={"ix": "ix_%(column_0_label)s", "uq": "uq_%(table_name)s_%(column_0_name)s", "ck": "ck_%(table_name)s_%(constraint_name)s", "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s", "pk": "pk_%(table_name)s"})`.
  - `UserOwnedMixin`: `user_id UUID NOT NULL FK users.id ON DELETE CASCADE`, plus `UNIQUE (user_id, id)` and index (`user_id`, `server_updated_at`) declared through `__table_args__` helpers.
  - `SyncColumnsMixin`: `created_at`, `updated_at` `TIMESTAMPTZ NOT NULL`; `deleted_at TIMESTAMPTZ NULL`; `server_updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`.
  - Helper `owned_fk(column, target_table)` that builds the composite `ForeignKeyConstraint(["user_id", column], [f"{target_table}.user_id", f"{target_table}.id"])` (research R9).
  - Money type alias `Money = Numeric(14, 2)` (`asdecimal=True`).
- [X] T012 [P] Create `APP/db/models/users.py`, model `User` (data-model.md → `users`):
  - `id UUID PK`, `email VARCHAR(255) NOT NULL UNIQUE` (stored normalized), `password_hash VARCHAR(255) NOT NULL`, `display_name VARCHAR(100) NULL`.
  - `created_at` and `updated_at` `TIMESTAMPTZ NOT NULL DEFAULT now()`.
  - No sync columns.
- [X] T013 [P] Create `APP/db/models/auth.py` per data-model.md:
  - **`RefreshToken`**:
    - Columns: `id UUID PK`, `user_id UUID NOT NULL FK users ON DELETE CASCADE`, `session_id UUID NOT NULL`, `token_hash CHAR(64) NOT NULL UNIQUE`, `expires_at TIMESTAMPTZ NOT NULL`, `revoked_at TIMESTAMPTZ NULL`, `replaced_by_id UUID NULL FK refresh_tokens.id`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
    - Indexes: (`user_id`, `revoked_at`) and (`session_id`).
  - **`PasswordResetCode`**:
    - Columns: `id UUID PK`, `user_id FK users ON DELETE CASCADE`, `code_hash CHAR(64) NOT NULL`, `expires_at TIMESTAMPTZ NOT NULL`, `failed_attempts SMALLINT NOT NULL DEFAULT 0, CHECK 0–5`, `used_at`, `invalidated_at`, `grant_hash CHAR(64) NULL UNIQUE`, `grant_expires_at`, `grant_used_at` (all nullable `TIMESTAMPTZ`), `created_at NOT NULL DEFAULT now()`.
    - CHECK `grant_hash IS NULL OR used_at IS NOT NULL`.
    - Index (`user_id`, `created_at`).
  - **`LoginAttempt`**:
    - Columns: `id BIGINT identity PK`, `email VARCHAR(255) NOT NULL`, `ip INET NOT NULL`, `attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
    - Index (`email`, `ip`, `attempted_at`).
- [X] T014 [P] Create `APP/db/models/accounts.py`, model `Account` (`UserOwnedMixin` + `SyncColumnsMixin`), with the columns from docs/db-finanzas.md §1:
  - **Composite FK**: (`user_id`, `parent_account_id`) → accounts.
  - **CHECKs**:
    - "`type IN (CHECKING, SAVINGS, CASH, CREDIT_CARD, POCKET, INVESTMENT)`"
    - "`nature IN (ASSET, LIABILITY)`"
    - "`type <> 'CREDIT_CARD' OR nature = 'LIABILITY'`"
    - "`statement_day` y `payment_due_day` entre 1 y 31 o NULL"
    - "`parent_account_id <> id`"
  - **Defaults**: `currency CHAR(3) DEFAULT 'COP'`, `opening_balance Money DEFAULT 0`, `credit_limit Money NULL`, booleans `DEFAULT FALSE`, `sort_order DEFAULT 0`.
- [X] T015 [P] Create `APP/db/models/categories.py`, model `Category` (§2):
  - Columns: `name VARCHAR(50) NOT NULL`, `kind VARCHAR(10)`, `icon` and `color` `VARCHAR(50) NULL`, `sort_order INT NOT NULL DEFAULT 0`.
  - CHECK "`kind IN (INCOME, EXPENSE)`".
  - **Partial unique index** `uq_categories_user_name_kind` on (`user_id`, `name`, `kind`) `WHERE deleted_at IS NULL` (research R16).
  - Index (`user_id`, `kind`, `sort_order`).
- [X] T016 [P] Create `APP/db/models/reimbursement_groups.py`, model `ReimbursementGroup` (§4):
  - Columns: `name VARCHAR(100) NOT NULL`, `payer VARCHAR(100) NULL`, `notes TEXT NULL`.
  - CHECKs "`kind IN (REIMBURSEMENT, ADVANCE)`" and "`status IN (OPEN, SUBMITTED, SETTLED)`", `status DEFAULT 'OPEN'`.
- [X] T017 [P] Create `APP/db/models/subscriptions.py`, model `Subscription` (§5):
  - **Composite FKs**: (`user_id`, `account_id`) → accounts, (`user_id`, `category_id`) → categories.
  - **CHECKs**:
    - "`amount > 0`"
    - "`billing_cycle IN (MONTHLY, YEARLY)`"
    - "`billing_day` entre 1 y 31"
    - "`billing_month` entre 1 y 12 o NULL"
    - "`billing_cycle <> 'YEARLY' OR billing_month IS NOT NULL`"
    - "`status IN (ACTIVE, PAUSED, CANCELLED)`"
  - **Defaults**: `billing_cycle DEFAULT 'MONTHLY'`, `status DEFAULT 'ACTIVE'`; `start_date DATE NOT NULL`.
- [X] T018 [P] Create `APP/db/models/recurring_incomes.py`, model `RecurringIncome` (§8):
  - **Composite FKs**: (`user_id`, `account_id`) → accounts, (`user_id`, `category_id`) → categories.
  - **CHECKs**:
    - "`expected_amount > 0`"
    - "`cycle IN (MONTHLY, YEARLY)`"
    - "`expected_day` entre 1 y 31"
    - "`expected_month` entre 1 y 12 o NULL"
    - "`cycle <> 'YEARLY' OR expected_month IS NOT NULL`"
    - "`status IN (ACTIVE, PAUSED)`"
  - **Defaults**: `cycle DEFAULT 'MONTHLY'`, `status DEFAULT 'ACTIVE'`.
- [X] T019 [P] Create `APP/db/models/cdts.py`, model `Cdt` (§6):
  - **Composite FKs**: (`user_id`, `account_id`) → accounts (with `UNIQUE (account_id)`), (`user_id`, `source_account_id`) → accounts, (`user_id`, `payout_account_id`) → accounts, (`user_id`, `renewed_from_cdt_id`) → cdts.
  - **Types**: `annual_rate_ea` and `annual_rate_nominal` `NUMERIC(7,4) NOT NULL`, `withholding_rate NUMERIC(5,2) NOT NULL DEFAULT 4.00`.
  - **CHECKs**:
    - "`principal > 0`"
    - "`term_days > 0`"
    - "`matures_on >= opened_on`"
    - "`interest_payment IN (AT_MATURITY, MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL)`"
    - "`status IN (ACTIVE, MATURED, RENEWED, CANCELLED)`"
- [X] T020 [P] Create `APP/db/models/assets.py`, model `Asset` (§7):
  - Columns: `name VARCHAR(100) NOT NULL`, `value Money NOT NULL`, `valid_until DATE NOT NULL`.
  - CHECK "`value >= 0`".
- [X] T021 [P] Create `APP/db/models/transactions.py`, model `Transaction` (§3):
  - **Composite FKs**: (`user_id`, `account_id`) and (`user_id`, `counter_account_id`) → accounts, (`user_id`, `category_id`) → categories, (`user_id`, `reimbursement_group_id`) → reimbursement_groups, (`user_id`, `subscription_id`) → subscriptions, (`user_id`, `recurring_income_id`) → recurring_incomes, (`user_id`, `cdt_id`) → cdts.
  - **CHECKs**:
    - "`type IN (INCOME, EXPENSE, TRANSFER)`"
    - "`amount > 0`"
    - "`(type = 'TRANSFER') = (counter_account_id IS NOT NULL)`"
    - "`counter_account_id IS NULL OR counter_account_id <> account_id`"
    - "`category_source IN (MANUAL, AI)`" with `DEFAULT 'MANUAL'`
    - "`(recurring_income_id IS NULL) = (recurring_income_period IS NULL)`"
    - "`recurring_income_id IS NULL OR type = 'INCOME'`"
    - `subscription_period` and `recurring_income_period` `VARCHAR(7)` matching `^\d{4}(-\d{2})?$` or NULL
  - **UNIQUE** (`subscription_id`, `subscription_period`).
  - **Indexes**: (`user_id`, `account_id`, `occurred_at`), (`counter_account_id`), (`user_id`, `category_id`, `occurred_at`), (`reimbursement_group_id`), (`recurring_income_id`, `recurring_income_period`).
- [X] T022 Create `APP/db/models/__init__.py` importing every model (T012–T021) so `Base.metadata` is complete for Alembic (depends on T012–T021)
- [X] T023 Create `API/alembic.ini` and `API/alembic/env.py`:
  - Async migrations with `run_async` and `connection.run_sync(do_run_migrations)`, `target_metadata = Base.metadata` and `compare_type=True`.
  - URL taken from `get_settings().database_url`; `API/alembic/script.py.mako` default (depends on T005, T022)
- [X] T024 Generate and hand-review `API/alembic/versions/0001_initial_schema.py` (`uv run alembic revision --autogenerate -m "initial schema"` against a local Postgres). Check that:
  - The creation order follows data-model.md.
  - The partial unique index on categories has `postgresql_where`.
  - Every CHECK, `clock_timestamp()` default, `INET` type and composite FK is present.
  - `downgrade()` drops everything in reverse (depends on T023)

### Seguridad, guard y aplicación

- [X] T025 Create `APP/core/security.py` (research R3, R4, R6):
  - **Passwords**: `hash_password` and `verify_password` with `pwdlib.PasswordHash((Argon2Hasher(),))`, and `PASSWORD_MIN = 8`, `PASSWORD_MAX = 128`.
  - **Access tokens**:
    - `create_access_token(user_id, now) -> str`: PyJWT HS256, claims `sub`, `typ="access"`, `iat`, `exp = now + 15 min`, `jti = uuid4`.
    - `decode_access_token(token, now) -> UUID`: rejects a bad signature, expiry, `typ != "access"` or a missing or non-UUID `sub` by raising `UnauthenticatedError`; no leeway.
  - **Opaque tokens**: `new_opaque_token() -> str` (`secrets.token_urlsafe(32)`) and `sha256_hex(value) -> str`.
  - **Reset codes**: `new_reset_code() -> str` (`f"{secrets.randbelow(10**6):06d}"`) and `hash_reset_code(user_id, code) -> str` (HMAC-SHA256 with `password_reset_pepper`, message `f"{user_id}:{code}"`, hex).
  - **Comparison**: `constant_time_equals` wrapping `hmac.compare_digest`.
  - **Email**: `normalize_email(email) -> str` (`strip().lower()`) (depends on T005)
- [X] T026 [P] Create `APP/common/decorators.py`: `public(fn)` sets `fn.__public__ = True` and returns `fn`; `is_public(endpoint) -> bool` (research R2).
- [X] T027 Create `APP/common/guards.py` (research R2):
  - **`auth_guard(request, session, clock)`**:
    - If `is_public(request.scope["endpoint"])`, return.
    - Otherwise read the `Authorization: Bearer` header (`HTTPBearer(auto_error=False)`, so Swagger shows the lock), decode it with `decode_access_token` and load the `User` by id.
    - Raise `UnauthenticatedError` if the header is missing or malformed or the user does not exist.
    - On success set `request.state.user`.
  - **`current_user(request) -> User`**: returns `request.state.user` and raises `UnauthenticatedError` if it is absent.
  - **`CurrentUser = Annotated[User, Depends(current_user)]`** (depends on T010, T012, T025, T026)
- [X] T028 Create `APP/modules/__init__.py` with `CONTROLLERS: list[APIRouter] = []`, filled as modules are added. Then create `APP/main.py` with `create_app() -> FastAPI`:
  - `FastAPI(title="BermudezTechOS API", dependencies=[Depends(auth_guard)], docs_url/redoc_url/openapi_url = None unless settings.docs_enabled, lifespan)`.
  - The lifespan configures logging, warns "Envío de correo no configurado" when Resend is missing, and calls `dispose_engine` on shutdown.
  - `register_exception_handlers`, plus `CORSMiddleware` with `settings.cors_origins` when that list is not empty.
  - `include_router` for each entry of `CONTROLLERS`: `/health` without a prefix, the rest under `/api/v1`.
  - A module-level `app = create_app()` (depends on T008, T027)

### Infraestructura de pruebas

- [X] T029 Create `TESTS/conftest.py`:
  - **Session-scoped database**: a `PostgresContainer("postgres:17-alpine")` from testcontainers, or `TEST_DATABASE_URL` if set, converted to `postgresql+asyncpg://`.
  - **Environment**: set the required env vars (`JWT_SECRET` and `PASSWORD_RESET_PEPPER` 48-char test values) and clear the `get_settings` cache.
  - **Migrations**: run `alembic upgrade head` once.
  - **Function-scoped `db_session`**: bound to a connection with an outer transaction plus a `begin_nested` savepoint, rolled back after each test.
  - **`frozen_clock`**: a mutable `FakeClock` with `advance(timedelta)`.
  - **`app`**: `create_app()` with `dependency_overrides` for `get_session` and `get_clock`.
  - **`client`**: `httpx.AsyncClient(transport=ASGITransport(app), base_url="http://test")`.
  - **`respx_mock`**: for Resend (depends on T010, T024, T028)
- [X] T030 [P] Create `TESTS/factories.py`:
  - `create_user(session, email="a@test.dev", password="password-123", display_name=None) -> User`, which inserts directly with `hash_password`.
  - `auth_headers(access_token)`.
  - `login(client, email, password) -> dict`, which returns the TokenPair JSON (depends on T012, T025)
- [X] T031 [P] Create `TESTS/unit/test_security.py`:
  - Argon2 hash and verify round-trip, plus a wrong password.
  - Access token: round-trip, expired at `now + 15 min + 1 s`, bad signature, `typ="refresh"` rejected, missing `sub`.
  - `new_reset_code` is always 6 digits.
  - `hash_reset_code` is deterministic per (user, code) and differs between users.
  - `normalize_email(" A@B.Com ") == "a@b.com"` (depends on T025)
- [X] T032 [P] Create `TESTS/unit/test_config.py`:
  - A missing `JWT_SECRET`, or a `JWT_SECRET` of 31 characters, raises an error whose text contains "JWT_SECRET" but not the value.
  - `RESEND_API_KEY` without `MAIL_FROM` is invalid.
  - Without either Resend variable the configuration is valid (depends on T005)
- [X] T033 [P] Create `TESTS/contract/test_error_envelope.py`:
  - An unknown path → 404 with `{"error": {"code": "NOT_FOUND", …}}`.
  - A route that raises an unexpected exception (registered only inside the test) → 500 `INTERNAL_ERROR` without a traceback in the body.
  - Malformed JSON on a public route → 422 `VALIDATION_ERROR` with `details[].field` in camelCase (depends on T028, T029)

**Checkpoint**:
- `uv run pytest` passes the unit and contract tests.
- `alembic upgrade head` creates the 12 tables of data-model.md.
- User story work can begin.

---

## Phase 3: User Story 1 - Crear el primer usuario e iniciar sesión (Priority: P1) 🎯 MVP

**Goal**:
- La seed crea en el arranque el único usuario y sus 15 categorías, solo si no hay usuarios.
- El usuario inicia sesión con correo y contraseña, con bloqueo por correo + IP.
- El usuario consulta su perfil.

**Independent Test**:
- Con `INITIAL_USER_*` definidas y la base vacía, ejecutar `python -m app.bootstrap` crea 1 usuario y 15 categorías.
- `POST /api/v1/auth/login` devuelve un TokenPair.
- `GET /api/v1/users/me` con el token de acceso devuelve el perfil.
- Repetir el bootstrap no cambia nada.

### Tests for User Story 1 ⚠️

> Escribir primero; deben fallar antes de implementar.

- [X] T034 [P] [US1] Create `TESTS/integration/test_user_registration.py` against `UserRegistrationService` (FR-016):
  - Registering a user creates the user and exactly 15 categories owned by that user.
  - Registering a second user gives it its own 15 categories with different ids; the first user's categories are unchanged.
  - If inserting the categories fails (simulate it by making `build_default_categories` raise), no user is created.

  Then create `TESTS/integration/test_seed.py` against `SeedService` (spec US1 escenarios 1–3, FR-006a, FR-016):
  - **Empty DB with valid variables**:
    - Creates exactly 1 user with the normalized email and an Argon2 hash that verifies.
    - Creates 15 categories with names, kinds, `sort_order`, icons and colors exactly as in the data-model.md "Categorías iniciales del usuario" table.
    - All categories have `deleted_at IS NULL`.
  - **DB that already has a user**: with different variables or none at all, it creates nothing and changes no password.
  - **Empty DB with missing or invalid variables**: a missing `INITIAL_USER_EMAIL` or `INITIAL_USER_PASSWORD`, or a password of 7 or 129 characters, raises `SeedConfigError` naming the variable and creates nothing.
  - **Logs**: captured logs (`caplog`) never contain the password (depends on T029, T030)
- [X] T035 [P] [US1] Create `TESTS/integration/test_bootstrap.py`:
  - `run_bootstrap()` on an empty schema applies migrations and seeds.
  - A second run logs "Seed omitida: ya existe un usuario".
  - Two `run_bootstrap()` calls in parallel (`asyncio.gather`, separate engines) end with exactly 1 user and 15 categories (advisory lock).
  - Invalid seed variables with no users → `run_bootstrap()` returns a non-zero exit code.
  - This test uses its own fresh database, created with `CREATE DATABASE` on the container, not the rollback session (depends on T029)
- [X] T036 [P] [US1] Create `TESTS/integration/test_login.py` (FR-008, FR-009, contracts/http-api.md → `POST /auth/login`):
  - **Valid credentials** → 200 TokenPair with `tokenType == "bearer"`, `expiresIn == 900` and `refreshExpiresIn == 604800`; the access JWT has `typ == "access"` and `sub == user.id`; a `refresh_tokens` row exists with `expires_at = now + 7 days` and a non-null `session_id`.
  - **Normalization**: email `"  A@Test.DEV "` logs in.
  - **Wrong password and unknown email** → both 401 `INVALID_CREDENTIALS` with byte-identical bodies.
  - **Password of 129 characters** → 422.
  - **Two logins**: they produce two different `session_id` values (spec US3 escenario 7) (depends on T029, T030)
- [X] T037 [P] [US1] Create `TESTS/integration/test_login_throttle.py` (FR-014):
  - 5 failed logins from IP `1.1.1.1` (set the client address through the ASGITransport `client=("1.1.1.1", 123)`), then a 6th attempt even with the correct password → 429 `TOO_MANY_ATTEMPTS` with an integer `Retry-After` > 0.
  - From IP `2.2.2.2` with the correct password → 200.
  - After `frozen_clock.advance(15 min)`, from `1.1.1.1` → 200, and the rows for (email, `1.1.1.1`) are deleted after that success.
  - Rows older than 1 day are purged on the next failure (depends on T029, T030)
- [X] T038 [P] [US1] Create `TESTS/integration/test_users_me.py`:
  - `GET /api/v1/users/me` with a valid access token → 200 `{id, email, displayName, createdAt}`, with no `passwordHash`/`password` keys and `createdAt` ending in `Z`.
  - Without a token → 401 `UNAUTHENTICATED` (depends on T029, T030)
- [X] T039 [P] [US1] Create `TESTS/contract/test_no_signup_route.py` (FR-006, spec US1 escenario 6): no route in `app.routes` has a path containing `register`, `signup` or `sign-up`, and no `POST` exists on `/api/v1/users` (depends on T028)

### Implementation for User Story 1

- [X] T040 [P] [US1] Create `APP/modules/categories/defaults.py` with `DEFAULT_CATEGORIES: tuple[DefaultCategory, ...]` (`name`, `kind`, `icon`, `color`, `sort_order`), copied verbatim from the data-model.md "Categorías iniciales del usuario" table, and `build_default_categories(user_id, now) -> list[Category]`, which returns new `Category` instances (uuid4 ids, `created_at = updated_at = server_updated_at = now`):
  - 12 EXPENSE categories with `sort_order` 0–11: Transporte, Alimentación, Entretenimiento, Suscripciones, Servicios, Mercado, Combustible, Parqueadero, Salud, Fitness, Viajes, Ropa.
  - 3 INCOME categories with `sort_order` 0–2: Salario, Rendimientos, Otros ingresos.
- [X] T041 [P] [US1] Create `APP/modules/users/users_repository.py`, class `UsersRepository(session)`, with `get_by_id(id)`, `get_by_email(normalized_email)`, `exists_any() -> bool` (`SELECT EXISTS`), `create(email, password_hash, display_name) -> User` (id uuid4) and `update_password(user, password_hash, now)`, which sets `updated_at`.
- [X] T042 [P] [US1] Create the session part of `APP/modules/auth/repositories.py`, class `RefreshTokenRepository(session)`, with `create(user_id, session_id, token_hash, expires_at, now) -> RefreshToken`. Rotation and revocation methods are added in US3.
- [X] T043 [P] [US1] Create `APP/modules/auth/login_throttle.py`, class `LoginThrottle(session, clock)` (research R5, data-model.md → `login_attempts`):
  - `check(email, ip)` raises `TooManyAttemptsError(retry_after=…)` when "`COUNT(*) >= 5` con `attempted_at > now − 15 min`". `retry_after` is the seconds until the 5th most recent failure is 15 min old, minimum 1.
  - `record_failure(email, ip)` inserts a row and deletes rows with `attempted_at < now − 1 día`.
  - `clear(email, ip)` deletes the rows for that pair; `clear_email(email)` deletes all rows for that email.
- [X] T044 [US1] Create the user registration and the seed (FR-006, FR-006a, FR-016):
  - **`APP/modules/users/user_registration_service.py`**: class `UserRegistrationService(session, users, clock)` with `register(email, password, display_name) -> User`.
    - It normalizes the email, hashes the password, and in one transaction calls `users.create(...)` and adds `build_default_categories(user.id, clock.now())`. If anything fails, it rolls back and nothing is created.
    - It is the only code path allowed to create users. No controller exposes it (FR-006).
  - **`APP/modules/seed/seed_service.py`**: class `SeedService(session, settings, registration, clock)` with `run() -> SeedResult` (`CREATED` or `SKIPPED`).
    - If `UsersRepository.exists_any()`, return `SKIPPED` without reading the variables.
    - Otherwise validate `INITIAL_USER_EMAIL` (email-validator, then `normalize_email`), `INITIAL_USER_PASSWORD` (8–128 characters) and `INITIAL_USER_DISPLAY_NAME` (≤ 100 characters or None). On failure raise `SeedConfigError("<VAR> …")` without values.
    - Call `registration.register(...)`, then log "Usuario inicial creado: <email>".
  - **`TESTS/factories.py`**: add `register_user(session, …)`, which goes through `UserRegistrationService` and so creates the categories. Use it wherever a test needs a user with categories, such as T055 and T056 (depends on T040, T041)
- [X] T045 [US1] Create `APP/bootstrap.py` with `async def run_bootstrap(settings) -> int` and `if __name__ == "__main__": sys.exit(asyncio.run(...))` (research R8, contracts/configuration.md → "Secuencia de arranque"):
  - `Settings()` errors → log and return 1.
  - On a dedicated connection: `SELECT pg_advisory_lock(BOOTSTRAP_LOCK_ID)`, where `BOOTSTRAP_LOCK_ID` is a fixed 64-bit constant.
  - Run Alembic `command.upgrade(config, "head")` in a thread or through `run_sync`. On error return 1 without seeding.
  - Run `SeedService.run()`. `SeedConfigError` → return 1; `SKIPPED` → log "Seed omitida: ya existe un usuario".
  - Always `pg_advisory_unlock` in `finally` and return 0 on success (depends on T024, T044)
- [X] T046 [P] [US1] Create `APP/modules/auth/schemas.py`:
  - `LoginRequest(CamelModel)` with `email: EmailStr` and `password: str` (min 1, max 128).
  - `TokenPair(CamelModel)` with `access_token`, `refresh_token`, `token_type: Literal["bearer"] = "bearer"`, `expires_in: int = 900` and `refresh_expires_in: int = 604800`.
- [X] T047 [US1] Create `APP/modules/auth/auth_service.py`, class `AuthService(session, users, refresh_tokens, throttle, clock)` (research R3):
  - **`_issue_tokens(user, session_id) -> TokenPair`**: creates the access JWT and a new opaque refresh token, and stores its `sha256_hex` with `expires_at = now + 7 days`.
  - **`login(email, password, ip) -> TokenPair`**:
    1. Normalize the email and call `throttle.check`.
    2. Look up the user. If it does not exist, still run `verify_password` against a fixed dummy Argon2 hash to equalize timing.
    3. On failure: `throttle.record_failure` and raise `InvalidCredentialsError`.
    4. On success: `throttle.clear(email, ip)` and `_issue_tokens(user, session_id=uuid4())` (depends on T041, T042, T043, T046)
- [X] T048 [US1] Create `APP/modules/auth/dependencies.py` with the providers `get_users_repository`, `get_refresh_token_repository`, `get_login_throttle` and `get_auth_service`, all through `Depends(get_session)` and `Depends(get_clock)`. Create `APP/modules/users/dependencies.py` with `get_users_service` (depends on T047)
- [X] T049 [US1] Create `APP/modules/auth/auth_controller.py`: `router = APIRouter(prefix="/auth", tags=["auth"])` with `@router.post("/login", response_model=TokenPair)` decorated with `@public`. It receives `LoginRequest`, `Request` (ip = `request.client.host`) and `AuthService` through `Depends`, and only calls `service.login(...)`; no database imports (depends on T048)
- [X] T050 [P] [US1] Create `APP/modules/users/schemas.py` with `UserProfile(CamelModel)` (`id`, `email`, `display_name`, `created_at`), and `APP/modules/users/users_service.py` with `UsersService.get_profile(user) -> UserProfile` (depends on T041)
- [X] T051 [US1] Create `APP/modules/users/users_controller.py`: `router = APIRouter(prefix="/users", tags=["users"])` with `@router.get("/me", response_model=UserProfile)`, which receives `CurrentUser` and `UsersService` and returns `service.get_profile(user)` (depends on T048, T050)
- [X] T052 [US1] Register `auth_controller.router` and `users_controller.router` in `CONTROLLERS` in `APP/modules/__init__.py`, and verify that T034–T039 pass (depends on T045, T049, T051)

**Checkpoint**:
- La seed y `python -m app.bootstrap` funcionan.
- El inicio de sesión, el bloqueo y `/users/me` funcionan.
- US1 es demostrable por sí sola.

---

## Phase 4: User Story 2 - Rutas protegidas y datos privados por usuario (Priority: P1)

**Goal**: toda ruta no pública exige una sesión válida. Los datos se leen solo mediante repositorios con alcance de usuario, y la base de datos rechaza referencias cruzadas. `GET /api/v1/categories` es la ruta de referencia del patrón.

**Independent Test**: con dos usuarios A y B, el segundo creado por `factories.register_user`, "listar mis categorías" devuelve a cada uno solo las suyas, y sin sesión válida responde 401. La prueba que recorre las rutas pasa.

### Tests for User Story 2 ⚠️

- [X] T053 [P] [US2] Create `TESTS/contract/test_routes_protected.py` (SC-002, FR-017, FR-018):
  - Iterate `app.routes` (`APIRoute` only).
  - Assert that the set of public paths is exactly `{"/health", "/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/password/forgot", "/api/v1/auth/password/verify", "/api/v1/auth/password/reset"}`. While a story is not yet implemented, the test asserts a subset.
  - For every non-public route and method, call it with path params filled with a random UUID and no token → 401 `UNAUTHENTICATED` with header `WWW-Authenticate: Bearer`. Repeat with these tokens, all → 401:
    - A malformed token.
    - A token signed with another secret.
    - An expired token (`frozen_clock.advance(16 min)`).
    - A token whose `typ` is `refresh`.
    - A token for a deleted user (`DELETE FROM users` within the test transaction) (depends on T052)
- [X] T054 [P] [US2] Create `TESTS/contract/test_architecture.py`:
  - Parse every `APP/modules/**/*_controller.py` with `ast`.
  - Fail if any imports `sqlalchemy`, `AsyncSession`, `app.core.database` or `app.db.models.*` (except for type-only `User` from `app.db.models.users`), or calls a repository directly (spec → Restricciones de arquitectura) (depends on T001)
- [X] T055 [P] [US2] Create `TESTS/integration/test_categories.py` (FR-021a, contracts/http-api.md → `GET /categories`):
  - The seeded user gets 15 `items`, ordered EXPENSE then INCOME, then by `sortOrder` and `name`.
  - Each item has exactly the keys `id, name, kind, icon, color, sortOrder, createdAt, updatedAt, deletedAt, serverUpdatedAt`, with `deletedAt == null` and no `userId`.
  - A category with `deleted_at` set is excluded.
  - The query param `?userId=<other>` is ignored (depends on T029, T030)
- [X] T056 [P] [US2] Create `TESTS/integration/test_isolation.py` (SC-003, FR-004, FR-019–FR-021):
  - **API**: users A and B each have categories, and each token lists only its own.
  - **Repository**: `CategoriesRepository(session, A.id).get(<B's category id>)` returns `None`, and `add()` forces `user_id = A.id` even if the instance had B's id.
  - **Database**, inserting directly through the session, each raises `IntegrityError`:
    - An `accounts` row of A with `parent_account_id` = an account of B.
    - A `transactions` row of A with `category_id` = a category of B.
    - A `subscriptions` row of A with `account_id` = an account of B.
  - **Database**, the same inserts with A's own references succeed (depends on T029, T030)

### Implementation for User Story 2

- [X] T057 [US2] Create `APP/common/repository.py` with `UserScopedRepository(Generic[ModelT])` (research R9):
  - `model: type[ModelT]`, `__init__(session, user_id, clock)`.
  - `_query(include_deleted=False)` returns `select(model).where(model.user_id == self.user_id)` and adds `model.deleted_at.is_(None)` unless `include_deleted`.
  - `get(id, include_deleted=False) -> ModelT | None` and `list(order_by…, include_deleted=False)`.
  - `add(instance)` sets `instance.user_id = self.user_id` and `server_updated_at = clock.now()`, then calls `session.add`.
  - `touch(instance)` sets `server_updated_at` and raises `ValueError` if `instance.user_id != self.user_id`.
  - No method accepts a `user_id` argument (depends on T011)
- [X] T058 [US2] Create `APP/modules/categories/categories_repository.py`: `CategoriesRepository(UserScopedRepository[Category])` with `list_active()`, ordered by `kind`, `sort_order`, `name` (depends on T057, T015)
- [X] T059 [P] [US2] Create `APP/modules/categories/schemas.py`:
  - `CategoryOut(CamelModel)` with `id: UUID`, `name: str`, `kind: Literal["INCOME", "EXPENSE"]`, `icon: str | None`, `color: str | None`, `sort_order: int`, `created_at`, `updated_at`, `deleted_at: datetime | None`, `server_updated_at`. It has no `user_id` field and uses `model_config extra="ignore"`.
  - `CategoryList(CamelModel)` with `items: list[CategoryOut]`.
- [X] T060 [US2] Create `APP/modules/categories/categories_service.py`, class `CategoriesService(repository: CategoriesRepository)`, with `list_categories() -> CategoryList` (depends on T058, T059)
- [X] T061 [US2] Create `APP/modules/categories/dependencies.py`: `get_categories_repository(user: CurrentUser, session, clock)`, which builds `CategoriesRepository(session, user.id, clock)`, so the repository cannot exist without the session user, and `get_categories_service` (depends on T027, T060)
- [X] T062 [US2] Create `APP/modules/categories/categories_controller.py`: `router = APIRouter(prefix="/categories", tags=["categories"])` with `@router.get("", response_model=CategoryList)`, which receives `CategoriesService` through `Depends` and returns `service.list_categories()`. This is the reference pattern: document it in the module docstring as such for future modules (depends on T061)
- [X] T063 [US2] Register `categories_controller.router` in `APP/modules/__init__.py` and verify that T053–T056 pass (depends on T062)

**Checkpoint**: el guard, el aislamiento y la ruta de referencia funcionan. US1 + US2 forman el MVP de seguridad.

---

## Phase 5: User Story 3 - Mantener la sesión y cerrarla (Priority: P2)

**Goal**:
- La renovación rota el token de renovación dentro de su sesión, una por dispositivo.
- Reutilizar un token cierra solo esa sesión.
- `logout` cierra solo la sesión actual.

**Independent Test**: dos sesiones del mismo usuario (A y B):
- Renovar A rota su token.
- Reutilizar el token anterior de A cierra A, pero B sigue renovando.
- `logout` de B deja su token inválido.

### Tests for User Story 3 ⚠️

- [X] T064 [P] [US3] Create `TESTS/integration/test_refresh_rotation.py` (FR-011, SC-005, spec US3 escenarios 1–3 and 6):
  - **Valid refresh** → 200 new TokenPair. The old row has `revoked_at` and `replaced_by_id` set; the new row has the same `session_id` and `expires_at = now + 7 days`.
  - **Reuse of the old token** → 401 `INVALID_REFRESH_TOKEN`. Every token of that `session_id` is revoked, including the successor, while a second session B of the same user still refreshes with 200.
  - **Expired token** (`frozen_clock.advance(7 days + 1 s)`) → 401.
  - **Unknown token** → 401.
  - **Concurrent refresh**: two refreshes with the same token, using `asyncio.gather` on two independent sessions/connections (not the rollback fixture), end with exactly one 200 and one 401, and the session is closed (depends on T029, T030)
- [X] T065 [P] [US3] Create `TESTS/integration/test_logout.py` (FR-012, contracts/http-api.md → `POST /auth/logout`):
  - With an access token and its session's refresh token → 204, and refreshing with that refresh token → 401.
  - A second logout with the same token → 204 (idempotent).
  - Logout with a refresh token of another user → 204, and the other user's token still refreshes.
  - Without an access token → 401.
  - Logout of session A leaves session B active (spec US3 escenario 5) (depends on T029, T030)

### Implementation for User Story 3

- [X] T066 [US3] Extend `APP/modules/auth/repositories.py` `RefreshTokenRepository` (research R3, data-model.md → `refresh_tokens` estados):
  - `get_by_hash_for_update(token_hash) -> RefreshToken | None` (`SELECT … FOR UPDATE`).
  - `mark_rotated(token, successor_id, now)`.
  - `revoke_session(session_id, now)`, which sets `revoked_at = now` on every non-revoked token of that `session_id`.
  - `revoke_all_for_user(user_id, now)`, used by US5 (depends on T042)
- [X] T067 [P] [US3] Add `RefreshRequest(CamelModel)` and `LogoutRequest(CamelModel)` (both `refresh_token: str`, min 1, max 512) to `APP/modules/auth/schemas.py`.
- [X] T068 [US3] Add `refresh(refresh_token) -> TokenPair` and `logout(user, refresh_token) -> None` to `APP/modules/auth/auth_service.py`:
  - **`refresh`**:
    1. `get_by_hash_for_update(sha256_hex(token))`. If the row is missing → `InvalidRefreshTokenError`.
    2. If `replaced_by_id IS NOT NULL` → `revoke_session(row.session_id)`, commit, then raise `InvalidRefreshTokenError`. The revocation must persist even though the request fails.
    3. If `revoked_at IS NOT NULL` or `expires_at <= now` → `InvalidRefreshTokenError`.
    4. Otherwise create the successor in the same `session_id` with `_issue_tokens`, call `mark_rotated` and return it.
  - **`logout`**: look up the row by hash. If it exists and `row.user_id == user.id`, call `revoke_session(row.session_id)`. Always return without error (depends on T066, T067)
- [X] T069 [US3] Add `@public @router.post("/refresh", response_model=TokenPair)` and `@router.post("/logout", status_code=204)` (protected, receives `CurrentUser`) to `APP/modules/auth/auth_controller.py`, each calling only the service. Verify that T064–T065 pass (depends on T068)

**Checkpoint**: varias sesiones simultáneas, rotación y cierre de sesión por dispositivo funcionan.

---

## Phase 6: User Story 4 - Levantar el servidor y su base de datos (Priority: P2)

**Goal**:
- `docker compose up` levanta PostgreSQL y la API.
- Se aplican las migraciones y la seed antes de uvicorn.
- `/health` refleja el estado.
- El compose es compatible con Coolify.

**Independent Test**: desde un entorno vacío (`docker compose down -v`), `docker compose up --build -d` termina con `/health` → `{"status":"ok","database":"ok"}` en menos de 2 min y con todas las tablas creadas (quickstart §1–2).

### Tests for User Story 4 ⚠️

- [X] T070 [P] [US4] Create `TESTS/integration/test_health.py` (contracts/http-api.md → `GET /health`):
  - Without a token → 200 `{"status": "ok", "database": "ok"}`.
  - With `HealthService` overridden so its DB check raises → 503 `{"status": "degraded", "database": "unavailable"}`.
  - The route is marked public (depends on T029)

### Implementation for User Story 4

- [X] T071 [P] [US4] Create `APP/modules/health/health_service.py`: `HealthService(session).check() -> bool` runs `SELECT 1` with `asyncio.wait_for(..., timeout=2)` and returns False on any exception.
- [X] T072 [US4] Create `APP/modules/health/health_controller.py`: `router = APIRouter(tags=["health"])` with `@public @router.get("/health")`, which returns 200 or 503 (`JSONResponse`) depending on `service.check()`. Register it first in `CONTROLLERS`, without the `/api/v1` prefix, and verify that T070 passes (depends on T071)
- [X] T073 [P] [US4] Create `API/Dockerfile`, multi-stage (research R12):
  - **Builder**: `python:3.13-slim` + `COPY --from=ghcr.io/astral-sh/uv /uv /bin/uv`, `uv sync --frozen --no-dev` into `/app/.venv`.
  - **Runtime**: `python:3.13-slim` with the `.venv`, `app/`, `alembic/` and `alembic.ini` copied in, `PATH=/app/.venv/bin:$PATH`, a non-root `app` user, `EXPOSE 8000` and `ENTRYPOINT ["/app/docker-entrypoint.sh"]`.
  - Add `API/.dockerignore` (`.venv`, `tests`, `.env`, caches).
- [X] T074 [P] [US4] Create `API/docker-entrypoint.sh` (`#!/bin/sh`, `set -e`, executable): `python -m app.bootstrap` and then `exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers`. Uvicorn reads `FORWARDED_ALLOW_IPS` from the environment (contracts/configuration.md).
- [X] T075 [US4] Create the root `docker-compose.yml` (contracts/configuration.md → "Docker Compose"):
  - **`db`**: `image: postgres:17-alpine`; env `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` from `${…}`; volume `pgdata:/var/lib/postgresql/data`; healthcheck `pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}` (interval 5 s, retries 10); `restart: unless-stopped`.
  - **`api`**:
    - Build: `context: ./apps/api`.
    - `depends_on: db: condition: service_healthy`, `expose: ["8000"]` with no `ports`.
    - Environment: every variable from configuration.md as `${VAR}` / `${VAR:-default}`.
    - Healthcheck: `python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=3).status == 200 else 1)"`, with `start_period: 60s`.
    - `restart: unless-stopped`.
  - Top-level `volumes: pgdata:` (depends on T073, T074)
- [X] T076 [P] [US4] Create the root `docker-compose.override.yml` (development only): `api` with `ports: ["8000:8000"]`, `env_file: apps/api/.env` and `environment: DOCS_ENABLED: "true"`; `db` with `ports: ["5432:5432"]` and `env_file: apps/api/.env`. Add `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` to `API/.env.example` if T003 omitted them.
- [X] T077 [US4] Validate manually per quickstart.md §1–2:
  - `docker compose down -v && docker compose up --build -d`: the logs show the migrations, "Usuario inicial creado" and uvicorn, all in under 2 min; `/health` → 200; `\dt` lists the 12 tables.
  - `docker compose restart api` logs "Seed omitida".
  - With an empty volume and `INITIAL_USER_PASSWORD` removed, the `api` container exits with an error naming the variable.
  - Record any fixes in the corresponding files (depends on T075, T076)

**Checkpoint**: el servicio completo se levanta con un comando y queda listo para Coolify.

---

## Phase 7: User Story 5 - Recuperar la contraseña olvidada (Priority: P2)

**Goal**: el usuario pide un código de 6 dígitos por correo (Resend), lo valida, recibe un permiso de 10 min y define una contraseña nueva. Al hacerlo se cierran todas sus sesiones y se borran sus bloqueos.

**Independent Test**: con Resend simulado (`respx`):
1. `forgot` → 202 y se envía un correo con el código.
2. `verify` con el código → `resetToken`.
3. `reset` → 204.
4. El login con la contraseña nueva funciona, y los refresh previos responden 401.

### Tests for User Story 5 ⚠️

- [X] T078 [P] [US5] Create `TESTS/unit/test_mail_service.py` (research R7):
  - With `respx`, `ResendMailSender.send_reset_code(to, code)` POSTs to `https://api.resend.com/emails` with `Authorization: Bearer <key>`, a JSON body containing `from == MAIL_FROM`, `to == [to]` and a Spanish subject, and `html`/`text` that contain the code and "30 minutos".
  - An HTTP 500 or a timeout raises `MailDeliveryError`.
  - `is_configured` is False without `RESEND_API_KEY`.
- [X] T079 [P] [US5] Create `TESTS/integration/test_password_reset.py` (spec US5 escenarios 1–8, FR-027–FR-032, SC-009), with Resend mocked and the code captured from the mocked request body:
  - **`forgot`**:
    - An existing email → 202 with the exact message from contracts/http-api.md, and one email sent.
    - An unknown email → identical 202 and body, no email sent.
    - The 4th request within an hour → identical 202, no email, no new row.
    - A second `forgot` invalidates the first code (`invalidated_at` set), and the first code then fails `verify`.
    - Resend not configured or returning 500 → still 202, and the row ends with `invalidated_at` set; the code never appears in `caplog`.
  - **`verify`**:
    - A wrong code → 400 `INVALID_CODE`.
    - After 5 wrong codes the correct one also → 400, with `failed_attempts == 5` and `invalidated_at` set.
    - An expired code (`advance(30 min + 1 s)`) → 400.
    - An unknown email → 400 with an identical body.
    - The correct code → 200 `{resetToken, expiresIn: 600}`; `used_at` set, and reusing the code → 400.
  - **`reset`**:
    - A password of 7 characters → 422, and the grant stays valid.
    - A valid password → 204. The old password → 401, the new one → 200. Every previous `refresh_tokens` row of the user, across 2 sessions, is revoked. The `login_attempts` rows of the email are deleted. `users.updated_at` changes.
    - Reusing the grant → 400 `INVALID_RESET_TOKEN`.
    - An expired grant (`advance(10 min + 1 s)`) → 400 (depends on T029, T030)

### Implementation for User Story 5

- [X] T080 [P] [US5] Create `APP/modules/mail/templates.py` with `reset_code_email(code, display_name) -> tuple[subject, html, text]`, in Spanish:
  - Subject: "Tu código para restablecer la contraseña".
  - Body: the code in large text, "Vence en 30 minutos.", and a note that the message can be ignored if the reset was not requested.
- [X] T081 [US5] Create `APP/modules/mail/mail_service.py` (research R7):
  - A `MailSender` protocol with `is_configured` and `async send_reset_code(to, code, display_name)`.
  - `ResendMailSender(settings, http_client)`, which uses `httpx.AsyncClient(timeout=10)` to POST `https://api.resend.com/emails` with `{"from", "to", "subject", "html", "text"}` and raises `MailDeliveryError` on a non-2xx response or a transport error.
  - `get_mail_sender()` provider. Never log the code or the API key (depends on T080)
- [X] T082 [US5] Add `PasswordResetRepository(session)` to `APP/modules/auth/repositories.py`:
  - `count_since(user_id, since) -> int`.
  - `invalidate_active(user_id, now)`, for rows with `used_at IS NULL AND invalidated_at IS NULL`.
  - `create(user_id, code_hash, expires_at) -> PasswordResetCode`.
  - `latest_active_for_update(user_id, now)`, the most recent row with "`used_at IS NULL AND invalidated_at IS NULL AND expires_at > now`", `FOR UPDATE`.
  - `get_by_grant_hash_for_update(grant_hash)`, `mark_invalidated(id, now)` and `save(row)` (depends on T013)
- [X] T083 [P] [US5] Add the following to `APP/modules/auth/schemas.py`:
  - `ForgotPasswordRequest(email: EmailStr)` and `ForgotPasswordResponse(message: str)`.
  - `VerifyCodeRequest(email: EmailStr, code: str)` with pattern `^\d{6}$`, and `VerifyCodeResponse(reset_token: str, expires_in: int = 600)`.
  - `ResetPasswordRequest(reset_token: str (1–512), new_password: str (8–128))`. A `new_password` length error uses the message "Debe tener entre 8 y 128 caracteres."
- [X] T084 [US5] Create `APP/modules/auth/password_reset_service.py`, class `PasswordResetService(session, users, resets, refresh_tokens, throttle, mail, clock)` (research R6):
  - **`request_reset(email, background_tasks) -> None`**:
    1. Normalize the email and look up the user. If there is no user, or `count_since(user_id, now − 1 h) >= 3`, return.
    2. `invalidate_active`, then `new_reset_code` and `create(code_hash=hash_reset_code(user_id, code), expires_at=now + 30 min)`, then commit.
    3. If `mail.is_configured`, schedule `background_tasks.add_task(self._deliver, row.id, email, code, display_name)`. Otherwise call `mark_invalidated` and log the warning.
  - **`_deliver`**: opens its own session through `async_sessionmaker`, because the request session is closed by then. On `MailDeliveryError` it calls `mark_invalidated(row_id)` and logs the error without the code.
  - **`verify_code(email, code) -> VerifyCodeResponse`**:
    1. Look up the user and `latest_active_for_update`. Missing → `InvalidCodeError`.
    2. If `constant_time_equals(hash_reset_code(user_id, code), row.code_hash)` fails: `failed_attempts += 1`; at 5 set `invalidated_at`; commit, then raise `InvalidCodeError`.
    3. Otherwise set `used_at = now`, `grant = new_opaque_token()`, `grant_hash = sha256_hex(grant)` and `grant_expires_at = now + 10 min`, and return the grant.
  - **`reset_password(reset_token, new_password) -> None`**:
    1. `get_by_grant_hash_for_update`. Raise `InvalidResetTokenError` if it is missing, `grant_used_at` is set, or `grant_expires_at <= now`.
    2. In one transaction: `users.update_password(hash_password(new_password))`, set `grant_used_at = now`, `refresh_tokens.revoke_all_for_user(user_id)` and `throttle.clear_email(email)` (depends on T066, T081, T082, T083)
- [X] T085 [US5] Add `get_password_reset_repository` and `get_password_reset_service` to `APP/modules/auth/dependencies.py` (depends on T084)
- [X] T086 [US5] Add three public routes to `APP/modules/auth/auth_controller.py`, each calling only the service:
  - `@public @router.post("/password/forgot", status_code=202, response_model=ForgotPasswordResponse)`, which receives `BackgroundTasks` and always returns the fixed message "Si el correo está registrado, recibirás un código para restablecer tu contraseña.".
  - `@public @router.post("/password/verify", response_model=VerifyCodeResponse)`.
  - `@public @router.post("/password/reset", status_code=204)`.
  - Verify that T078–T079 and T053 (with the full public set) pass (depends on T085)

**Checkpoint**: las cinco historias funcionan por separado y en conjunto.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: documentación, verificación de secretos en reposo, calidad y validación final.

- [X] T087 [P] Create `TESTS/integration/test_secrets_at_rest.py` (SC-006). After running login, refresh, forgot, verify and reset with known plaintext values (password, refresh token, code, grant):
  - No column of `users`, `refresh_tokens` or `password_reset_codes` contains any of those plaintext values.
  - `password_hash` starts with `$argon2id$`.
  - `caplog`, at DEBUG level, contains none of them.
- [X] T088 [P] Update `docs/db-finanzas.md` with everything marked **(nuevo)** in data-model.md:
  - `users.updated_at`.
  - `refresh_tokens.session_id`, `replaced_by_id` and `created_at`, plus the multi-device paragraph.
  - The `password_reset_codes` and `login_attempts` tables.
  - The composite-FK convention `(user_id, id)` in the "Multiusuario" section.
  - The partial unique index for `categories`.
  - In §2, replace the example list with the set from FR-016: 12 expense and 3 income categories. Keep "al registrarse se crea un set inicial (seed) que puede editar", and clarify that it happens each time a user is registered (today, through the seed of the first deployment).
- [X] T089 [P] Replace the placeholder "Se completará con la feature de backend." under `### API (apps/api)` in `README.md` (FR-025) with:
  - Requirements (Docker, uv).
  - `cp apps/api/.env.example apps/api/.env` and the variables to fill in.
  - `docker compose up --build`.
  - How the automatic seed works: first deploy only, skipped when a user exists, recommendation to remove `INITIAL_USER_PASSWORD` afterwards.
  - Resend variables, `FORWARDED_ALLOW_IPS` for Coolify, and the dev commands table from contracts/configuration.md.
  - A link to `specs/003-backend-jwt-auth/quickstart.md`.
- [X] T090 Run `uv run ruff check . --fix && uv run ruff format .` and `uv run mypy app` in `apps/api`, and fix every reported issue in `APP/` and `TESTS/` until both pass clean.
- [X] T091 Run the full suite `uv run pytest` in `apps/api` and fix any failure. Then validate quickstart.md §3–6 manually against `docker compose up` (§6 needs a real Resend key; if one is not available, note §6 as validated through tests only).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup and blocks all stories. Within the phase:
  - T005 → T010 → T011 → models T012–T021 [P] → T022 → T023 → T024.
  - T025 → T027 → T028 → T029.
- **US1 (Phase 3)**: depends on Foundational.
- **US2 (Phase 4)**: depends on Foundational. T053 also needs the US1 routes registered (T052) to cover them, but it can be written in parallel.
- **US3 (Phase 5)**: depends on US1 (login creates the sessions: T042, T047).
- **US4 (Phase 6)**: depends on US1 (bootstrap T045). The health tasks T070–T072 can start right after Foundational.
- **US5 (Phase 7)**: depends on US1 (users, throttle) and on T066 of US3 (`revoke_all_for_user`).
- **Polish (Phase 8)**: depends on all the stories.

### User Story Dependencies

```
Setup → Foundational ─┬─ US1 (P1) ─┬─ US3 (P2) ─── US5 (P2)
                      │            └─ US4 (P2)
                      └─ US2 (P1)
                                          └──────────── Polish
```

### Within Each User Story

- Tests first; they must fail.
- Repositories and schemas → service → providers → controller → registration in `CONTROLLERS`.
- Controllers only call services (T054 checks this).

### Parallel Opportunities

- **Setup**: T002 and T003, in parallel with T001.
- **Foundational**: T006–T009 in parallel; the 10 models T012–T021 in parallel; T026, T030, T031, T032 and T033 in parallel once their dependencies are ready.
- **US1**: tests T034–T039 in parallel; T040, T041, T042, T043, T046 and T050 in parallel.
- **US2 and US1** can run in parallel after Foundational, by different people.
- **US4**: T073, T074 and T076 in parallel. **US5**: T078–T080 and T083 in parallel.

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo:
Task: "test_seed.py en apps/api/tests/integration/"
Task: "test_bootstrap.py en apps/api/tests/integration/"
Task: "test_login.py en apps/api/tests/integration/"
Task: "test_login_throttle.py en apps/api/tests/integration/"
Task: "test_users_me.py en apps/api/tests/integration/"
Task: "test_no_signup_route.py en apps/api/tests/contract/"

# Piezas independientes de US1 en paralelo:
Task: "DEFAULT_CATEGORIES en apps/api/app/modules/categories/defaults.py"
Task: "UsersRepository en apps/api/app/modules/users/users_repository.py"
Task: "RefreshTokenRepository.create en apps/api/app/modules/auth/repositories.py"
Task: "LoginThrottle en apps/api/app/modules/auth/login_throttle.py"
Task: "LoginRequest/TokenPair en apps/api/app/modules/auth/schemas.py"
```

## Parallel Example: Foundational models

```bash
Task: "User en apps/api/app/db/models/users.py"
Task: "RefreshToken/PasswordResetCode/LoginAttempt en apps/api/app/db/models/auth.py"
Task: "Account en apps/api/app/db/models/accounts.py"
Task: "Category en apps/api/app/db/models/categories.py"
Task: "Transaction en apps/api/app/db/models/transactions.py"
# … y el resto de T014–T021
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 Setup → Phase 2 Foundational. The schema is complete and the guard is active.
2. Phase 3 US1. **Validate**: seed, login and `/users/me`.
3. Phase 4 US2. **Validate**: SC-002 (route sweep) and SC-003 (isolation).
4. This is enough to integrate the client's login against a running local API.

### Incremental Delivery

1. Add US3: sessions per device, refresh and logout. This makes the app usable without logging in every 15 min.
2. Add US4: Docker Compose and Coolify. This makes the first real deployment possible.
3. Add US5: password recovery with Resend.
4. Polish: docs, secrets at rest, lint and types, and the full quickstart.

---

## Notes

- **Total**: 91 tasks.
- **[P]**: different files with no pending dependencies. Tasks that extend the same file, such as `auth/repositories.py`, `auth/schemas.py`, `auth/auth_service.py` and `auth/auth_controller.py`, are sequential across stories.
- **Constraints**: the quoted constraints come verbatim from data-model.md and contracts/. Do not relax them.
- **Commits**: do not commit or push without an explicit request (CLAUDE.md).
