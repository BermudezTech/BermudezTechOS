# Data Model — 008 Mejoras de UI en Finanzas

Sin cambios de esquema en SQLite ni en PostgreSQL. Este documento recoge las reglas nuevas sobre entidades existentes y los tipos de cliente (no persistidos) que introduce la feature.

## Category (existente, tabla `categories`)

| Campo | Tipo (cliente) | Regla nueva |
|---|---|---|
| `id` | UUID (cliente) | sin cambios |
| `name` | string | Obligatorio; `trim()` y de 1 a 50 caracteres. Único entre categorías activas (`deletedAt = null`) del mismo `kind` según `normalizeCategoryName` (minúsculas, sin tildes, sin espacios extremos). |
| `kind` | `'INCOME' \| 'EXPENSE'` | Se fija al crear; **inmutable** al editar (FR-013). |
| `icon` | string \| null | Al crear: obligatorio y del catálogo (`iconCatalog`). Al editar: del catálogo o el valor almacenado sin cambios. |
| `color` | string \| null | Al crear: obligatorio y de `categoryPalette`. Al editar: de la paleta o el valor almacenado sin cambios. |
| `sortOrder` | number | Al crear: `max(sortOrder de su kind) + 1` (o 0); no editable en esta feature. |
| `createdAt`, `updatedAt`, `deletedAt`, `isDirty` | sync | Gestionados por `insert`/`patch` del store. Esta feature no borra categorías. |

**Ciclo de vida**: `creada → editada*`. No hay archivado ni borrado desde la UI (Clarifications 2026-10-31).

**Conflictos**: si el servidor rechaza un PUSH con `DUPLICATE` (índice `uq_categories_user_name_kind`), se muestra con la UI de rechazos de la spec 006 (renombrar o descartar el cambio local).

## IconCatalogEntry (estático, cliente)

| Campo | Tipo | Notas |
|---|---|---|
| `name` | `IconName` | Nombre Ionicons; debe existir en `Ionicons.glyphMap`. |
| `label` | string | Nombre en español mostrado en accesibilidad. |
| `keywords` | string[] | Términos en español, en minúsculas y sin tildes, para la búsqueda. |
| `group` | `IconGroupId` | Uno de los 14 grupos (R6). |

Invariantes: ≥ 80 entradas, sin `name` duplicados e incluye todos los íconos de las categorías por defecto del servidor.

## CategoryColor (estático, tema)

`theme.colors.categoryPalette: string[]` (tipo existente, compartido con el selector de color de `AccountForm` y con las gráficas), ampliado a 20 entradas. Los nombres en español para accesibilidad van en un mapa aparte, `paletteColorLabels: Record<string, string>`, dentro del módulo de categorías. Invariantes: hex válido, sin duplicados, incluye los colores por defecto del servidor, cumple el piso de contraste sobre `surfaceSolid` (≥ 1.8:1 en claro, ≥ 3:1 en oscuro; el color es decorativo y siempre va con el nombre, R8), y cada color tiene etiqueta.

## Period (existente, `lib/dates`)

`{ granularity: 'MONTH' | 'YEAR'; anchor: IsoDate }`. Se reutiliza en Ingresos, Balance y el selector del Resumen (este último siempre en `MONTH`).

## SummaryMonthState (en memoria, no persistido)

| Campo | Tipo | Notas |
|---|---|---|
| `selected` | `IsoDate \| null` | Primer día del mes elegido; `null` = mes en curso (sigue al reloj, R1). |

Transiciones: `prev()` y `next()` restringidas a `[firstActivityMonth, mes en curso]`; `select(month)`; `reset()` → `null`. Seleccionar el mes en curso guarda `null`.

## NetWorthRange (estado de pantalla, no persistido)

`'6M' | '12M' | '24M' | 'ALL'`; por defecto `'12M'`. Meses mostrados = `min(N, mesesDesde(firstNetWorthMonth, hoy) + 1)`, o todo el historial con `'ALL'`. Sin datos: 1 punto (el mes en curso).

## Reportes derivados (no persistidos)

- **CategoryFlowReport** (generaliza `SpendingReport`): `{ kind, period, total, previousTotal, delta, items: CategoryFlowItem[] }`. Los ítems tienen la forma actual de `SpendingItem`.
- **BalanceReport**: `{ period, income, expense, balance, previousBalance, balanceDelta: BalanceDelta, incomeDelta, expenseDelta }`.
- **BalanceEvolutionPoint**: `{ period, income, expense, balance }` (todos `Cents`).

Reglas de inclusión (FR-002), las mismas en todos los reportes: ingreso = `isPersonalIncome`, gasto = `isPersonalExpense`. Ambas excluyen borrados, transferencias (incluido el pago de tarjeta) y movimientos con grupo de reembolso.
