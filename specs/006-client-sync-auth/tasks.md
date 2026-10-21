---
description: "Tareas para la base local, la sincronización y el inicio de sesión en la app"
---

# Tasks: Datos locales reales, sincronización e inicio de sesión en la app

**Input**: Design documents from `/specs/006-client-sync-auth/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: incluidos.
- La constitución exige pruebas automatizadas para la lógica de sincronización y de montos ("Flujo y calidad").
- SC-005 y SC-007 piden resultados verificados en pruebas.
- Las pruebas de cada historia se escriben primero y deben fallar antes de implementar.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: historia de usuario de [spec.md](./spec.md):
  - US1: login y rutas privadas
  - US2: base local y retiro de datos de prueba
  - US3: sincronización
  - US4: estado de la sincronización
  - US5: cerrar sesión
  - US6: renovación y sesión vencida
  - US7: recuperar contraseña

## Path Conventions

- Abreviaturas: `MOB/` = `apps/mobile/`, `SRC/` = `apps/mobile/src/`, `FIN/` = `apps/mobile/src/modules/finance/`.
- **Comandos**: se ejecutan desde `apps/mobile`. Para dependencias se usa `npx expo install`, nunca `npm install` directo (salvo devDependencies que no son de Expo).
- **Expo cambia en cada SDK** (`MOB/AGENTS.md`): antes de usar una API de Expo, consultar `https://docs.expo.dev/versions/v58.0.0/`.
- **Convenciones del código existente**, que se mantienen:
  - las pantallas solo importan hooks (regla `no-restricted-imports` de `MOB/eslint.config.js`);
  - todos los montos pasan por `SRC/lib/money.ts` (`Cents`);
  - fechas con `SRC/lib/dates.ts` (`nowUtc()` = ISO UTC con milisegundos);
  - UI con los componentes de `SRC/components/ui` y tokens de `SRC/theme`;
  - comentarios y textos en español, identificadores en inglés;
  - pruebas `*.test.ts(x)` junto al código.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencias y configuración de build/web (research R1, R5, R7, R16, R17).

- [ ] T001 Add the new dependencies:
  - `npx expo install expo-sqlite expo-secure-store expo-network expo-build-properties`
  - `npm install --save-dev better-sqlite3 @types/better-sqlite3`

  Verify `MOB/package.json` lists them, and that `npx expo install --check` reports no incompatibilities.
- [ ] T002 Create `MOB/metro.config.js` with `npx expo customize metro.config.js`. Then (research R1):
  - add `'wasm'` to `config.resolver.assetExts`;
  - add a `config.server.enhanceMiddleware` that sets `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Opener-Policy: same-origin` on every dev-server response.

  Take the exact snippet from the SDK 58 `expo-sqlite` web setup guide.
- [ ] T003 Replace `MOB/app.json` with `MOB/app.config.ts`, keeping every existing field. Then:
  - add the plugins `"expo-sqlite"` and `["expo-secure-store", { "configureAndroidBackup": true }]`;
  - add `["expo-build-properties", { "android": { "usesCleartextTraffic": true } }]` **only when** `process.env.APP_VARIANT === 'development'` (research R17);
  - add the COOP/COEP headers to the `expo-router` plugin `headers` option for web hosting, as documented for SDK 58.
- [ ] T004 [P] In `MOB/eas.json`, set `"env": { "APP_VARIANT": "development" }` on the `development` build profile.
- [ ] T005 [P] Create `MOB/.env.example` containing `EXPO_PUBLIC_API_URL=http://192.168.1.10:8000/api/v1`, with a comment explaining it (LAN IP for Android, `http://localhost:8000/api/v1` for web). Ensure `.env` is ignored in `MOB/.gitignore`.
- [ ] T006 [P] Create `SRC/config/env.ts`, which exports `apiBaseUrl`. It reads `process.env.EXPO_PUBLIC_API_URL`, strips any trailing `/`, and throws a clear Spanish error at import time if the value is missing or not an `http(s)` URL.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: base local, descripción de tablas y cliente HTTP. Los usan todas las historias.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta terminar esta fase, incluido el checkpoint de SQLite en web.

### Base local

- [ ] T007 [P] Create `SRC/db/types.ts` with the `SqlDatabase` interface from [contracts/client-modules.md](./contracts/client-modules.md):
  - methods: `execAsync`, `runAsync` → `{ changes }`, `getAllAsync<T>`, `getFirstAsync<T>`, `withTransactionAsync`;
  - `type SqlParams = (string | number | null)[] | Record<string, string | number | null>`.
- [ ] T008 [P] Create `SRC/sync/tables.ts`, the single declarative description of the 8 synced tables ([data-model.md](./data-model.md) §2–§3). Exports:
  - `SYNC_TABLES`: in dependency order `categories`, `reimbursement_groups`, `assets`, `accounts`, `subscriptions`, `recurring_incomes`, `cdts`, `transactions`;
  - `type SyncTable`;
  - `tableToEntity`: maps `reimbursement_groups` → `reimbursementGroups`, `recurring_incomes` → `recurringIncomes`, others identical; keys of `FinanceData`;
  - for each table, its data `columns`. Each column has `{ column: snake_case, field: camelCase, kind }` with `kind ∈ 'text' | 'int' | 'bool' | 'money' | 'rate' | 'date' | 'datetime'`. Exactly as listed in data-model §2:
    - money: `assets.value`, `accounts.opening_balance`, `accounts.credit_limit`, `subscriptions.amount`, `recurring_incomes.expected_amount`, `cdts.principal`, `transactions.amount`;
    - rate: `cdts.annual_rate_ea`, `cdts.annual_rate_nominal`, `cdts.withholding_rate`;
    - bool: `accounts.is_excluded_from_net_worth`, `accounts.is_archived`;
  - `SYNC_COLUMNS`: `id`, `created_at`, `updated_at`, `deleted_at` (mapped to `SyncFields`) plus `server_updated_at` and `is_dirty`, which are not in the domain types;
  - `REFERENCES`: from data-model §3, e.g. `transactions.cdt_id → cdts`.
