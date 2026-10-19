---

description: "Task list for 005-legacy-movements-migration"
---

# Tasks: Migración de movimientos desde la base antigua

**Input**: Design documents from `/specs/005-legacy-movements-migration/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/cli.md](./contracts/cli.md), [quickstart.md](./quickstart.md)

**Tests**: incluidas. La constitución (Flujo de trabajo y calidad) exige pruebas automáticas de la lógica de montos y saldos, y el plan define `node:test`. Las pruebas de cada historia se escriben antes de su implementación y deben fallar primero.

**Organization**: por historia de usuario (spec.md). US1 y US2 son P1 y US3 es P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivo distinto, sin dependencias pendientes)
- **[Story]**: US1, US2 o US3
- Todas las rutas son relativas a la raíz del repositorio. El código va en `migration/` (plan.md, *Structure Decision*).

## Convenciones para todas las tareas

- Node.js 24, módulos ES (`.mjs`), `import` con extensión explícita. Identificadores en inglés; mensajes al operador y comentarios en español.
- **Nunca** operar montos con `Number`: string → centavos `BigInt` con `migration/lib/money.mjs` (research R9). Los montos de PostgreSQL se leen como `::text`.
- Las funciones de `lib/parse-dump.mjs`, `lib/money.mjs` y `lib/plan.mjs` son **puras**: sin I/O ni `process`. Solo `lib/apply.mjs` toca la base y solo `migrate-legacy-movements.mjs` lee argumentos, entorno y archivos.
- Los errores esperados se lanzan como `MigrationError(message, { exitCode, sourceId? })`: `exitCode` 1 para errores de datos o invariantes y 2 para errores de entorno (contracts/cli.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: inicializar el paquete del script.

- [X] T001 Crear `migration/package.json`:
  - campos: `"name": "bermudeztech-legacy-migration"`, `"private": true`, `"type": "module"`, `"engines": { "node": ">=24" }`;
  - scripts: `"test": "node --test test/"` y `"migrate": "node migrate-legacy-movements.mjs"`;
  - instalar `pg@^8` y `uuid@^11` con `npm install --prefix migration pg@^8 uuid@^11`, para generar `migration/package-lock.json`.
- [X] T002 [P] Reescribir `migration/.gitignore` (hoy contiene solo `*.sql` sin salto de línea) con tres líneas: `*.sql`, `node_modules/` y `!test/fixtures/*.sql`. El fixture sí se versiona.
- [X] T003 [P] Crear la estructura vacía `migration/lib/` y `migration/test/fixtures/`. Crear `migration/lib/errors.mjs` con `export class MigrationError extends Error`, con propiedades `exitCode` (por defecto 1) y `sourceId` (opcional).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: parseo, dinero, mapa de ubicaciones, conexión, usuario único, transacción con lock y creación básica de cuentas. US1, US2 y US3 dependen de esto.

**⚠️ CRITICAL**: ninguna historia empieza hasta terminar esta fase.

- [X] T004 [P] Crear el fixture `migration/test/fixtures/sample-dump.sql`, con el mismo formato que el dump real (`INSERT INTO movements (\`id\`, \`description\`, \`amount\`, \`movementDate\`, \`location\`, \`cdt\`) VALUES ('<id>', '<desc>', '<monto>', '<fecha>', '<loc>', NULL|<n>);`, una fila por línea). Debe incluir:
  - una línea con CRLF y otra con espacio final;
  - las tablas `CREATE TABLE`/`INSERT INTO location` y `INSERT INTO transfers`, que deben ignorarse;
  - ingresos y egresos simples en las ubicaciones 1, 2, 5, 6, 7 y 8;
  - movimientos excluidos: ubicación 3 con `cdt = 1`, ubicación 9 con `cdt = 2` y fecha `0000-00-00`, y una fila de ubicación 4;
  - un par de transferencias 5 → 2 válido;
  - un par 1 → 8, que debe descartarse por fusión;
  - un par con montos distintos (−10000.00 / +179000.00), que no debe emparejarse;
  - dos patas negativas iguales el mismo día con una sola positiva, para el orden de emparejamiento por id;
  - una "Transferencia a CDT" en la ubicación 1, que debe quedar suelta;
  - "Transferencia Santiago Baca" en la ubicación 5 (no es candidata);
  - un monto `0.00`, que se excluye;
  - descripciones con tildes y ñ.

  Documentar en un comentario `--` al inicio del archivo las cifras esperadas del fixture.
- [X] T005 [P] Escribir `migration/test/money.test.mjs` (antes de T007):
  - `parseCents("-133000.00") === -13300000n`, `parseCents("0.10") + parseCents("0.20") === parseCents("0.30")` y `parseCents("94100.00") === 9410000n`;
  - formatos inválidos (`"1.5"`, `"abc"`, `"1,00"`) lanzan `MigrationError`;
  - `formatCents(-13300000n)` devuelve `"-133.000,00"` y `formatCents(691n)` devuelve `"6,91"`;
  - `absAmountString("-133000.00") === "133000.00"`.
- [X] T006 [P] Escribir `migration/test/parse-dump.test.mjs` (antes de T008), usando el fixture de T004:
  - devuelve solo filas de `movements`, con `{ id: number, description: string, amount: string, date: string, location: number, cdt: number | null }`;
  - conserva tildes y ñ, y tolera CRLF y espacios finales;
  - una línea `INSERT INTO movements` malformada lanza `MigrationError` con `exitCode` 1 y el número de línea;
  - `usmovements`, `cdtmovements` y `transfers` se ignoran.
- [X] T007 [P] Implementar `migration/lib/money.mjs`:
  - `parseCents(str)` usa la regex `^-?\d+\.\d{2}$` y devuelve un `BigInt`;
  - `absAmountString(str)` devuelve el valor absoluto como string `"1234.56"`;
  - `formatCents(bigint)` devuelve el formato es-CO, con `.` para miles y `,` para decimales;
  - `sumCents(iterable)`.

  Sin `Number` en ningún cálculo (research R9).
- [X] T008 [P] Implementar `migration/lib/parse-dump.mjs`, con `export function parseMovements(sqlText)`:
  - divide por `/\r?\n/`;
  - para cada línea que empiece por `INSERT INTO movements ` aplica la regex `^INSERT INTO movements \(.*?\) VALUES \('(\d+)', '(.*)', '(-?\d+\.\d{2})', '([0-9-]{10})', '(\d+)', (NULL|\d+)\);\s*$`;
  - si no coincide, lanza `MigrationError` con `exitCode` 1 y el número de línea.

  Devuelve los objetos de T006 sin validar la fecha (eso es del plan). Research R1.
- [X] T009 Crear `migration/lib/plan.mjs` con las constantes compartidas:
  - **Mapa de cuentas**: `ACCOUNTS`, un arreglo ordenado con esta forma (data-model §2):

    ```js
    { key: 'cash', name: 'Efectivo', type: 'CASH', isArchived: false, sortOrder: 0 },
    { key: 'nequi', name: 'Nequi', type: 'SAVINGS', isArchived: false, sortOrder: 1 },
    { key: 'bancolombia', name: 'Bancolombia', type: 'SAVINGS', isArchived: false, sortOrder: 2 },
    { key: 'alamano', name: 'A la mano', type: 'SAVINGS', isArchived: true, sortOrder: 3 },
    { key: 'global66', name: 'Global66', type: 'SAVINGS', isArchived: true, sortOrder: 4 },
    ```

  - **Mapa de ubicaciones**: `LOCATION_TO_ACCOUNT = { 1: 'cash', 8: 'cash', 2: 'nequi', 5: 'bancolombia', 6: 'alamano', 7: 'global66' }`.
  - **Exclusiones**: `EXCLUDED_LOCATIONS = { 3: 'CDT', 9: 'CDT', 4: 'USD' }`.
  - **Namespace UUIDv5**: `NAMESPACE = uuidv5('https://bermudeztech.os/legacy-migration/2026-10', uuidv5.URL)`, calculado una vez y escrito como literal, con un comentario que explique cómo se obtuvo (research R3). Usar los helpers `accountId(key)`, `movementId(id)` y `transferId(outId, inId)` con los nombres `account:<key>`, `movement:<id>` y `transfer:<out>:<in>`.
  - **Fecha**: `toOccurredAt(date)` devuelve `` `${date}T05:00:00.000Z` `` (medianoche de Colombia, UTC−5, research R7). Valida que `date` sea una fecha real (rechaza `0000-00-00` y `2025-02-30`) comprobando con `Date.UTC` que año, mes y día se conservan. Si no es válida, lanza `MigrationError` con `sourceId`.
- [X] T010 Crear `migration/lib/apply.mjs`, parte común:
  - `normalizeDatabaseUrl(url)`: reemplaza el prefijo `postgresql+asyncpg://` por `postgresql://`.
  - `connect(url)` con `new pg.Client({ connectionString })`. Si falla, `MigrationError` con `exitCode` 2.
  - `findSingleUser(client)`: `SELECT id, email FROM users ORDER BY created_at`. Si no hay exactamente 1 fila, lanza `MigrationError` con `exitCode` 2 y el mensaje `"Se esperaba exactamente 1 usuario en la base nueva; hay N"` (FR-002).
  - `lockUserSync(client, userId)`: ejecuta `SELECT pg_advisory_xact_lock(1398361667, ('x' || substr(replace($1::text, '-', ''), 1, 8))::bit(32)::int)`. El `1398361667` es `0x53594E43` y la clave equivale a `_user_key` de `apps/api/app/modules/sync/core/lock.py` (research R4).
  - `createAccount(client, userId, account, id)`: `INSERT INTO accounts (id, user_id, name, type, nature, currency, opening_balance, is_excluded_from_net_worth, is_archived, sort_order, created_at, updated_at) VALUES ($1, $2, $3, $4, 'ASSET', 'COP', 0, false, $5, $6, now(), now())`. `server_updated_at` y `deleted_at` usan su valor por defecto.
- [X] T011 Crear `migration/migrate-legacy-movements.mjs` (esqueleto del CLI, contracts/cli.md):
  - **Argumentos**: lee `process.argv`. Exige la ruta del dump y acepta `--apply` u `--offline`, que no pueden ir juntos. Cualquier argumento inválido termina con un mensaje de uso y código 2.
  - **Lectura**: lee el dump con `fs.readFile(path, 'utf8')`.
  - **URL de la base**: toma `MIGRATION_DATABASE_URL` o, si falta, `DATABASE_URL`. Es obligatoria salvo con `--offline`.
  - **Errores**: un `main()` envuelto en `try/catch`. Un `MigrationError` se escribe en stderr como `Error: <mensaje>` (más ` (movimiento <sourceId>)` si lo tiene) y sale con su `exitCode`. Cualquier otro error sale con código 1 y el stack.
  - **Flujo de base de datos**: `connect`, `BEGIN`, `findSingleUser`, `lockUserSync`, el paso que añaden las historias, y `ROLLBACK` o `COMMIT`. `finally` cierra el cliente y hace `ROLLBACK` si la transacción sigue abierta.

**Checkpoint**: `npm test --prefix migration` pasa las pruebas de T005 y T006. El CLI con `--offline` parsea el dump real sin errores.

---

## Phase 3: User Story 1 - Traer el historial de movimientos en COP (Priority: P1) 🎯 MVP

**Goal**: los 2.137 movimientos incluidos quedan en la base nueva como 201 transferencias y 1.721 ingresos o egresos, con los saldos exactos.

**Independent Test**: sobre una base de desarrollo nueva con un usuario, ejecutar `--apply` y comprobar las cifras y los saldos de quickstart §3. Las cuentas se crean con `createAccount` (T010); su reutilización es US2.

### Tests for User Story 1 ⚠️

- [X] T012 [P] [US1] Escribir `migration/test/plan.test.mjs`, con `buildPlan(parseMovements(fixture))` sobre el fixture de T004:
  - **Exclusiones**: la ubicación 3 y la 9 cuentan como `CDT`, la 4 como `USD` y el monto cero como `ZERO_AMOUNT`. La fecha `0000-00-00` de un movimiento excluido **no** aborta.
  - **Ingresos y egresos**: un monto positivo da `INCOME` y uno negativo `EXPENSE`. `amount` es el valor absoluto como string, `description` y `occurredAt` se conservan, y la ubicación 8 se mapea a `cash`.
  - **Transferencia válida**: el par 5 → 2 da un `TRANSFER` con `accountKey: 'bancolombia'`, `counterAccountKey: 'nequi'`, la descripción de la pata de salida, `id === transferId(out, in)` y `sourceIds: [out, in]`.
  - **Fusión**: el par 1 ↔ 8 se descarta y cuenta en `discardedMergedPairs`.
  - **Patas sueltas**: el par con montos distintos y "Transferencia a CDT" quedan como `EXPENSE`/`INCOME`. "Transferencia Santiago Baca" no es candidata.
  - **Orden**: con dos patas negativas iguales, se empareja la de menor id.
  - **Determinismo**: dos llamadas a `buildPlan` producen planes idénticos (`deepStrictEqual`).
  - **Invariantes**: `read = included + Σ excluded` e `included = 2·transfers + 2·discarded + loose`. El saldo esperado por cuenta (centavos) es igual a la suma con signo de los montos originales de sus ubicaciones.
  - **Errores**: un movimiento incluido con fecha inválida lanza `MigrationError` con `sourceId`. Una ubicación desconocida (p. ej. 10) también lanza.

### Implementation for User Story 1

- [X] T013 [US1] Implementar `export function buildPlan(movements)` en `migration/lib/plan.mjs` (research R2, R8; data-model §3):
  1. Clasificar cada fila:
     - `cdt !== null` o ubicación en `EXCLUDED_LOCATIONS`: excluida por su motivo (`cdt !== null` cuenta como `CDT`);
     - monto con centavos `0n`: excluida como `ZERO_AMOUNT`;
     - ubicación ausente de `LOCATION_TO_ACCOUNT`: `MigrationError`;
     - resto: incluida, tras validar la fecha con `toOccurredAt`.
  2. Candidatas: incluidas con `/^transferencia (a|desde)\b/i.test(description)`.
  3. Recorrer las negativas en orden de `id` ascendente. Para cada una, tomar la primera positiva libre (en orden de `id`) con la misma `date`, el mismo `parseCents` absoluto y una `location` distinta.
  4. Para cada par: si `LOCATION_TO_ACCOUNT` da la misma cuenta, se descarta. Si no, `{ id: transferId(o.id, i.id), type: 'TRANSFER', accountKey, counterAccountKey, amount: absAmountString(o.amount), occurredAt, description: o.description, sourceIds: [o.id, i.id] }`.
  5. Filas no emparejadas: `{ id: movementId(id), type: amountCents > 0n ? 'INCOME' : 'EXPENSE', accountKey, counterAccountKey: null, amount: absAmountString, occurredAt, description, sourceIds: [id] }`.
  6. Ordenar `transactions` por `sourceIds[0]`.
  7. Calcular `summary` (data-model §3, `MigrationSummary`): `read`, `included`, `excluded: { CDT, USD, ZERO_AMOUNT }`, `candidates`, `transfers`, `discardedMergedPairs`, `looseLegs` (candidatas sin pareja), `incomes`, `expenses`, `records`, y `perAccount[key] = { count, expectedCents }`. `expectedCents` es la suma de los montos originales con signo de las filas incluidas de esa cuenta.
  8. Verificar los invariantes de data-model §3. Si alguno falla, `MigrationError` con `exitCode` 1.

  Devuelve `{ transactions, summary }`.
- [X] T014 [US1] Añadir `insertTransactions(client, userId, accountIds, transactions)` en `migration/lib/apply.mjs` (research R11). Es una sola sentencia:

  ```sql
  INSERT INTO transactions (id, user_id, account_id, counter_account_id, type, amount, category_id, category_source, occurred_at, description, created_at, updated_at)
  SELECT t.id, $1, t.account_id, t.counter_account_id, t.type, t.amount::numeric, NULL, 'MANUAL', t.occurred_at, t.description, now(), now()
  FROM unnest($2::uuid[], $3::uuid[], $4::uuid[], $5::text[], $6::text[], $7::timestamptz[], $8::text[])
       AS t(id, account_id, counter_account_id, type, amount, occurred_at, description)
  ON CONFLICT (id) DO NOTHING
  RETURNING id
  ```

  - `accountIds` mapea cada `key` a un UUID.
  - Los montos se pasan como **strings** (FR-004, Principio IV).
  - Devuelve `{ inserted: rows.length, existing: transactions.length - rows.length }`.
- [X] T015 [US1] Añadir `verifyBalances(client, userId, accountIds, transactionIds, perAccount)` en `migration/lib/apply.mjs`. Por cada cuenta, calcula en SQL solo sobre `id = ANY($n::uuid[])`:

  ```sql
  COALESCE(SUM(CASE WHEN type='INCOME' AND account_id=$a THEN amount
                    WHEN type='EXPENSE' AND account_id=$a THEN -amount
                    WHEN type='TRANSFER' AND account_id=$a THEN -amount
                    WHEN type='TRANSFER' AND counter_account_id=$a THEN amount
                    ELSE 0 END), 0)::text
  ```

  Convierte el resultado con `parseCents` y lo compara con `expectedCents`. Devuelve `[{ key, expectedCents, actualCents, ok }]`. Si alguno no es `ok`, lanza `MigrationError` con `exitCode` 1, lo que obliga al `ROLLBACK` (research R5, SC-002).
- [X] T016 [US1] Completar en `migration/migrate-legacy-movements.mjs` el flujo de US1, dentro de la transacción y tras el lock:
  1. `parseMovements` y `buildPlan`;
  2. para cada `ACCOUNTS[i]`, `createAccount` con `accountId(key)` si no existe un registro con ese `id` (`SELECT 1 FROM accounts WHERE id = $1`). US2 lo sustituye;
  3. `insertTransactions`;
  4. `verifyBalances`;
  5. `COMMIT` si es `--apply`. En US3 se añade el modo por defecto con `ROLLBACK`.

  Hasta US3, el CLI exige `--apply` para conectar.
- [X] T017 [US1] Añadir `migration/lib/report.mjs` con `export function formatSummary({ mode, user, summary, accounts, write, verification })`. Devuelve el texto de contracts/cli.md §Salida, en español y en este orden:
  1. Modo
  2. Usuario `email (id)`
  3. Origen (leídos, incluidos, excluidos por motivo)
  4. Transferencias (candidatas, formadas, descartadas por fusión, patas sueltas)
  5. Cuentas (acción, movimientos, saldo esperado con `formatCents`)
  6. Escritura (insertados, ya existentes)
  7. Verificación (`OK`/`ERROR` por cuenta)

  Las secciones sin datos (p. ej. el usuario en offline) se omiten. Usarla desde `migrate-legacy-movements.mjs`.

**Checkpoint**: `npm test` pasa T012. Un `--apply` sobre una base nueva de desarrollo deja 1.922 transacciones (201 `TRANSFER`), 5 cuentas y saldos `OK` (quickstart §3).

---

## Phase 4: User Story 2 - Cuentas destino creadas y con el estado correcto (Priority: P1)

**Goal**: se crean o reutilizan por nombre las 5 cuentas (3 activas y 2 archivadas, sin Bolsillo) sin duplicados, y se abortan los casos ambiguos.

**Independent Test**: crear antes en la base una cuenta "nequi" (minúsculas) y una "Global66" no archivada. Tras `--apply`, debe haber una sola Nequi (la existente, con sus movimientos), Global66 debe quedar archivada y no debe existir ninguna "Bolsillo".

### Tests for User Story 2 ⚠️

- [X] T018 [P] [US2] Escribir `migration/test/accounts.test.mjs` sobre `resolveAccountActions(existingRows, ACCOUNTS)`, función pura. Recibe filas `{ id, name, currency, is_archived }` (cuentas del usuario con `deleted_at IS NULL`) y devuelve por cada cuenta `{ key, id, action: 'create' | 'reuse' | 'reuse+archive' }`. Casos:
  - sin coincidencias: `create` con `accountId(key)`;
  - coincidencia sin distinguir mayúsculas ni espacios (`' nequi '`): `reuse` con el id existente;
  - A la mano o Global66 existentes y no archivadas: `reuse+archive`. Si ya están archivadas: `reuse`;
  - dos filas con el mismo nombre normalizado: `MigrationError` con `exitCode` 1, "cuenta ambigua";
  - `currency !== 'COP'`: `MigrationError` con `exitCode` 1;
  - una cuenta existente llamada "Bolsillo" se ignora (no se usa ni se toca).

### Implementation for User Story 2

- [X] T019 [US2] Implementar `export function resolveAccountActions(existingRows, accounts)` en `migration/lib/plan.mjs`, según T018 y research R6. Para comparar, normaliza con `name.trim().toLocaleLowerCase('es')`.
- [X] T020 [US2] Añadir en `migration/lib/apply.mjs`:
  - `loadExistingAccounts(client, userId)`: `SELECT id, name, currency, is_archived FROM accounts WHERE user_id = $1 AND deleted_at IS NULL`.
  - `archiveAccount(client, userId, id)`: `UPDATE accounts SET is_archived = true, updated_at = now(), server_updated_at = clock_timestamp() WHERE id = $1 AND user_id = $2`.
  - `applyAccountActions(client, userId, actions)`: `create` → `createAccount`, `reuse+archive` → `archiveAccount`, `reuse` → nada. Devuelve el mapa `key → id`.
- [X] T021 [US2] En `migration/migrate-legacy-movements.mjs`, reemplazar la creación provisional de T016 por `loadExistingAccounts`, `resolveAccountActions` y `applyAccountActions`. Pasar las acciones a `formatSummary` para la sección Cuentas (`crear` / `reutilizar` / `reutilizar+archivar`).

**Checkpoint**: `npm test` pasa T018. La prueba independiente de US2 se cumple en la base de desarrollo.

---

## Phase 5: User Story 3 - Ejecución segura y repetible (Priority: P2)

**Goal**: la simulación es el modo por defecto, existe `--offline` sin base, la re-ejecución no inserta nada y cualquier error deja la base intacta.

**Independent Test**: simulación → `count(*)` sin cambios; `--apply` dos veces → la segunda informa 0 insertados y 1.922 existentes; con un segundo usuario en `users`, código 2 y nada escrito (quickstart §3).

### Tests for User Story 3 ⚠️

- [X] T022 [P] [US3] Escribir `migration/test/cli.test.mjs`. Ejecuta el CLI con `child_process.spawnSync(process.execPath, ['migrate-legacy-movements.mjs', ...])` y `cwd: migration/`:
  - sin argumentos o con `--apply --offline`: código 2 y el uso en stderr;
  - `test/fixtures/sample-dump.sql --offline`: código 0; stdout contiene `OFFLINE`, las cifras del fixture y no contiene `Usuario`;
  - sin `--offline` y sin `MIGRATION_DATABASE_URL` ni `DATABASE_URL` (`env` limpio): código 2.

### Implementation for User Story 3

- [X] T023 [US3] En `migration/migrate-legacy-movements.mjs`:
  - **Modo por defecto (simulación)**: ejecuta el flujo completo de base de datos y termina con `ROLLBACK`. El resumen dice `SIMULACIÓN` y "se insertarían N (M ya existen)".
  - **`--apply`**: termina con `COMMIT` y el resumen dice `APLICADO`.
  - **`--offline`**: solo `parseMovements`, `buildPlan` y `formatSummary`, sin conectar.

  Quitar la restricción provisional de T016 (research R5, FR-011).
- [X] T024 [US3] Garantizar la atomicidad en `migration/migrate-legacy-movements.mjs`: cualquier excepción tras `BEGIN` (de usuario, cuentas, inserción o verificación) hace `ROLLBACK` antes de salir. El mensaje a stderr indica "No se escribió ningún cambio". Con `--apply`, el `COMMIT` es lo último antes de imprimir el resumen (FR-010).
- [X] T025 [US3] Mostrar en `formatSummary` (`migration/lib/report.mjs`) la sección Escritura con `inserted`/`existing`, y en una re-ejecución el aviso "Re-ejecución: 0 movimientos nuevos" cuando `inserted === 0`. Verificar la idempotencia en la base de desarrollo: dos `--apply` seguidos dan un `count(*)` igual y saldos `OK` (FR-009, SC-003).

**Checkpoint**: `npm test` pasa T022, y se cumplen los tres escenarios de quickstart §3 (simulación, aplicación y re-ejecución) y el caso del segundo usuario.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T026 [P] Escribir `migration/test/real-dump.test.mjs`. Si `migration/bermudezwebapp-17-Saturday-October-2026.sql` no existe, se omite con `{ skip: 'dump no presente' }`. Con el dump, `buildPlan(parseMovements(dump))` debe dar:
  - `read` 2149, `included` 2137 y `excluded` `{ CDT: 12, USD: 0, ZERO_AMOUNT: 0 }`;
  - `transfers` 201, `discardedMergedPairs` 7, `records` 1922, y `incomes + expenses` 1721;
  - `expectedCents`: cash `34480000n`, nequi `691n`, bancolombia `20000079n`, alamano `0n` y global66 `0n` (data-model §3, SC-001, SC-002).
- [X] T027 [P] Crear `migration/README.md` en español. Explica qué hace el script, la instalación (`npm install`), las pruebas (`npm test`), los tres modos con un ejemplo cada uno, y las variables `MIGRATION_DATABASE_URL`/`DATABASE_URL`. Remite a `specs/005-legacy-movements-migration/quickstart.md` para el procedimiento en desarrollo y producción, e incluye la advertencia de hacer `pg_dump` antes de `--apply` en producción.
- [X] T028 Ejecutar `npm test --prefix migration` y `node migration/migrate-legacy-movements.mjs migration/bermudezwebapp-17-Saturday-October-2026.sql --offline`, y comparar el resumen con quickstart §2.
- [X] T029 Ejecutar quickstart §3 completo contra la base de desarrollo (`docker compose up -d`, `localhost:5433`): simulación, `--apply`, re-ejecución y comprobaciones SQL. Anotar en la descripción del cambio los resultados obtenidos. Si no hay Docker disponible, informarlo explícitamente en lugar de darlo por verificado.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001–T003)**: sin dependencias.
- **Foundational (T004–T011)**: depende de Setup.
  - T004–T008 en paralelo; T005 y T006 se escriben antes de T007 y T008.
  - T009 depende de T003 y de T007 (usa `MigrationError` y money).
  - T010 depende de T003.
  - T011 depende de T008–T010.
- **US1 (T012–T017)**: depende de Foundational. T012 primero; T013 → T014 → T015 → T016; T017 en paralelo con T014–T015.
- **US2 (T018–T021)**: depende de Foundational y de T016. Sustituye la creación provisional de cuentas.
- **US3 (T022–T025)**: depende de T016 y T017. Puede hacerse antes o después de US2.
- **Polish (T026–T029)**: T026 y T027 solo necesitan T013. T028 y T029 van al final.

### User Story Dependencies

- **US1**: independiente tras Foundational (crea las cuentas de forma básica).
- **US2**: se apoya en el flujo de US1 para ser demostrable (las cuentas se ven con sus movimientos).
- **US3**: se apoya en el flujo de base de datos de US1.

### Parallel Opportunities

- Setup: T002 ∥ T003.
- Foundational: T004 ∥ T005 ∥ T006, y luego T007 ∥ T008 ∥ T010.
- US1: T017 ∥ (T014, T015).
- US2 y US3 en paralelo tras US1, en archivos distintos, salvo `migrate-legacy-movements.mjs` (T021 y T023/T024 se coordinan).
- Polish: T026 ∥ T027.

### Parallel Example: Foundational

```text
Task: "T005 Escribir migration/test/money.test.mjs"
Task: "T006 Escribir migration/test/parse-dump.test.mjs"
Task: "T004 Crear migration/test/fixtures/sample-dump.sql"
# luego
Task: "T007 Implementar migration/lib/money.mjs"
Task: "T008 Implementar migration/lib/parse-dump.mjs"
Task: "T010 Crear migration/lib/apply.mjs (parte común)"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Setup y Foundational.
2. US1: plan, inserción y verificación de saldos.
3. **Validar**: `--apply` sobre una base de desarrollo **nueva** da 1.922 registros y saldos `OK`. Es usable si la base está limpia.

### Incremental Delivery

1. Con US2, se puede ejecutar sobre una base que ya tiene cuentas creadas desde la app.
2. Con US3, la simulación es el modo por defecto, la re-ejecución es segura y existe el modo offline. **Requisito para ejecutar en producción.**
3. Polish: pruebas con el dump real, README y validación del quickstart.

**No ejecutar `--apply` en producción hasta completar US3 y T029.**

## Notas de implementación (2026-10-18)

- **Orden del CLI**: el CLI se escribió una sola vez en su forma final, con los modos, la atomicidad y la resolución de cuentas, en lugar de las versiones provisionales de T011, T016 y T021. Ningún flujo intermedio llegó a ejecutarse contra una base.
- **Errores de saldo**: `verifyBalances` devuelve el resultado por cuenta. Es el CLI el que imprime el resumen en stderr y lanza `MigrationError` cuando algún saldo no coincide, lo que fuerza el `ROLLBACK`.
- **Cifras del dump real**: 429 candidatas y 13 patas sueltas, en vez de 430 y 14 (spec y research corregidos). "Transferencia adelanto por viáticos" no es una pata, porque la regex usa límite de palabra. Las cifras de SC-001 y SC-002 no cambian.
- **Validación T029**: se ejecutó en una pila de compose **aislada** (`docker compose -p bt-mig005`, puerto 5544, con su propio volumen), que se eliminó al terminar, para no tocar la base de desarrollo.
  - **Simulación**: 0 escritos.
  - **Primer `--apply`**: 1.922 insertados en 0,44 s.
  - **Re-ejecución**: 0 nuevos.
  - **Reutilización**: "nequi" se reutilizó y "Global66" se reutilizó y se archivó.
  - **Errores**: una cuenta ambigua da código 1 y deja 0 cambios. Dos usuarios dan código 2.
  - **PULL real de la API**: devolvió 5 cuentas y 1.922 transacciones, con saldos 344.800,00 / 6,91 / 200.000,79 / 0,00 / 0,00.
