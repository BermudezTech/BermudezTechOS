# Data Model — 001-finance-ui-mockup

Modelo **del cliente** para los datos de prueba en memoria. Refleja el esquema lógico de
[`docs/db-finanzas.md`](../../docs/db-finanzas.md) para que la futura capa SQLite lo sustituya sin
cambiar pantallas (FR-031). No es un diseño de base de datos: no hay tablas, índices ni migraciones.

## Convenciones

| Concepto | Representación en el cliente |
|---|---|
| ID | `string` UUID v4 (generado en cliente; fijo en el seed) |
| Dinero | `Cents` — entero en centavos, siempre ≥ 0 en las entidades; el signo lo da el contexto |
| Fecha/hora | `IsoDateTime` — string ISO-8601 en UTC (`2026-10-17T14:05:00Z`) |
| Fecha | `IsoDate` — string `YYYY-MM-DD` |
| Moneda | `'COP'` (única en el MVP) |
| Nombres de campos | camelCase (las columnas del servidor serán snake_case) |
| `user_id` | **No existe** en el cliente (Principio III) |

Todas las entidades sincronizables extienden:

```ts
interface SyncFields {
  id: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null; // borrado lógico: las consultas lo excluyen
}
```

`isDirty` y `serverUpdatedAt` no se modelan en esta fase (no hay sincronización).

## Entidades

### Account (§1, §3, §10)

| Campo | Tipo | Reglas |
|---|---|---|
| `parentAccountId` | `string \| null` | Si tiene valor es subcuenta (cajita). Un solo nivel. El padre no puede ser `CREDIT_CARD` ni `POCKET`. |
| `name` | `string` | 1–100 caracteres, obligatorio. |
| `type` | `'CHECKING' \| 'SAVINGS' \| 'CASH' \| 'CREDIT_CARD' \| 'POCKET' \| 'INVESTMENT'` | `POCKET` ⇔ `parentAccountId` no nulo. |
| `nature` | `'ASSET' \| 'LIABILITY'` | Derivada del tipo: `CREDIT_CARD` ⇒ `LIABILITY`; resto ⇒ `ASSET`. No editable. |
| `currency` | `'COP'` | |
| `icon`, `color` | `string \| null` | Token de ícono y de color del tema. |
| `openingBalance` | `Cents` | ≥ 0. En tarjetas = deuda inicial. |
| `creditLimit` | `Cents \| null` | Obligatorio y > 0 solo en `CREDIT_CARD`. |
| `statementDay`, `paymentDueDay` | `number \| null` | 1–31, solo `CREDIT_CARD`. |
| `isExcludedFromNetWorth` | `boolean` | |
| `isArchived` | `boolean` | Oculta de listas por defecto; filtro "Archivadas". |
| `sortOrder` | `number` | |

### Category (§2, §6, §11)

| Campo | Tipo | Reglas |
|---|---|---|
| `name` | `string` | 1–50, único por `kind`. |
| `kind` | `'INCOME' \| 'EXPENSE'` | |
| `icon`, `color` | `string \| null` | |
| `sortOrder` | `number` | |

Seed: Alimentación, Transporte, Hogar, Servicios, Salud, Educación, Entretenimiento, Compras,
Suscripciones (egreso); Salario, Honorarios, Rendimientos, Otros ingresos (ingreso).

### Transaction (§2, §3, §4, §5, §6)

| Campo | Tipo | Reglas |
|---|---|---|
| `accountId` | `string` | Obligatorio; cuenta no archivada al crear. Origen en transferencias. |
| `counterAccountId` | `string \| null` | Obligatorio **si y solo si** `type = 'TRANSFER'`; ≠ `accountId`. |
| `type` | `'INCOME' \| 'EXPENSE' \| 'TRANSFER'` | |
| `amount` | `Cents` | > 0; entrada con máx. 2 decimales; ≤ 99.999.999.999.999 centavos. |
| `categoryId` | `string \| null` | `null` en transferencias o "Sin categoría". Su `kind` debe coincidir con el tipo. |
| `categorySource` | `'MANUAL' \| 'AI'` | Al cambiar o confirmar la categoría ⇒ `'MANUAL'` (FR-020). |
| `occurredAt` | `IsoDateTime` | Por defecto ahora. |
| `description` | `string \| null` | ≤ 500 caracteres. |
| `reimbursementGroupId` | `string \| null` | No aplica a transferencias. |
| `subscriptionId`, `subscriptionPeriod` | `string \| null` | `YYYY-MM` o `YYYY`. Solo en débitos de suscripción del seed. |
| `cdtId` | `string \| null` | Apertura, intereses, retención o pago de un CDT. |