- [ ] T009 Create `SRC/db/schema.ts` with `MIGRATIONS: string[]`. Migration 1 creates (data-model §1, §2, §4):
  - **the 8 tables**, generated from `SRC/sync/tables.ts`:
    - `id TEXT PRIMARY KEY`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`, `deleted_at TEXT NULL`;
    - data columns: `money`/`int`/`bool` → `INTEGER`; `text`/`rate`/`date`/`datetime` → `TEXT`;
    - `server_updated_at TEXT NULL`, `is_dirty INTEGER NOT NULL DEFAULT 0`;
    - **no `user_id`, no `FOREIGN KEY`, no `REAL`**;
  - `CREATE INDEX idx_<table>_dirty ON <table>(id) WHERE is_dirty = 1` per table;
  - `sync_metadata(table_name TEXT PRIMARY KEY, pull_cursor TEXT NULL, last_synced_at TEXT NULL)`, plus one `INSERT` row per synced table;
  - `sync_rejections`, with:
    - columns `table_name TEXT NOT NULL`, `record_id TEXT NOT NULL`, `code TEXT NOT NULL`, `message TEXT NOT NULL`, `sent_updated_at TEXT NULL`, `rejected_at TEXT NOT NULL`;
    - `PRIMARY KEY (table_name, record_id)`.

  Also export `migrate(db: SqlDatabase)`. It reads `PRAGMA user_version`, runs each pending migration inside `withTransactionAsync`, and sets `PRAGMA user_version = n` after each one.
- [ ] T010 [P] Create the test adapter `SRC/db/testing/betterSqlite.ts`, `createTestDb(): SqlDatabase`. It wraps an in-memory `better-sqlite3` database:
  - async wrappers;
  - `withTransactionAsync` runs `BEGIN` / `COMMIT` / `ROLLBACK`;
  - named and positional params are supported.
- [ ] T011 [P] Tests in `SRC/db/schema.test.ts`, using `createTestDb`:
  - `migrate` creates the 10 tables and 8 `sync_metadata` rows, and sets `user_version = MIGRATIONS.length`;
  - running `migrate` twice is a no-op;
  - no table has a `user_id` column (`PRAGMA table_info`);
  - money columns are `INTEGER`.
- [ ] T012 Create `SRC/db/writeLock.ts` (research R3):
  - a FIFO async mutex;
  - `withWriteLock(task)`: acquires the mutex, runs `db.withTransactionAsync(() => task(db))` and releases even on error;
  - `withReadLock(task)`: same mutex, no transaction;
  - `setLockedDb(db)`: registers the open database.

  Document in a comment that the lock must never be held across a network request.
- [ ] T013 [P] Tests in `SRC/db/writeLock.test.ts`:
  - two concurrent `withWriteLock` calls run sequentially;
  - a throwing task rolls back its writes and releases the lock;
  - order is FIFO.
- [ ] T014 Create `SRC/db/openLocalDb.ts`. `openLocalDb()` calls `SQLite.openDatabaseAsync('bermudeztech.db')`, runs `migrate`, calls `setLockedDb` and returns the db. It also exports `getDb()`, which throws if the db is not open yet.
- [ ] T015 Create `SRC/db/rows.ts`, with pure converters driven by `SRC/sync/tables.ts`:
  - `rowToEntity(table, row)`: SQLite row → domain type; `bool` 0/1 → boolean; money stays an integer `Cents` via `cents()`; drops `server_updated_at` and `is_dirty`;
  - `entityToRow(table, entity)`: domain → column/value map.
- [ ] T016 [P] Tests in `SRC/db/rows.test.ts`: round-trip for one record of each of the 8 tables, built with `FIN/domain/testUtils.ts` factories. Money stays identical (`10`, `20`, `99_999_999_999_999` cents), and booleans and nulls are preserved.
- [ ] T017 [P] Create `SRC/db/localChanges.ts`, a tiny event bus with `emitLocalChange()` and `onLocalChange(listener) → unsubscribe`. Repositories emit and the sync scheduler listens, so neither imports the other.

### Cliente HTTP

- [ ] T018 [P] Create `SRC/api/errors.ts` ([contracts/api-usage.md](./contracts/api-usage.md)):
  - `NetworkError`;
  - `ApiError` with `status`, `code`, `message`, `details?` and `retryAfter?`, plus `isApiError(e, code?)`;
  - `parseErrorResponse(res)`: reads the common envelope `{ error: { code, message, details } }` and the `Retry-After` header; 5xx or a non-JSON body → `ApiError(status, 'SERVER_ERROR')`.
- [ ] T019 Create `SRC/api/client.ts` (research R6):
  - `createApiClient({ baseUrl, fetch, tokens, now })`, where `tokens: TokenProvider = { get(): StoredSession | null; save(s): Promise<void>; onRefreshRejected(): void }`;
  - `request<T>(method, path, { body, auth = true })`:
    - JSON body and 20 s timeout via `AbortController`;
    - `fetch` failure or abort → `NetworkError`;
    - `auth` → `Authorization: Bearer`; if the access token expires in < 30 s, refresh first;
    - on `401 UNAUTHENTICATED`, refresh once and retry once;
  - **single-flight refresh**: one shared promise for `POST /auth/refresh` with `{ refreshToken }`;
    - success → `tokens.save()` with `accessExpiresAt = now + expiresIn`, `refreshExpiresAt = now + refreshExpiresIn`;
    - `401 INVALID_REFRESH_TOKEN` → `tokens.onRefreshRejected()`, and throw `ApiError` with code `SESSION_EXPIRED`;
    - `NetworkError` → rethrow without expiring.

  Export a module-level `api`, configured with `apiBaseUrl` and a `TokenProvider` registered later via `setTokenProvider()`.
- [ ] T020 [P] Tests in `SRC/api/client.test.ts`, with a fake `fetch` and clock:
  - 3 concurrent requests with an expired access token trigger exactly 1 refresh;
  - `401 UNAUTHENTICATED` → refresh → retry succeeds;
  - a refresh returning `INVALID_REFRESH_TOKEN` calls `onRefreshRejected` once and throws `SESSION_EXPIRED`;
  - a network error during refresh throws `NetworkError` and does **not** call `onRefreshRejected`;
  - `429` exposes `retryAfter`;
  - a timeout throws `NetworkError`.

### Checkpoint SQLite en web

- [ ] T021 **GATE (Constitución VI, research R1, quickstart §0)**: temporarily call `openLocalDb()` from `SRC/app/_layout.tsx`, write and read back a row in `sync_metadata`, and run `npm run web` in Chrome and Firefox. Confirm all of the following:
  - no WASM or `SharedArrayBuffer` errors;
  - the COOP/COEP headers are present;
  - the value survives a page reload.

  Also run on the Android dev build. Remove the temporary code afterwards. **If it fails, stop and revise research R1 before continuing.**

**Checkpoint**: base local y cliente HTTP listos; las historias pueden empezar.

---

## Phase 3: User Story 1 - Iniciar sesión y acceder solo con sesión (Priority: P1) 🎯 MVP

**Goal**: login con correo y contraseña, sesión persistente (también offline) y todas las pantallas actuales privadas.

**Independent Test**: sin sesión, cualquier ruta (incluido un enlace directo a `/finance/accounts`) lleva a `/login`. Al iniciar sesión con el usuario de la seed se llega a la ruta pedida y se ve el nombre real. Cerrar y reabrir la app en modo avión deja al usuario dentro (quickstart §1).

### Tests for User Story 1 ⚠️

- [ ] T022 [P] [US1] Tests in `SRC/session/sessionService.test.ts`, with fake `api` and fake `tokenStorage`:
  - `signIn` OK calls `POST /auth/login` then `GET /users/me`, saves `bt.session` and `bt.profile`, and sets `status = 'signedIn'`;
  - `INVALID_CREDENTIALS` → returns a typed error and stores nothing;
  - if `/users/me` fails twice after a successful login, the session is cleared and an error is returned;
  - `restoreSession` with stored data → `signedIn` without any network call; with nothing stored → `signedOut`.
- [ ] T023 [P] [US1] Routing tests in `SRC/session/routing.test.tsx`, using `renderRouter` from `expo-router/testing-library` with a mock route tree that mirrors [contracts/navigation.md](./contracts/navigation.md):
  - N2: signed out, opening `/finance/accounts` renders `/login`;
  - N3: after `signIn`, it lands on the pending route;
  - N4: signed in, `/login` redirects to `/`;
  - N6: sign-out clears the private history;
  - N1: while `loading`, nothing renders.
- [ ] T024 [P] [US1] Tests in `SRC/session/messages.test.ts`: `loginErrorMessage` maps each case to the exact message in [contracts/api-usage.md](./contracts/api-usage.md):
  - `INVALID_CREDENTIALS`;
  - `TOO_MANY_ATTEMPTS` with `retryAfter=600` → "… en 10 minutos.";
  - `NetworkError`;
  - `SERVER_ERROR`.

### Implementation for User Story 1

- [ ] T025 [P] [US1] Create `SRC/session/types.ts` with `StoredSession` and `StoredProfile`, exactly as in [data-model.md](./data-model.md) §5.
- [ ] T026 [P] [US1] Create `SRC/session/tokenStorage.ts` (Android) with `load(): Promise<{ session, profile }>`, `saveSession(s)`, `saveProfile(p)` and `clear()` (research R5):
  - uses `expo-secure-store` with keys `bt.session` and `bt.profile`, stored as JSON;
  - keeps an in-memory copy, so that `TokenProvider.get()` stays synchronous.
- [ ] T027 [P] [US1] Create `SRC/session/tokenStorage.web.ts`, with the same API on `window.localStorage` and the same keys. Wrap every access in `try/catch`; if storage is unavailable, throw `StorageUnavailableError` (Edge case "Credenciales en web").
- [ ] T028 [US1] Create `SRC/session/sessionStore.ts`: a zustand store with `status: 'loading' | 'signedOut' | 'signedIn'`, `expired: boolean` and `profile: StoredProfile | null` (data-model §6).
- [ ] T029 [US1] Create `SRC/session/sessionService.ts`:
  - `restoreSession()`: loads tokenStorage, registers the `TokenProvider` in `SRC/api/client.ts` (`onRefreshRejected` sets `expired = true`) and sets the status;
  - `signIn(email, password)`:
    - `POST /auth/login` with `auth: false`;
    - save the session;
    - `GET /users/me`, retried once;
    - save the profile and set `signedIn`.

  The owner-mismatch branch is added in US6.
- [ ] T030 [P] [US1] Create `SRC/session/messages.ts` with `loginErrorMessage(error)`, using the texts from [contracts/api-usage.md](./contracts/api-usage.md) (minutes = `ceil(retryAfter / 60)`).
- [ ] T031 [P] [US1] Create `SRC/session/hooks.ts`:
  - `useSession()` → `{ status, expired, profile }`;
  - `useDisplayName()` → `profile.displayName ?? profile.email`.
- [ ] T032 [P] [US1] Create `SRC/session/pendingRoute.ts` (research R11). `captureInitialRoute()`:
  - reads `Linking.getInitialURL()` on native, or `window.location.pathname + search` on web;
  - stores the value in memory only when it is not a public route (`/login`, `/forgot-password`, `/verify-code`, `/reset-password`) and not `/`.

  `takePendingRoute()` returns the stored route and clears it.
- [ ] T033 [US1] Move the private screens: `git mv "MOB/src/app/(tabs)" "MOB/src/app/(app)/(tabs)"`. Then create `SRC/app/(app)/_layout.tsx`, a `Stack` with `headerShown: false` and screen `(tabs)`. Check that no `href` in the code contains the group names: URLs must stay unchanged. Update the `testPathIgnorePatterns` and ESLint globs if they reference the old path.
- [ ] T034 [US1] Create `SRC/app/(auth)/_layout.tsx`, a `Stack` with no header that uses `ScreenBackground`.
- [ ] T035 [US1] Create `SRC/app/(auth)/login.tsx` ([contracts/navigation.md](./contracts/navigation.md)):
  - layout: app logo, `TextField` for email, password field with show/hide, primary `Button` "Iniciar sesión" with a loading state, and a link "¿Olvidaste tu contraseña?" to `/forgot-password`;
  - validation (zod + react-hook-form): valid email; password 1–128 characters;
  - accepts an `?email=` param to prefill the email;
  - on error, shows `loginErrorMessage` and keeps the email;
  - on success: `router.replace(takePendingRoute() ?? '/')`;
  - styled with theme tokens, light and dark.
- [ ] T036 [US1] Rewrite `SRC/app/_layout.tsx`. It keeps the splash until fonts are loaded **and** `restoreSession()` has resolved (FR-038), and calls `captureInitialRoute()` before restoring. Then it renders:
  - `<Stack.Protected guard={status === 'signedIn'} redirectTo="/login">` wrapping `(app)`;
  - `<Stack.Protected guard={status !== 'signedIn'}>` wrapping `(auth)`;
  - `+not-found`, which stays public.

  While `status === 'loading'`, render `null`.
- [ ] T037 [US1] Replace the mock user. In `SRC/app/(app)/(tabs)/index.tsx`, the greeting uses `useDisplayName()`. In `SRC/app/(app)/(tabs)/settings.tsx`, the profile card shows `displayName` and `email` and drops the text "Usuario de prueba · sin inicio de sesión". Delete `SRC/session/mockUser.ts`.

**Checkpoint**: US1 funcional; quickstart §1 pasa.

---

## Phase 4: User Story 2 - Mis datos se guardan en el dispositivo (Priority: P1)

**Goal**: los repositorios escriben en SQLite (con `is_dirty = 1`) y el store pasa a ser un espejo hidratado. No quedan datos de prueba.

**Independent Test**: en modo avión, crear una cuenta (saldo `0.10`) y una transacción (`0.20`), cerrar la app y reabrirla. Ambas siguen ahí, el saldo es `0,30` y no hay ningún dato de prueba (quickstart §3).

### Tests for User Story 2 ⚠️

- [ ] T038 [P] [US2] Tests in `FIN/data/local/persistence.test.ts`, with `createTestDb` + `migrate` and the real repositories:
  - `createAccount` writes a row with `is_dirty = 1`, equal `created_at`/`updated_at` and `server_updated_at` NULL;
  - `updateAccount` bumps `updated_at` and keeps `is_dirty = 1`;
  - `deleteTransaction` sets `deleted_at`, keeps the row and sets `is_dirty = 1`, and the item disappears from `activeList`;
  - after resetting the store and calling `hydrate(db)`, the mirror equals the DB content;
  - money round-trips exactly: `10` and `20` cents sum to `30`.
- [ ] T039 [P] [US2] Tests in `FIN/data/local/atomicity.test.ts`:
  - a multi-record write that throws midway (inject a failing `runAsync`) leaves both the DB and the mirror unchanged (FR-011);
  - validation errors (`SAME_ACCOUNT`, `AMOUNT_INVALID`, `CATEGORY_KIND_MISMATCH`) write nothing.

### Implementation for User Story 2

- [ ] T040 [US2] Rename the data folder: `git mv FIN/data/inMemory FIN/data/local`. Update every import in `FIN/hooks/*.ts`, and update the ESLint `no-restricted-imports` pattern in `MOB/eslint.config.js` to `'@/modules/finance/data/local/*'`, keeping the message.
- [ ] T041 [US2] Rewrite `FIN/data/local/store.ts` as a mirror (research R2):
  - remove `buildSeed`, `SeedMode`, `seedMode` and `resetMockData`; the initial state is 8 empty records;
  - add `hydrate(db)`: one `SELECT * FROM <table>` per table, `rowToEntity`, then a single `setState`;
  - add `clearMirror()`;
  - add `applyRows(entity, records)` for the sync engine;
  - make `insert`, `patch`, `softDelete` and `batch` `async`. Each runs `withWriteLock` (writes rows via `entityToRow` with `is_dirty = 1`, using `INSERT … ON CONFLICT(id) DO UPDATE`), then `setState` only after the transaction commits, then `emitLocalChange()`;
  - `batch`: collect the changed records from the draft and persist them all in the same transaction.

  Keep `getEntity` and `activeList` unchanged.
- [ ] T042 [P] [US2] Update `FIN/data/local/accountsRepo.ts` to `await` the now-async `insert`/`patch`/`softDelete`/`batch`. Validation logic and errors stay unchanged.
- [ ] T043 [P] [US2] Same `await` update in `FIN/data/local/transactionsRepo.ts`.
- [ ] T044 [P] [US2] Same `await` update in `FIN/data/local/subscriptionsRepo.ts`.
- [ ] T045 [P] [US2] Same `await` update in `FIN/data/local/recurringIncomesRepo.ts`.
- [ ] T046 [P] [US2] Same `await` update in `FIN/data/local/reimbursementsRepo.ts`.
- [ ] T047 [P] [US2] Same `await` update in `FIN/data/local/cdtsRepo.ts`. The CDT and its INVESTMENT account must be created in one `batch` transaction.
- [ ] T048 [P] [US2] Same `await` update in `FIN/data/local/assetsRepo.ts`.
- [ ] T049 [US2] Remove the mock data:
  - delete `FIN/data/mock/` (`seed.ts`, `seed.test.ts`), `FIN/hooks/useMockData.ts`, and `seededId` from `SRC/lib/ids.ts`;
  - in `SRC/app/(app)/(tabs)/settings.tsx`, delete the "datos de prueba" section and its imports.

  Run `grep -rn "mock\|seed" SRC` and make sure nothing related remains (SC-010).
- [ ] T050 [US2] Open the database and hydrate at boot. In `SRC/app/_layout.tsx`, after `restoreSession()`, when `status === 'signedIn'`, call `openLocalDb()` and then `hydrate(getDb())`, both before hiding the splash. Opening the DB on sign-in is wired in US3 (T066).
- [ ] T051 [P] [US2] Create `SRC/db/webTabLock.web.ts` and a native no-op `SRC/db/webTabLock.ts` (research R4):
  - `acquireTabLock(): Promise<boolean>` uses `navigator.locks.request('bermudeztech-db', { ifAvailable: true }, …)` and holds the lock with a never-resolving promise;
  - also call `navigator.storage?.persist?.()`.
- [ ] T052 [US2] In `SRC/app/_layout.tsx`, call `acquireTabLock()` before opening the DB. If it returns `false`, render a `Screen` with the message "BermudezTechOS ya está abierto en otra pestaña." and a "Reintentar" `Button` that retries (navigation rule N7).
- [ ] T053 [US2] Check empty states with an empty database (no categories until the first sync), and fix any crash or misleading UI:
  - Inicio, Finanzas › Cuentas, Movimientos, Gastos, Suscripciones, Ingresos recurrentes, Reembolsos, Inversiones and Patrimonio;
  - the transaction/subscription/recurring-income forms when the category list is empty: the category stays optional and no crash occurs.

**Checkpoint**: US2 funcional sin red; quickstart §3 pasa.

---

## Phase 5: User Story 3 - Sincronizar con el servidor (Priority: P1)

**Goal**: ciclo PUSH → PULL idempotente con las rutas de la spec 004, disparado automáticamente.

**Independent Test**: dos clientes (Android y web) del mismo usuario. Un cambio hecho sin red en uno aparece en el otro tras reconectar. Una reinstalación recupera todo. Los montos `0.10 + 0.20` llegan exactos (quickstart §2, §4).

### Tests for User Story 3 ⚠️

- [ ] T054 [P] [US3] Tests in `SRC/lib/money.test.ts` (extend the existing file):
  - `toMoneyString`: `10` → `"0.10"`, `123456` → `"1234.56"`, `0` → `"0.00"`;
  - `fromMoneyString`: `"0.10"` → `10`, `"1234.5"` → `123450`, `"999999999999.99"` → `99_999_999_999_999`;
  - `fromMoneyString` throws on `"1.234"`, `"-1.00"`, `"1e3"`, `""`, `"abc"` and values above `MAX_CENTS`.
- [ ] T055 [P] [US3] Tests in `SRC/sync/mappers.test.ts`:
  - `toWire`/`fromWire` round-trip for each of the 8 tables;
  - `serverUpdatedAt` is read from wire into `server_updated_at`; `userId` and `isDirty` are never emitted;
  - rates pass through as strings untouched (`"10.2500"`);
  - `fromWire` throws `ParseError` on a bad money string or a missing required field.
- [ ] T056 [P] [US3] Create the fake server `SRC/sync/testing/fakeSyncServer.ts`. It implements `POST /sync/push` and `POST /sync/pull` in memory, as in `specs/004-data-sync/contracts/http-api.md`:
  - **push**: LWW on `updatedAt` (strictly greater wins), result per record (`APPLIED` / `DISCARDED` / `REJECTED`), 500-record limit → 413;
  - **pull**: monotonically increasing `serverUpdatedAt`, opaque base64 cursor `{t, id}`, page limit configurable (default 1000) across tables in dependency order, `hasMore` per table and in total;
  - hooks to force a `REJECTED` code for a given id, network failures, or a `422 INVALID_CURSOR`.
- [ ] T057 [P] [US3] Tests in `SRC/sync/syncEngine.test.ts`, with `createTestDb`, the fake server and `syncEngine`:
  - (a) First sync with 15 server categories: all applied, cursors saved, `last_synced_at` set for all 8 tables.
  - (b) Local dirty account + transaction → both `APPLIED` → `is_dirty = 0`, and both present on the server.
  - (c) A record edited locally between the push read and the ack keeps `is_dirty = 1` (FR-014).
  - (d) `DISCARDED` → `is_dirty = 0` and that table's `pull_cursor` reset to NULL; the next pull brings the server version.
  - (e) `REJECTED` → stays dirty, and a `sync_rejections` row exists with `code` and `message`; other records still apply.
  - (f) Pull of a newer server version over a non-dirty local row → overwritten. Over a dirty local row with an older `updatedAt` → local kept. With a newer one → overwritten, `is_dirty = 0` and the rejection removed (FR-017).
  - (g) Pagination with page size 3 and 10 records → all applied, no duplicates.
  - (h) Interrupt (throw) after each step and rerun 1–5 times: identical final DB and server state, 0 duplicates (SC-005).
  - (i) 1,200 dirty records → push split into chunks ≤ 500, parents before children; `413` → chunk halved and retried.
  - (j) `422 INVALID_CURSOR` for `accounts` → cursor reset and that table fully re-pulled.
  - (k) A malformed money value in a pulled record → record skipped, `LOCAL_PARSE_ERROR` rejection stored, rest of the page applied.
  - (l) Device A and device B (two test DBs) edit the same account offline at 10:00 and 10:05, then sync in either order → both end with the 10:05 version (US3 / spec 004 US3).
  - (m) Amounts `0.10` and `0.20` pushed from A and pulled on B sum to exactly `30` cents (SC-007).
- [ ] T058 [P] [US3] Tests in `SRC/sync/syncScheduler.test.ts`, with Jest fake timers and fake AppState/network:
  - several `emitLocalChange()` within 5 s → exactly one `run()`;
  - a 5-minute interval runs only while active;
  - offline → online triggers `run()`;
  - background cancels the timers;
  - triggers while offline do nothing (FR-022);
  - a `run()` requested during a running cycle triggers exactly one extra run (FR-020).

### Implementation for User Story 3

- [ ] T059 [P] [US3] Add `toMoneyString(c: Cents): string` and `fromMoneyString(s: string): Cents` to `SRC/lib/money.ts` (research R15):
  - pure string arithmetic; never `parseFloat` or `Number()` on the decimal string;
  - accepted pattern `^\d{1,12}(\.\d{1,2})?$`;
  - result capped by `MAX_CENTS`.
- [ ] T060 [P] [US3] Create `SRC/sync/mappers.ts`, generic over `SRC/sync/tables.ts` (research R15):
  - `toWire(table, row)`: camelCase keys; money via `toMoneyString`; bools as booleans; omits `server_updated_at` and `is_dirty`;
  - `fromWire(table, json)`: validates field presence and types and returns a DB row with `is_dirty = 0` and `server_updated_at` from `serverUpdatedAt`; throws `ParseError(table, id, message)`.
- [ ] T061 [P] [US3] Create `SRC/sync/syncStore.ts`, the zustand store from [data-model.md](./data-model.md) §6: `phase`, `connectivity`, `lastSyncedAt`, `initialSyncComplete`, `pendingCount`, `rejections`, `lastError` and `clockAhead`. Also add `refreshCounters(db)`:
  - `pendingCount` = Σ `SELECT COUNT(*) … WHERE is_dirty = 1` over all 8 tables;
  - `rejections` = all rows of `sync_rejections`;
  - `lastSyncedAt` = max of `sync_metadata.last_synced_at`;
  - `initialSyncComplete` = all 8 rows have `last_synced_at`;
  - `clockAhead` = any rejection with `CLOCK_AHEAD`.
- [ ] T062 [P] [US3] Create `SRC/sync/connectivity.ts` with `expo-network` (research R7):
  - `isOnline()` and `onConnectivityChange(cb) → unsubscribe`, using `addNetworkStateListener`;
  - online = `isConnected && isInternetReachable !== false`;
  - updates `syncStore.connectivity`.
- [ ] T063 [US3] Create `SRC/sync/syncEngine.ts` (research R8, [contracts/client-modules.md](./contracts/client-modules.md)). `createSyncEngine({ db, api, now, applyToMirror })` returns `run(): Promise<SyncOutcome>`.
  - **Guards and concurrency**: skip when offline, signed out or `expired`; single-flight with `rerunRequested`.
  - **PUSH**:
    - read dirty rows under `withReadLock`, sorted by `SYNC_TABLES` order, with `accounts` parents first and `cdts` `renewed_from_cdt_id` first;
    - remember `id → updated_at`;
    - send chunks of ≤ 500 outside the lock; on `413`, halve the chunk.
  - **Apply push results** with `withWriteLock` per chunk:
    - `APPLIED` / `DISCARDED` → `UPDATE … SET is_dirty = 0 WHERE id = ? AND updated_at = ?` and delete the rejection;
    - `DISCARDED` also sets `pull_cursor = NULL`;
    - `REJECTED` → upsert into `sync_rejections`.
  - **PULL**:
    - loop while the total `hasMore` is true;
    - apply each page with `withWriteLock` using the FR-017 rule;
    - `ParseError` → `LOCAL_PARSE_ERROR` rejection, skip the record;
    - when a table reports `hasMore = false`, persist its cursor and `last_synced_at` in the same transaction;
    - `422 INVALID_CURSOR` → reset that table and retry.
  - **After each transaction**: `applyToMirror` with the affected entities (via `rowToEntity` → `applyRows`), then `syncStore.refreshCounters`.
  - **Errors**: `NetworkError` → `{ kind: 'failed', error: 'network' }`, `connectivity = offline`; `SESSION_EXPIRED` → `'session'`; others → `'server'` with `lastError`.

  The HTTP lock rule from research R3 applies throughout.
- [ ] T064 [US3] Create `SRC/sync/syncScheduler.ts` (research R14):
  - `start()`: subscribes to `AppState` (`active` → run; `background` → clear timers), to `onConnectivityChange` (offline → online → run) and to `onLocalChange` (5 s debounce); starts a 5-minute interval while active; runs once immediately;
  - `stop()`: unsubscribes everything;
  - `syncNow()`;
  - dependencies are injectable for tests.
- [ ] T065 [US3] Create `SRC/sync/index.ts`, which wires a singleton engine and scheduler to `getDb()`, `api` and the finance mirror (`applyRows`). Export `startSync()`, `stopSync()` and `syncNow()`.
- [ ] T066 [US3] In `SRC/app/(app)/_layout.tsx`, on mount: ensure the DB is open and hydrated (needed after a fresh `signIn`, which happens after boot), then `startSync()`; on unmount, `stopSync()`. With an empty local DB, this first run is the initial sync (FR-025).
- [ ] T067 [US3] On Inicio (`SRC/app/(app)/(tabs)/index.tsx`), show a non-blocking `GlassCard` with an activity indicator and the text "Descargando tus datos…" while `initialSyncComplete === false` (FR-025). If the last run failed, show "La descarga no terminó; se reintentará automáticamente."

**Checkpoint**: US1 + US2 + US3 = MVP completo; quickstart §2–§4 pasan.

---

## Phase 6: User Story 4 - Ver el estado de la sincronización (Priority: P2)

**Goal**: Ajustes muestra estado, último sync, pendientes, rechazos con motivo, "Sincronizar ahora" y "Descartar mi cambio".

**Independent Test**: en modo avión, 3 cambios → "3 cambios pendientes". Con red, "Sincronizar ahora" → 0 pendientes. Un rechazo `CLOCK_AHEAD` muestra el aviso de fecha. "Descartar mi cambio" restaura la versión del servidor (quickstart §5).

### Tests for User Story 4 ⚠️

- [ ] T068 [P] [US4] Tests in `SRC/sync/discard.test.ts`, with `createTestDb` and the fake server (research R10):
  - discarding a rejected record that has `server_updated_at` → `is_dirty = 0`, rejection removed, table cursor NULL; after `run()`, the server version is restored;
  - discarding a never-synced account with 2 dirty transactions referencing it → `countDependents = 2`; after discard, all 3 rows are physically deleted along with their rejections, and the mirror is updated;
  - transitive dependents are included (account → cdt → transaction).
- [ ] T069 [P] [US4] Tests in `SRC/sync/status.test.ts`:
  - `deriveSyncStatus` priority: syncing › session expired › offline › with errors › synced (data-model §6);
  - `rejectionMessage(code, message)` returns the exact texts of [contracts/api-usage.md](./contracts/api-usage.md).

### Implementation for User Story 4

- [ ] T070 [P] [US4] Create `SRC/sync/status.ts` with:
  - `deriveSyncStatus(syncState, session)` → `'syncing' | 'expired' | 'offline' | 'errors' | 'synced'`, with Spanish labels;
  - `rejectionMessage(code, message)`;
  - `describeRecord(table, entity)`: readable label such as "Cuenta «Nequi»", "Categoría «Ropa»" or "Movimiento de $45.000 del 18 oct" via `formatCop` / `formatDateLocal`.
- [ ] T071 [US4] Create `SRC/sync/discard.ts` with:
  - `countDependents(table, id)`: transitive walk of `REFERENCES` over dirty rows only;
  - `discardLocalChange(table, id)`: research R10, under `withWriteLock`, updating the mirror (remove deleted entities) and `refreshCounters`.
- [ ] T072 [P] [US4] Create `SRC/sync/hooks.ts` with:
  - `useSyncStatus()` → `{ status, label, lastSyncedAt, pendingCount, clockAhead }`;
  - `useSyncRejections()`, which joins rejections with the mirror for `describeRecord`;
  - `useSyncNow()` → `{ syncNow, running }`.
- [ ] T073 [P] [US4] Create `SRC/components/sync/SyncStatusCard.tsx`, a `GlassCard` with:
  - a status `Badge`;
  - "Último sync: {relative time or 'nunca'}";
  - "{n} cambios pendientes";
  - a "Sincronizar ahora" `Button`, disabled while syncing or offline;
  - a highlighted warning when `clockAhead`: "La fecha de tu dispositivo está adelantada. Revisa la fecha y hora." (FR-024).
- [ ] T074 [P] [US4] Create `SRC/components/sync/RejectionList.tsx`:
  - a `ListItem` per rejection showing `describeRecord` and `rejectionMessage`;
  - a "Descartar mi cambio" action that first calls `countDependents`, then `confirm()`: "Se restaurará la versión del servidor." or, for new records, "Se eliminará este registro y {n} cambios que dependen de él.";
  - on confirm, `discardLocalChange`, then `syncNow()`.
- [ ] T075 [US4] Add a "Sincronización" section with `SyncStatusCard` and `RejectionList` (shown only when there are rejections) to `SRC/app/(app)/(tabs)/settings.tsx`.

**Checkpoint**: quickstart §5 pasa.

---

## Phase 7: User Story 5 - Cerrar sesión de forma segura (Priority: P2)

**Goal**: cerrar sesión sincroniza lo posible, advierte de pérdidas, revoca la sesión en el servidor y borra todo lo local.

**Independent Test**: con 1 pendiente sin red, "Cerrar sesión" advierte "Se perderá 1 cambio". Al confirmar, vuelve al login sin datos locales ni credenciales. Al volver a entrar se descargan los datos (quickstart §7).

### Tests for User Story 5 ⚠️

- [ ] T076 [P] [US5] Tests in `SRC/db/wipe.test.ts`: `wipeLocalData()` leaves the 8 tables and `sync_rejections` empty, `sync_metadata` with 8 rows whose cursors and dates are NULL, and `user_version` unchanged.
- [ ] T077 [P] [US5] Tests in `SRC/session/signOut.test.ts`:
  - no pending changes → sync, `POST /auth/logout`, wipe, `clearMirror`, `tokenStorage.clear`, and `status = 'signedOut'`;
  - pending changes remain after sync → returns `{ kind: 'pendingWouldBeLost', pendingCount }` and does nothing else;
  - `force: true` → wipes anyway;
  - offline → the logout request is skipped and the local wipe still happens (FR-033);
  - a logout API error is ignored.

### Implementation for User Story 5

- [ ] T078 [US5] Create `SRC/db/wipe.ts` with `wipeLocalData()` (research R13). Under `withWriteLock`, it runs `DELETE FROM` on the 8 tables and `sync_rejections`, and `UPDATE sync_metadata SET pull_cursor = NULL, last_synced_at = NULL`.
- [ ] T079 [US5] Add `signOut({ force })` to `SRC/session/sessionService.ts`, following research R13 and the `SignOutResult` in [contracts/client-modules.md](./contracts/client-modules.md):
  1. Run `syncNow()` if online and `pendingCount > 0`.
  2. If pending changes remain and `!force`, return `pendingWouldBeLost`.
  3. Stop sync, then `POST /auth/logout` with `{ refreshToken }` (best effort).
  4. `wipeLocalData()`, `clearMirror()` and `tokenStorage.clear()`; reset `syncStore`; set `status = 'signedOut'`.
- [ ] T080 [US5] Add a destructive "Cerrar sesión" `Button` at the bottom of `SRC/app/(app)/(tabs)/settings.tsx`:
  - first `confirm()`: "¿Cerrar sesión? Se borrarán los datos de este dispositivo.";
  - while running, show progress text: "Sincronizando…";
  - on `pendingWouldBeLost`, ask a second `confirm()` — "Se perderán {n} cambios que no se han sincronizado." — then `signOut({ force: true })`.

  Navigation to `/login` happens through the guard (N6).

**Checkpoint**: quickstart §7 pasa; SC-009.

---

## Phase 8: User Story 6 - Renovación de sesión y sesión vencida (Priority: P2)

**Goal**: con la sesión vencida la app sigue usable, avisa sin bloquear y permite re-autenticarse conservando los datos (misma cuenta) o borrándolos tras confirmar (otra cuenta).

**Independent Test**: revocar las sesiones en el servidor, hacer un cambio y sincronizar. Aparece el aviso y la app sigue usable. La reauth con la misma cuenta sube el pendiente. Con otra cuenta pide confirmación de borrado (quickstart §6).

### Tests for User Story 6 ⚠️

- [ ] T081 [P] [US6] Tests in `SRC/session/reauth.test.ts`:
  - `onRefreshRejected` sets `expired = true` and keeps the session, profile and DB;
  - `syncEngine.run()` while expired returns `skipped: expired` with no HTTP calls;
  - `signIn` while expired with the same profile `id` → clears `expired`, keeps the DB and triggers sync;
  - `signIn` with a different `id` → returns `ownerMismatch` with `pendingCount`, and changes nothing until `confirm()`, which wipes, saves the new session and profile, and clears `expired` (FR-032).

### Implementation for User Story 6

- [ ] T082 [US6] In `SRC/session/sessionService.ts`, add the owner check to `signIn`. If `profile.id` differs from the stored profile's `id`, return `{ kind: 'ownerMismatch', pendingCount, confirm }` without saving anything; `confirm()` runs `wipeLocalData()` + `clearMirror()` and then saves. On success, clear `expired` and call `syncNow()`.
- [ ] T083 [US6] In `SRC/sync/syncEngine.ts`, also skip the cycle when `sessionStore.expired`. In `SRC/sync/syncScheduler.ts`, subscribe to `sessionStore`: when `expired` goes from true to false, run immediately.
- [ ] T084 [US6] Create `SRC/app/(app)/reauth.tsx`, presented as a `modal` in `SRC/app/(app)/_layout.tsx`. It reuses the login form: extract the form from `SRC/app/(auth)/login.tsx` into `SRC/session/components/LoginForm.tsx` and use it in both screens. The email is prefilled from the profile. On `ownerMismatch`, show `confirm()` with "Vas a entrar con otra cuenta. Se borrarán los datos de este dispositivo ({n} cambios sin sincronizar se perderán)."; on success, `router.back()`.
- [ ] T085 [US6] In `SRC/app/(app)/_layout.tsx`, add a non-blocking banner shown while `expired` (`GlassSurface` at the top, under the safe area) with "Tu sesión venció. Inicia sesión para sincronizar." and an "Iniciar sesión" action → `/reauth` (navigation rule N5).
- [ ] T086 [US6] In `SRC/session/sessionService.ts`, when the app comes back online and `profile` is missing, fetch it again with `GET /users/me`.

**Checkpoint**: quickstart §6 pasa; SC-008.

---

## Phase 9: User Story 7 - Recuperar la contraseña olvidada (Priority: P3)

**Goal**: flujo de 3 pasos desde el login con mensajes genéricos.

**Independent Test**: con correo configurado en la API, completar el flujo e iniciar sesión con la contraseña nueva (quickstart §8).

### Tests for User Story 7 ⚠️

- [ ] T087 [P] [US7] Tests in `SRC/session/passwordReset.test.ts`, with fake `api`:
  - `requestPasswordReset` returns the server message and sends `auth: false`;
  - `verifyResetCode` returns `resetToken`, and `INVALID_CODE` maps to "El código no es válido o venció. Pide uno nuevo.";
  - `resetPassword` 204 → resolves, and `INVALID_RESET_TOKEN` maps to "El permiso venció. Empieza de nuevo.";
  - local validation rejects a code that is not `^\d{6}$` and a password outside 8–128 characters or not matching its confirmation, without any HTTP call.

### Implementation for User Story 7

- [ ] T088 [US7] Create `SRC/session/passwordReset.ts` with `requestPasswordReset`, `verifyResetCode`, `resetPassword` and their zod schemas ([contracts/api-usage.md](./contracts/api-usage.md)). The `resetToken` lives only in memory: export `setResetToken`/`takeResetToken` from a module variable and never persist it.
- [ ] T089 [P] [US7] Create `SRC/app/(auth)/forgot-password.tsx`. Field: email. On submit, show the generic server message and a button "Ya tengo el código" → `/verify-code?email=…`.
- [ ] T090 [P] [US7] Create `SRC/app/(auth)/verify-code.tsx`:
  - a 6-digit numeric input;
  - on success, `setResetToken` and `router.replace('/reset-password')`;
  - a "Reenviar código" link that calls `requestPasswordReset` again.
- [ ] T091 [P] [US7] Create `SRC/app/(auth)/reset-password.tsx`:
  - fields: new password + confirmation (8–128 characters, must match);
  - on 204, `router.replace('/login?email=…')` with a success notice;
  - with no token in memory, or on `INVALID_RESET_TOKEN`, go back to `/forgot-password`.
- [ ] T092 [US7] Make sure the "¿Olvidaste tu contraseña?" link in `SRC/session/components/LoginForm.tsx` goes to `/forgot-password` (hidden in reauth mode). Add the 3 routes to the public list in `SRC/session/pendingRoute.ts` if they are not already there.

**Checkpoint**: quickstart §8 pasa.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T093 [P] Update `README.md` › App (`apps/mobile`):
  - `.env` with `EXPO_PUBLIC_API_URL`;
  - a new development build is needed (native modules);
  - `APP_VARIANT=development` for cleartext HTTP;
  - `CORS_ORIGINS=http://localhost:8081` in the API `.env` for web;
  - COOP/COEP headers required when hosting the web build;
  - data are wiped on sign-out.
- [ ] T094 [P] Update `docs/db-finanzas.md` §9: describe the client-only columns `server_updated_at` and `is_dirty`, and the client-only table `sync_rejections` (link to this spec's data-model).
- [ ] T095 [P] Create the dev-only load script `MOB/scripts/seed-sync-load.ts`, run with `npx tsx`. It logs in with env credentials and pushes 1 account + 5,000 transactions spread over 12 months through `/sync/push` in chunks of 500, to measure SC-006.
- [ ] T096 Measure on a mid-range Android device and record the results in `specs/006-client-sync-auth/quickstart.md` (a new "Resultados" section):
  - SC-002: cold start to Inicio in < 2 s with data;
  - SC-003: save to visible in < 300 ms offline;
  - SC-006: first sync of the 5,000-transaction dataset in < 30 s, with the app usable during the download.

  If a target fails, open a follow-up note in the same file.
- [ ] T097 Run `npm run typecheck && npm run lint && npm test && npm run format:check` in `MOB/` and fix all issues.
- [ ] T098 Run the full [quickstart.md](./quickstart.md) (§0–§9) on Android and web, and tick each step.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)**, which includes the T021 gate → user stories.
- **US1 (P1)** and **US2 (P1)** depend only on Foundational and can proceed in parallel. They touch disjoint files, except `SRC/app/_layout.tsx` (T036, T050, T052) and `settings.tsx` (T037, T049): do those tasks sequentially.
- **US3 (P1)** depends on US1 (session, `(app)` layout) and US2 (DB-backed mirror).
- **US4**, **US5** and **US6** (P2) depend on US3. They are independent of each other except for shared files: `settings.tsx` (T075, T080) and `sessionService.ts` (T079, T082, T086).
- **US7 (P3)** depends only on US1 (login screen, `apiClient`). It can be done any time after US1, even before US3.
- **Polish** runs after the stories it documents or measures.

### Within Each User Story

- Tests are written first and must fail before implementing.
- Types/stores → services → screens.
- Story checkpoint (quickstart section) before moving on.

### Story completion order

```text
Setup → Foundational(+T021 gate) → ┬→ US1 ─┬→ US3 → ┬→ US4
                                   └→ US2 ─┘        ├→ US5
                                                    └→ US6
                           US1 → US7 (any time after US1)
```

## Parallel Execution Examples

### Foundational

```text
T007 SqlDatabase types | T008 sync/tables.ts | T010 better-sqlite3 adapter | T017 localChanges bus | T018 api/errors.ts
then: T009 schema → T011 tests ; T012 writeLock → T013 tests ; T019 api client → T020 tests
```

### User Story 1

```text
Tests: T022 sessionService | T023 routing | T024 messages
Impl:  T025 types | T026 tokenStorage | T027 tokenStorage.web | T030 messages | T031 hooks | T032 pendingRoute
```

### User Story 2

```text
Tests: T038 persistence | T039 atomicity
After T041 (store mirror): T042–T048, the seven repos, all in parallel; T051 webTabLock in parallel
```

### User Story 3

```text
Tests: T054 money | T055 mappers | T056 fake server | T058 scheduler   (T057 after T056)
Impl:  T059 money | T060 mappers | T061 syncStore | T062 connectivity  → T063 engine → T064 scheduler → T065–T067
```

### User Story 4

```text
T068 | T069 tests ; T070 status | T072 hooks | T073 SyncStatusCard | T074 RejectionList (after T071)
```

## Implementation Strategy

### MVP First (US1 + US2 + US3)

The three P1 stories form the minimum useful product: login, persistent offline data and sync. Each one has a demo of its own:
- **US1 alone**: login and guards over an empty app.
- **US2 alone**: persistent offline data, with the guard still in place.
- **US3**: completes the MVP.

**Stop at the US3 checkpoint** and validate quickstart §1–§4 on Android and web before continuing.

### Incremental Delivery

1. Setup + Foundational (including the web SQLite gate).
2. US1 → demo: login and guards.
3. US2 → demo: persistent offline data.
4. US3 → demo: two devices in sync. **MVP**.
5. US4 → sync visibility and conflict handling.
6. US5 → safe sign-out.
7. US6 → expired sessions.
8. US7 → password recovery.
9. Polish: docs, performance measurement, full quickstart.

## Notes

- Never hold the write lock across a network call (research R3).
- No `user_id`, `REAL` or local foreign keys in SQLite (data-model §1).
- Money must never go through `parseFloat`/`Number` on decimal strings (research R15).
- Do not commit or push unless explicitly asked (CLAUDE.md).
