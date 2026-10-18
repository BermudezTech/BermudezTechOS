# Data Model: Backend base con autenticación JWT y datos privados por usuario

**Feature**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

La fuente del esquema de finanzas es [`docs/db-finanzas.md`](../../docs/db-finanzas.md). Este documento no repite sus columnas: define cómo se implementan en el servidor, qué se añade y las tablas nuevas de autenticación. Al implementar, `docs/db-finanzas.md` se actualiza con todo lo marcado como **(nuevo)**.

## Convenciones del servidor

| Concepto | Implementación |
|---|---|
| ID | `UUID` PK. En tablas de finanzas lo asigna el cliente. En `users`, `refresh_tokens`, `password_reset_codes` y las categorías de la seed lo genera el servidor (uuid4). |
| Propietario | `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` en toda tabla de datos (mixin `UserOwnedMixin`). |
| Aislamiento en BD **(nuevo)** | Cada tabla de datos tiene `UNIQUE (user_id, id)`. Toda FK entre tablas de datos es compuesta: `(user_id, <col>) → <tabla>(user_id, id)`. Una FK con columna nula no se verifica (`MATCH SIMPLE`), así que las referencias opcionales funcionan. |
| Sync | Mixin `SyncColumnsMixin`: `created_at`, `updated_at`, `deleted_at` (`TIMESTAMPTZ`), más `server_updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`. Índice (`user_id`, `server_updated_at`) en cada tabla de datos. |
| Dinero | `NUMERIC(14,2)` ↔ `Decimal`. |
| Tasas | `NUMERIC(7,4)` (CDT) y `NUMERIC(5,2)` (retención). |
| Enums | `VARCHAR(n)` + `CHECK (col IN (...))`, con nombre `ck_<tabla>_<col>`. |
| Nombres de restricciones | Convención de nombres de SQLAlchemy (`pk_`, `fk_`, `uq_`, `ix_`, `ck_`) para que Alembic genere migraciones estables. |

## Tablas de autenticación (solo servidor)

### `users`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | UUID | PK |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE. Se guarda normalizado (`strip().lower()`). |
| `password_hash` | VARCHAR(255) | NOT NULL. Argon2id (formato PHC). |
| `display_name` | VARCHAR(100) | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` **(nuevo)** | TIMESTAMPTZ | NOT NULL DEFAULT now(). Cambia al restablecer la contraseña. |

No tiene columnas de sync: el usuario no se sincroniza.

### `refresh_tokens`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | NOT NULL FK → users ON DELETE CASCADE |
| `session_id` **(nuevo)** | UUID | NOT NULL. Lo genera el login; los sucesores lo heredan. Identifica la sesión de un dispositivo. |
| `token_hash` | CHAR(64) | NOT NULL, UNIQUE. SHA-256 hex del token opaco. |
| `expires_at` | TIMESTAMPTZ | NOT NULL. Emisión + 7 días. |
| `revoked_at` | TIMESTAMPTZ | NULL |
| `replaced_by_id` **(nuevo)** | UUID | NULL FK → refresh_tokens.id. Sucesor en la rotación. |
| `created_at` **(nuevo)** | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Índices: (`user_id`, `revoked_at`) y (`session_id`).

Un usuario puede tener varias sesiones activas a la vez (una por dispositivo o login), sin límite. En cada sesión hay como máximo un token vigente.

**Estados**:

```
vigente ──refresh──▶ rotado (revoked_at + replaced_by_id) ──reuso──▶ revoca todos los de su session_id
vigente ──logout───▶ revocado (revoked_at, sin sucesor; también el resto de su session_id)
vigente ──reuso detectado en su sesión──▶ revocado
vigente ──reset de contraseña──▶ revocado (todas las sesiones del usuario)
vigente ──expires_at < now──▶ vencido
```

Solo un token *vigente* (no revocado y no vencido) produce un par nuevo.

### `password_reset_codes` **(nuevo)**

Guarda el código enviado por correo y, una vez validado, el permiso de cambio.

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | NOT NULL FK → users ON DELETE CASCADE |
| `code_hash` | CHAR(64) | NOT NULL. `HMAC-SHA256(PASSWORD_RESET_PEPPER, "<user_id>:<código>")` hex. |
| `expires_at` | TIMESTAMPTZ | NOT NULL. Creación + 30 min. |
| `failed_attempts` | SMALLINT | NOT NULL DEFAULT 0, CHECK 0–5 |
| `used_at` | TIMESTAMPTZ | NULL. Código validado. |
| `invalidated_at` | TIMESTAMPTZ | NULL. Reemplazado, 5 fallos o envío fallido. |
| `grant_hash` | CHAR(64) | NULL, UNIQUE. SHA-256 del permiso de cambio. |
| `grant_expires_at` | TIMESTAMPTZ | NULL. `used_at` + 10 min. |
| `grant_used_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Índice: (`user_id`, `created_at`), que también cuenta el límite de 3 por hora.
CHECK: `grant_hash IS NULL OR used_at IS NOT NULL`.