### Subscription (§4)

| Campo | Tipo | Reglas |
|---|---|---|
| `accountId` | `string` | Cuenta o tarjeta de cobro. |
| `categoryId` | `string \| null` | Categoría de egreso. |
| `name`, `icon` | `string`, `string \| null` | Nombre 1–100. |
| `amount` | `Cents` | > 0. |
| `billingCycle` | `'MONTHLY' \| 'YEARLY'` | |
| `billingDay` | `number` | 1–31; si el mes es más corto se usa el último día. |
| `billingMonth` | `number \| null` | 1–12, obligatorio en `YEARLY`. |
| `startDate` | `IsoDate` | |
| `status` | `'ACTIVE' \| 'PAUSED' \| 'CANCELLED'` | Ver transiciones. |

### ReimbursementGroup (§5)

| Campo | Tipo | Reglas |
|---|---|---|
| `name` | `string` | 1–100. |
| `payer` | `string \| null` | |
| `kind` | `'REIMBURSEMENT' \| 'ADVANCE'` | |
| `status` | `'OPEN' \| 'SUBMITTED' \| 'SETTLED'` | Ver transiciones. |
| `notes` | `string \| null` | |

### Cdt (§10)

| Campo | Tipo | Reglas |
|---|---|---|
| `accountId` | `string` | Cuenta `INVESTMENT` 1:1 (se crea junto con el CDT). |
| `issuer` | `string` | Obligatorio. |
| `certificateNumber` | `string \| null` | |
| `principal` | `Cents` | > 0. |
| `annualRateEa`, `annualRateNominal` | `string` (decimal, %) | `"10.2500"`; 0 < tasa < 100. Se manejan con decimal.js. |
| `termDays` | `number` | > 0. |
| `openedOn`, `maturesOn` | `IsoDate` | `maturesOn` = `openedOn + termDays` por defecto, editable, > `openedOn`. |
| `interestPayment` | `'AT_MATURITY' \| 'MONTHLY' \| 'QUARTERLY' \| 'SEMIANNUAL' \| 'ANNUAL'` | |
| `withholdingRate` | `string` (decimal, %) | Por defecto `"4.00"`. |
| `sourceAccountId`, `payoutAccountId` | `string`, `string \| null` | Cuentas de activo. |
| `status` | `'ACTIVE' \| 'MATURED' \| 'RENEWED' \| 'CANCELLED'` | |
| `renewedFromCdtId` | `string \| null` | |

### Asset (§7)

| Campo | Tipo | Reglas |
|---|---|---|
| `name` | `string` | 1–100. |
| `value` | `Cents` | ≥ 0. |
| `validUntil` | `IsoDate` | Si es anterior a hoy ⇒ aviso "actualizar valor". |

### Entidades solo de UI (no sincronizables)

- **MockUser**: `{ displayName: string }` — un único usuario de prueba (saludo, Ajustes).
- **UiPreferences**: `{ themeMode: 'system' | 'light' | 'dark' }` — en memoria.
- **AppModule**: ver [contracts/navigation.md](./contracts/navigation.md).

## Relaciones

```text
Account 1─* Account (cajitas)        Account 1─* Transaction (accountId / counterAccountId)
Category 1─* Transaction             Category 1─* Subscription
Subscription 1─* Transaction         ReimbursementGroup 1─* Transaction
Cdt 1─1 Account (INVESTMENT)         Cdt 1─* Transaction        Cdt 0..1─1 Cdt (renovación)
```

## Valores derivados (funciones puras del dominio; nunca almacenados — FR-033)

