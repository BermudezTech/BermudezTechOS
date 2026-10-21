# Contrato: módulos internos del cliente

Interfaces entre capas, para que cada una se pueda probar por separado. Las pantallas solo usan los hooks (`@/modules/finance/hooks`, `@/session/hooks`, `@/sync/hooks`); la regla de ESLint lo impone.

## `@/db` — base local

```ts
/** Subconjunto de SQLiteDatabase que usa la app (implementado por expo-sqlite y, en pruebas, por better-sqlite3). */
interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParams): Promise<{ changes: number }>;
  getAllAsync<T>(sql: string, params?: SqlParams): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParams): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

openLocalDb(): Promise<SqlDatabase>;           // abre y aplica migraciones (PRAGMA user_version)
withWriteLock<T>(task: (db: SqlDatabase) => Promise<T>): Promise<T>;  // mutex global + transacción (research R3)
wipeLocalData(): Promise<void>;                // DELETE de todas las tablas (research R13)
```

## `@/modules/finance/data/local` — repositorios

- Implementan la interfaz existente `FinanceRepository` (spec 001) con las **mismas validaciones y errores** (`ValidationError`).
- Cada operación: validar contra el espejo → `withWriteLock` (escribe filas con `updated_at = nowUtc()` e `is_dirty = 1`) → aplicar al espejo → `syncScheduler.notifyLocalChange()`.
- `hydrate(db)`: carga las ocho tablas al espejo.
- `applyServerRecords(table, rows)`: lo usa el motor de sync para actualizar el espejo tras aplicar una página.

## `@/sync` — motor y planificador

```ts
type SyncTable = 'categories' | 'reimbursement_groups' | 'assets' | 'accounts'
  | 'subscriptions' | 'recurring_incomes' | 'cdts' | 'transactions';

interface TableMapper<Row, Wire> {          // research R15
  toWire(row: Row): Wire;                  // fila local → JSON del PUSH
  fromWire(json: unknown): Row;            // JSON del PULL → fila local; lanza ParseError
}

interface SyncEngine {
  run(): Promise<SyncOutcome>;             // un ciclo PUSH → PULL (research R8); single-flight
}
type SyncOutcome =
  | { kind: 'ok'; pushed: number; pulled: number; rejected: number }
  | { kind: 'skipped'; reason: 'offline' | 'expired' | 'signedOut' }
  | { kind: 'failed'; error: 'network' | 'server' | 'session' };

interface SyncScheduler {                  // research R14
  start(): void; stop(): void;
  notifyLocalChange(): void;               // debounce 5 s
  syncNow(): Promise<SyncOutcome>;
}

discardLocalChange(table: SyncTable, id: string): Promise<void>;          // research R10
countDependents(table: SyncTable, id: string): Promise<number>;          // para la confirmación
```

Hooks: `useSyncStatus()` (estado derivado, ver data-model §6), `useSyncRejections()`, `useSyncNow()`.

## `@/api` — cliente HTTP

```ts
interface ApiClient {
  request<T>(method: 'GET' | 'POST', path: string, opts?: { body?: unknown; auth?: boolean }): Promise<T>;
}
class NetworkError extends Error {}
class ApiError extends Error { status: number; code: string; details?: unknown; retryAfter?: number }
```

Renovación single-flight y clasificación de errores: [api-usage.md](./api-usage.md).

## `@/session` — sesión

```ts
signIn(email: string, password: string): Promise<SignInResult>;
//   SignInResult = { kind: 'ok' } | { kind: 'ownerMismatch'; pendingCount: number; confirm(): Promise<void> }
signOut(opts?: { force?: boolean }): Promise<SignOutResult>;
//   SignOutResult = { kind: 'done' } | { kind: 'pendingWouldBeLost'; pendingCount: number }
requestPasswordReset(email: string): Promise<string>;      // mensaje genérico
verifyResetCode(email: string, code: string): Promise<string>;   // resetToken
resetPassword(resetToken: string, newPassword: string): Promise<void>;
restoreSession(): Promise<void>;          // al arrancar: lee bt.session/bt.profile
```

Hooks: `useSession()` → `{ status, expired, profile }`.

Almacenamiento (`tokenStorage.ts` / `tokenStorage.web.ts`): `load()`, `save(session, profile?)`, `clear()`.