**Estados del código**:

```
creado (vigente) ──verify OK──▶ usado (+ permiso vigente) ──reset OK──▶ permiso usado
creado ──verify fallido──▶ failed_attempts+1 ──(=5)──▶ invalidado
creado ──nuevo forgot / envío fallido──▶ invalidado
creado ──expires_at < now──▶ vencido
permiso vigente ──grant_expires_at < now──▶ vencido
```

- **Código vigente**: `used_at IS NULL AND invalidated_at IS NULL AND expires_at > now`. Solo se acepta el más reciente del usuario.
- **Permiso vigente**: `grant_hash = sha256(token) AND grant_used_at IS NULL AND grant_expires_at > now`.

### `login_attempts` **(nuevo)**

Fallos de inicio de sesión para el bloqueo por correo + IP. No es dato del usuario: el correo puede no existir.

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | BIGINT | PK identity |
| `email` | VARCHAR(255) | NOT NULL, normalizado |
| `ip` | INET | NOT NULL |
| `attempted_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

Índice: (`email`, `ip`, `attempted_at`).

**Reglas**:
- **Bloqueado**: `COUNT(*) >= 5` con `attempted_at > now − 15 min` para (`email`, `ip`). `Retry-After` = segundos hasta que el 5.º fallo más reciente cumpla 15 min.
- **Login exitoso**: borra las filas de (`email`, `ip`).
- **Reset de contraseña**: borra todas las filas del `email`.
- **Purga**: se borran las filas con `attempted_at < now − 1 día`.

## Tablas de finanzas (de `docs/db-finanzas.md`)

Todas llevan `UserOwnedMixin` + `SyncColumnsMixin` + `UNIQUE (user_id, id)`. Abajo aparecen solo las FKs compuestas, CHECKs e índices que el servidor implementa. Las columnas son las del documento.

Orden de creación en la migración inicial, sin ciclos: `users` → `refresh_tokens`, `password_reset_codes`, `login_attempts` → `accounts` → `categories` → `reimbursement_groups` → `subscriptions` → `recurring_incomes` → `cdts` → `assets` → `transactions`.

### `accounts` (§1)
- **FK**: (`user_id`, `parent_account_id`) → accounts.
- **CHECK**:
  - `type IN (CHECKING, SAVINGS, CASH, CREDIT_CARD, POCKET, INVESTMENT)`
  - `nature IN (ASSET, LIABILITY)`
  - `type <> 'CREDIT_CARD' OR nature = 'LIABILITY'`
  - `statement_day` y `payment_due_day` entre 1 y 31 o NULL
  - `parent_account_id <> id`
- **Defaults**: `currency CHAR(3) DEFAULT 'COP'`, `opening_balance DEFAULT 0`, booleanos `DEFAULT FALSE`, `sort_order DEFAULT 0`.
- La regla de un solo nivel de subcuentas no se puede expresar con un CHECK y se valida en el servicio (feature de datos).

### `categories` (§2)
- **CHECK**: `kind IN (INCOME, EXPENSE)`.
- **Único parcial** (research R16): (`user_id`, `name`, `kind`) `WHERE deleted_at IS NULL`.
- **Índice**: (`user_id`, `kind`, `sort_order`), para el listado.

### `reimbursement_groups` (§4)
- **CHECK**: `kind IN (REIMBURSEMENT, ADVANCE)`, `status IN (OPEN, SUBMITTED, SETTLED)`.

### `subscriptions` (§5)
- **FK**: (`user_id`, `account_id`) → accounts y (`user_id`, `category_id`) → categories.
- **CHECK**:
  - `amount > 0`
  - `billing_cycle IN (MONTHLY, YEARLY)`
  - `billing_day` entre 1 y 31
  - `billing_month` entre 1 y 12 o NULL
  - `billing_cycle <> 'YEARLY' OR billing_month IS NOT NULL`
  - `status IN (ACTIVE, PAUSED, CANCELLED)`

### `recurring_incomes` (§8)
- **FK**: (`user_id`, `account_id`) → accounts y (`user_id`, `category_id`) → categories.
- **CHECK**:
  - `expected_amount > 0`
  - `cycle IN (MONTHLY, YEARLY)`
  - `expected_day` entre 1 y 31
  - `expected_month` entre 1 y 12 o NULL
  - `cycle <> 'YEARLY' OR expected_month IS NOT NULL`
  - `status IN (ACTIVE, PAUSED)`
- Que la categoría sea de tipo `INCOME` se valida en el servicio, porque la FK no puede filtrar por tipo.

### `cdts` (§6)
- **FK**:
  - (`user_id`, `account_id`) → accounts (UNIQUE)
  - (`user_id`, `source_account_id`) → accounts
  - (`user_id`, `payout_account_id`) → accounts
  - (`user_id`, `renewed_from_cdt_id`) → cdts
- **CHECK**:
  - `principal > 0`
  - `term_days > 0`
  - `matures_on >= opened_on`
  - `interest_payment IN (AT_MATURITY, MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL)`
  - `status IN (ACTIVE, MATURED, RENEWED, CANCELLED)`
- **Default**: `withholding_rate DEFAULT 4.00`.

### `assets` (§7)
- **CHECK**: `value >= 0`.

### `transactions` (§3)
- **FK**:
  - (`user_id`, `account_id`) y (`user_id`, `counter_account_id`) → accounts
  - (`user_id`, `category_id`) → categories
  - (`user_id`, `reimbursement_group_id`) → reimbursement_groups
  - (`user_id`, `subscription_id`) → subscriptions
  - (`user_id`, `recurring_income_id`) → recurring_incomes
  - (`user_id`, `cdt_id`) → cdts
- **CHECK**:
  - `type IN (INCOME, EXPENSE, TRANSFER)`
  - `amount > 0`
  - `(type = 'TRANSFER') = (counter_account_id IS NOT NULL)`
  - `counter_account_id IS NULL OR counter_account_id <> account_id`
  - `category_source IN (MANUAL, AI)`
  - `(recurring_income_id IS NULL) = (recurring_income_period IS NULL)`
  - `recurring_income_id IS NULL OR type = 'INCOME'`
  - `subscription_period` y `recurring_income_period` con formato `^\d{4}(-\d{2})?$` o NULL
- **UNIQUE**: (`subscription_id`, `subscription_period`).
- **Índices**: los de `docs/db-finanzas.md` §3, más (`user_id`, `server_updated_at`).

## Categorías iniciales del usuario (FR-016)

Se crean cada vez que se registra un usuario, en la misma transacción que el usuario (`UserRegistrationService.register`). Hoy la única vía de registro es la seed; cualquier vía futura usa el mismo servicio. Ícono (Ionicons) y color reutilizan los del cliente cuando la categoría ya existe en [`seed.ts`](../../apps/mobile/src/modules/finance/data/mock/seed.ts); el resto son nuevos.

| sort_order | Nombre | kind | icon | color |
|---|---|---|---|---|
| 0 | Transporte | EXPENSE | car-outline | #06B6D4 |
| 1 | Alimentación | EXPENSE | restaurant-outline | #F97316 |
| 2 | Entretenimiento | EXPENSE | film-outline | #EC4899 |
| 3 | Suscripciones | EXPENSE | repeat-outline | #6366F1 |
| 4 | Servicios | EXPENSE | flash-outline | #EAB308 |
| 5 | Mercado | EXPENSE | cart-outline | #F59E0B |
| 6 | Combustible | EXPENSE | speedometer-outline | #EF4444 |
| 7 | Parqueadero | EXPENSE | location-outline | #64748B |
| 8 | Salud | EXPENSE | medkit-outline | #10B981 |
| 9 | Fitness | EXPENSE | barbell-outline | #D946EF |
| 10 | Viajes | EXPENSE | airplane-outline | #0EA5E9 |
| 11 | Ropa | EXPENSE | shirt-outline | #A855F7 |
| 0 | Salario | INCOME | briefcase-outline | #22C55E |
| 1 | Rendimientos | INCOME | trending-up-outline | #84CC16 |
| 2 | Otros ingresos | INCOME | cash-outline | #14B8A6 |

`created_at` = `updated_at` = `server_updated_at` = el momento del registro, y `deleted_at` = NULL. Cada usuario recibe sus propias filas, con IDs uuid4 distintos.

## DTOs expuestos (camelCase)

El detalle está en [contracts/http-api.md](./contracts/http-api.md).

- **UserProfile**: `id`, `email`, `displayName`, `createdAt`.
- **Category**: `id`, `name`, `kind`, `icon`, `color`, `sortOrder`, `createdAt`, `updatedAt`, `deletedAt` (siempre `null` en el listado), `serverUpdatedAt`. Nunca incluye `userId`.
- **TokenPair**: `accessToken`, `refreshToken`, `tokenType` (`"bearer"`), `expiresIn` (900), `refreshExpiresIn` (604800).