| Valor | Regla |
|---|---|
| Saldo de cuenta | `openingBalance + ΣINCOME − ΣEXPENSE − ΣTRANSFER(sale) + ΣTRANSFER(entra)` sobre transacciones no borradas. En `LIABILITY` se presenta como deuda positiva: `deuda = −saldo`. |
| Saldo total de cuenta principal | Saldo propio + Σ saldos de sus cajitas. |
| Saldo disponible | Saldo total − Σ saldos de cajitas (= saldo propio). |
| Saldo disponible total (resumen) | Σ saldos disponibles de cuentas `ASSET` no archivadas, excluyendo `INVESTMENT`. |
| Tarjeta | Cupo disponible = `creditLimit − deuda`; % usado = `deuda / creditLimit`. |
| Gasto personal del periodo | Σ `EXPENSE` sin `reimbursementGroupId`, en el rango del periodo (zona local). Transferencias (incl. pago de tarjeta) quedan fuera por tipo. |
| Variación vs. periodo anterior | `(actual − anterior) / anterior`; sin anterior ⇒ "nuevo". |
| Patrimonio neto | Σ activos (cuentas `ASSET` + valor actual de CDTs + bienes) − Σ deudas (`LIABILITY`), excluyendo `isExcludedFromNetWorth`. |
| Evolución de patrimonio | Patrimonio recalculado al cierre de cada uno de los últimos 12 meses (bienes con su valor actual). |
| CDT — interés causado a la fecha | `principal × ((1 + EA)^(díasTranscurridos/365) − 1)`, con decimal.js, redondeado a centavos. |
| CDT — valor esperado neto | `principal + interésTotal × (1 − retención)`. |
| CDT — valor actual | `principal + interés causado − intereses ya pagados`. |
| Rendimiento promedio ponderado | `Σ(principal × EA) / Σ principal` sobre CDTs `ACTIVE`. |
| Próximo cobro de suscripción | Siguiente fecha ≥ hoy según `billingCycle`, `billingDay` (ajustado al último día del mes), `billingMonth`. |
| Total mensual equivalente | Σ activas: mensual + anual/12 (decimal.js, half-up a centavos). |
| Saldo de grupo | Σ `INCOME` − Σ `EXPENSE` del grupo. `< 0` "Te deben", `> 0` "Tienes de terceros", `= 0` "Saldado". |

## Transiciones de estado

```text
Subscription:        ACTIVE ⇄ PAUSED ;  ACTIVE|PAUSED → CANCELLED (final)
ReimbursementGroup:  OPEN → SUBMITTED → SETTLED ;  OPEN → SETTLED   (SETTLED solo si saldo = 0)
Cdt:                 ACTIVE → MATURED | RENEWED | CANCELLED  (RENEWED crea un CDT nuevo con renewedFromCdtId)
Account:             activa ⇄ archivada ; eliminar (deletedAt) solo sin movimientos ni cajitas
Transaction:         eliminar ⇒ deletedAt (los saldos se recalculan)
```

## Requisitos del seed (FR-030)

- Usuario de prueba con nombre.
- Cuentas: 1 corriente, 2 ahorros (una con 2 cajitas), 1 efectivo, 2 tarjetas de crédito, 1 cuenta
  excluida del patrimonio, 1 archivada, 2 cuentas `INVESTMENT` de CDT.
- ≥ 13 meses de movimientos relativos a hoy (≈ 300), con todas las categorías, transferencias,
  pagos de tarjeta, al menos 3 con `categorySource = 'AI'` y algunos "Sin categoría".
- 2 CDTs activos (uno vence en ≤ 15 días) y 1 vencido.
- 4 suscripciones: 3 mensuales (una pausada) y 1 anual; una con `billingDay = 31`.
- 1 grupo `REIMBURSEMENT` abierto (saldo negativo), 1 `ADVANCE` abierto (saldo positivo), 1 saldado.
- 2 bienes, uno con `validUntil` vencido.
- Un modo **vacío** (seed sin registros) seleccionable desde Ajustes para revisar estados vacíos.
