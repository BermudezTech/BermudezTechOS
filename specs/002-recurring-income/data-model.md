# Data Model: Ingresos recurrentes

Forma en el cliente (TypeScript, store en memoria). La tabla de servidor está en [`docs/db-finanzas.md` §8](../../docs/db-finanzas.md). Campos de sync (`id`, `createdAt`, `updatedAt`, `deletedAt`) como en la spec 001.

## RecurringIncome (nueva)

| Campo | Tipo | Reglas |
|---|---|---|
| `accountId` | `string` | Obligatorio; cuenta existente y no borrada. |
| `categoryId` | `string \| null` | Opcional; categoría `kind = INCOME`. |
| `name` | `string` | 1–100. |
| `icon` | `string \| null` | |
| `expectedAmount` | `Cents` | > 0. |
| `cycle` | `'MONTHLY' \| 'YEARLY'` | |
| `expectedDay` | `number` | 1–31; si el mes es más corto, el último día. |
| `expectedMonth` | `number \| null` | 1–12; obligatorio en `YEARLY`, `null` en `MONTHLY`. |
| `startDate` | `IsoDate` | |
| `status` | `'ACTIVE' \| 'PAUSED'` | Solo `ACTIVE` aparece en el selector. |

**Transiciones**: `ACTIVE ⇄ PAUSED`; borrado lógico desde cualquier estado.

## Transaction (cambios)

| Campo nuevo | Tipo | Reglas |
|---|---|---|
| `recurringIncomeId` | `string \| null` | Solo si `type = INCOME`; plantilla existente (puede estar borrada en registros históricos). |
| `recurringIncomePeriod` | `string \| null` | `YYYY-MM` o `YYYY` según `cycle`; obligatorio si y solo si hay `recurringIncomeId`. Se deriva de la fecha local al guardar. Sin unicidad. |

## Relaciones

```text
Account 1─* RecurringIncome       Category(INCOME) 1─* RecurringIncome
RecurringIncome 1─* Transaction(INCOME)
```

## Funciones del dominio (puras, con pruebas)

| Función | Regla |
|---|---|
| `periodFor(cycle, localDate)` | `MONTHLY` → `YYYY-MM`; `YEARLY` → `YYYY`. |
| `hasEntryInPeriod(txs, id, period, excludeId?)` | ¿Existe un movimiento no borrado con ese vínculo y periodo (excluyendo el que se edita)? |
| `prefillFrom(recurringIncome, today)` | `{ amount, accountId, categoryId, description: name, date: today }`. |
| `expectedDateIn(recurringIncome, period)` | Fecha esperada con el día ajustado al fin de mes (para mostrar en la lista). |

## Seed

"Salario" (mensual, día 30, cuenta de nómina, categoría Salario) y sus ingresos de los meses de prueba vinculados con su periodo, alguno con valor distinto al esperado.
