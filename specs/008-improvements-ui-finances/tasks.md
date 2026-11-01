---
description: "Lista de tareas de 008 Mejoras de UI en Finanzas"
---

# Tasks: Mejoras de UI en Finanzas (meses anteriores, categorías y periodos de patrimonio)

**Input**: documentos de diseño en `specs/008-improvements-ui-finances/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: se incluyen. La constitución ("Flujo y calidad") exige pruebas automatizadas para la lógica de montos y saldos, y el quickstart define la cobertura. Las pruebas son Jest (`jest-expo`) junto al archivo (`*.test.ts[x]`), se escriben antes de la implementación y deben fallar primero.

**Organization**: por historia de usuario (US1–US5 de spec.md), cada una con su prueba independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivo distinto, sin dependencias pendientes)
- **[Story]**: US1–US5
- Todas las rutas son relativas a la raíz del repo; el código vive en `apps/mobile/src/`.

---

## Phase 1: Setup

**Purpose**: nada que instalar (no hay dependencias nuevas); solo comprobar el punto de partida.

- [X] T001 Ejecutar `npm run typecheck && npm test` en `apps/mobile` y anotar en el PR cualquier fallo previo, para no confundirlo con regresiones de esta feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: utilidades de periodo y cálculo compartidas por US1, US2, US3 y US5.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

### Tests

- [X] T002 [P] Pruebas de `clampPeriod`, `isSamePeriod` y `monthsByYear` en `apps/mobile/src/lib/dates.test.ts`. Casos: ajuste por debajo de `min` y por encima del periodo en curso; `min = null`; MONTH y YEAR; `monthsByYear('2025-11-01','2026-02-01')` → `[{year:2026, months:['2026-02-01','2026-01-01']},{year:2025, months:['2025-12-01','2025-11-01']}]` (descendente, agrupado por año).
- [X] T003 [P] Pruebas del reporte generalizado en `apps/mobile/src/modules/finance/domain/spending.test.ts`. Casos: `categoryFlowReport(…,'INCOME')` agrupa ingresos por categoría con `pct` y `delta`; los ingresos sin categoría salen como "Sin categoría"; se excluyen transferencias, pagos de tarjeta y movimientos con `reimbursementGroupId`; para cualquier periodo, `categoryFlowReport(…,'INCOME').total === monthSummary(…).income` y `categoryFlowReport(…,'EXPENSE').total === monthSummary(…).expense` (SC-002). Las pruebas existentes de `spendingReport`, `spendingEvolution` y `categoryTransactions` siguen pasando sin cambios.
- [X] T004 [P] Pruebas de `firstActivityMonth` en `apps/mobile/src/modules/finance/domain/monthSummary.test.ts`. Casos: devuelve el primer día del mes local (America/Bogota) del ingreso o gasto personal más antiguo; ignora transferencias, reembolsables y borrados; devuelve `null` sin movimientos; un movimiento a las 23:30 del 31 en Bogotá (04:30 UTC del día 1) pertenece al mes de Bogotá.

### Implementation

- [X] T005 [P] Implementar `clampPeriod(period, min, today?)`, `isSamePeriod(a, b)` y `monthsByYear(from, to)` en `apps/mobile/src/lib/dates.ts` según [contracts/domain.md](./contracts/domain.md) §Límites de periodo
- [X] T006 Refactorizar `apps/mobile/src/modules/finance/domain/spending.ts`:
  - Añadir `isPersonalFlow(t, kind)`, `categoryFlowReport`, `categoryFlowEvolution` (count = 6) y `categoryFlowTransactions`, parametrizados por `kind: CategoryKind` (importar `isPersonalIncome` de `monthSummary.ts` sin crear un ciclo; si hace falta, mover ambos predicados a un nuevo `domain/flows.ts`).
  - Renombrar los tipos a `CategoryFlowReport` / `CategoryFlowItem`, con alias `SpendingReport` / `SpendingItem`.
  - Dejar `spendingReport`, `spendingEvolution` y `categoryTransactions` como envoltorios de `'EXPENSE'` (R4).
- [X] T007 Implementar `firstActivityMonth(transactions)` en `apps/mobile/src/modules/finance/domain/monthSummary.ts` (R2)
- [X] T008 Añadir `useFirstActivityMonth()` en `apps/mobile/src/modules/finance/hooks/useMonthSummary.ts` (memoizado sobre `useActiveTransactions`). Cambiar `useMonthSummary(period?)` para que acepte un periodo opcional: sin argumento usa el mes en curso, como hoy.
- [X] T009 Añadir a `PeriodSwitcher` la prop opcional `min?: IsoDate | null` en `apps/mobile/src/modules/finance/components/spending/PeriodSwitcher.tsx`. Hace falta:
  - deshabilitar "Periodo anterior" (opacidad 0.35, `pointerEvents='none'` y `accessibilityState.disabled`) cuando el periodo anterior caería antes de `min`;
  - en YEAR, comparar con el año de `min`;
  - al cambiar de MONTH a YEAR o al revés, pasar el resultado por `clampPeriod`.
- [X] T010 Usar `PeriodSwitcher min={useFirstActivityMonth()}` en `apps/mobile/src/app/(app)/(tabs)/finance/spending/index.tsx` y ajustar el periodo leído de la URL con `clampPeriod` antes de calcular (contracts/navigation.md: anchor fuera de rango)

**Checkpoint**: `npm test` pasa; Gastos por categoría funciona igual que antes, pero ya no permite retroceder antes del primer mes con movimientos.

---

## Phase 3: User Story 1 - Cambiar el mes de las estadísticas del Resumen (Priority: P1) 🎯 MVP

**Goal**: el Resumen tiene un selector de mes (flechas y lista agrupada por año) que cambia las tarjetas de ingresos, gastos y balance; al tocar una tarjeta se abre su detalle en ese mes.

**Independent Test**: quickstart P1. Con datos de varios meses, elegir un mes anterior y comprobar que los tres totales coinciden con los movimientos de ese mes; los límites de las flechas y la lista; la vuelta al mes en curso al reiniciar.

### Tests for User Story 1

- [X] T011 [P] [US1] Pruebas del store en `apps/mobile/src/modules/finance/hooks/useSummaryMonth.test.ts`:
  - `selected` arranca en `null` y el mes en curso se deriva de `todayLocal()`;
  - `prev()` / `next()` respetan `[firstActivityMonth, mes en curso]` y `canPrev` / `canNext` lo reflejan;
  - con `firstActivityMonth = null`, ambos quedan en `false`;
  - `select(mes en curso)` guarda `null`, y `reset()` → `null`;
  - con `selected = null`, simular el cambio de mes (mock de `todayLocal`) mueve el mes mostrado al nuevo; con un mes explícito, se conserva.

### Implementation for User Story 1

- [X] T012 [US1] Crear el store Zustand **no persistido** `useSummaryMonth` en `apps/mobile/src/modules/finance/hooks/useSummaryMonth.ts`. Estado `selected: IsoDate | null` (`null` = mes en curso). El hook devuelve `{ month, isCurrent, canPrev, canNext, prev, next, select, reset, minMonth }` según [contracts/domain.md](./contracts/domain.md) §Hooks y data-model §SummaryMonthState.
- [X] T013 [P] [US1] Crear `MonthPickerSheet` en `apps/mobile/src/modules/finance/components/summary/MonthPickerSheet.tsx`:
  - `Modal` + `GlassSurface` + `SectionList`, siguiendo el patrón de `components/ui/form/Select.tsx`;
  - una sección por año (de la más reciente a la más antigua) con los meses de `monthsByYear(minMonth, mesEnCurso)` en orden descendente, con la etiqueta de mes capitalizada en español;
  - el mes seleccionado marcado con check y `accessibilityState.selected`;
  - al tocar un mes llama a `onSelect` y se cierra; cierre por fondo o botón "Cerrar".
- [X] T014 [US1] Crear `MonthSelector` en `apps/mobile/src/modules/finance/components/summary/MonthSelector.tsx`, que lee `useSummaryMonth`:
  - `IconButton` "Mes anterior" y "Mes siguiente", deshabilitados según `canPrev` / `canNext`;
  - en el centro, el nombre del mes (`periodLabel`, capitalizado) como botón accesible ("Elegir mes, octubre 2026") que abre `MonthPickerSheet`;
  - un enlace "Mes actual" visible solo si `!isCurrent`, que llama a `reset()`;
  - `accessibilityLiveRegion="polite"` en la etiqueta.
- [X] T015 [US1] Renderizar `<MonthSelector />` encima de la cuadrícula de estadísticas en `apps/mobile/src/app/(app)/(tabs)/finance/index.tsx`. Las tarjetas con `order < 10` van después del selector y `RecentTransactionsCard` (order 10) queda igual. El selector no se muestra si no hay tarjetas.
- [X] T016 [US1] Sustituir `useCurrentMonthRange` por `useMonthRange(month)` (primer y último día del mes indicado) en `apps/mobile/src/modules/finance/hooks/useMonthSummary.ts`, que usarán las tarjetas (T017–T019)
- [X] T017 [P] [US1] Actualizar `MonthIncomeCard` en `apps/mobile/src/modules/finance/components/summary/MonthIncomeCard.tsx`:
  - usar `useMonthSummary({granularity:'MONTH', anchor: month})` con el mes de `useSummaryMonth`;
  - etiqueta "Ingresos del mes" si `isCurrent`, y si no, `Ingresos · <mes año>`;
  - `href` a Movimientos con `from` / `to` del mes seleccionado (lo cambia US2 en T027).
- [X] T018 [P] [US1] Actualizar `MonthSpendingCard` en `apps/mobile/src/modules/finance/components/summary/MonthSpendingCard.tsx` igual que T017: etiqueta `Gastos · <mes año>` y `href` a `/finance/spending?granularity=MONTH&anchor=<mes>`
- [X] T019 [P] [US1] Actualizar `MonthBalanceCard` en `apps/mobile/src/modules/finance/components/summary/MonthBalanceCard.tsx` igual que T017: etiqueta `Balance · <mes año>` y `href` a Movimientos del mes seleccionado (lo cambia US3 en T035)

**Checkpoint**: quickstart P1 pasos 1–4, 6 y 7 se cumplen. En el paso 5, Gastos abre su pantalla en el mes elegido, e Ingresos y Balance abren Movimientos filtrados a ese mes hasta que lleguen US2 y US3.

---

## Phase 4: User Story 2 - Pantalla dedicada de ingresos por categoría (Priority: P2)

**Goal**: `/finance/income` simétrica a Gastos por categoría, con detalle por categoría, accesible desde el menú y desde la tarjeta de ingresos.

**Independent Test**: quickstart P2. Alternar Mes/Año, navegar entre periodos con los límites, ver el detalle de una categoría, "Sin categoría" y el estado vacío.

### Tests for User Story 2

- [X] T020 [P] [US2] Pruebas de `categoryFlowEvolution(…,'INCOME', 6)` y `categoryFlowTransactions(…,'INCOME')` en `apps/mobile/src/modules/finance/domain/spending.test.ts`: 6 puntos del más antiguo al actual; solo ingresos personales de la categoría (o `null`), ordenados del más reciente al más antiguo

### Implementation for User Story 2

- [X] T021 [P] [US2] Crear `useIncomeByCategory(period)` y `useCategoryIncome(categoryId, period)` en `apps/mobile/src/modules/finance/hooks/useIncome.ts`, con el mismo patrón y la misma memoización que `useSpending.ts`
- [X] T022 [P] [US2] Añadir la prop `basePath: '/finance/spending' | '/finance/income'` a `CategoryBreakdownList` en `apps/mobile/src/modules/finance/components/spending/CategoryBreakdownList.tsx` (hoy la ruta está fija a spending) y pasar `basePath="/finance/spending"` desde `spending/index.tsx`
- [X] T023 [P] [US2] Añadir a `EvolutionChart` las props `accessibilityPrefix: string` (hoy "Evolución del gasto") y `color?: string` (por defecto `theme.colors.accent`) en `apps/mobile/src/modules/finance/components/spending/EvolutionChart.tsx`, y actualizar el uso en `spending/index.tsx`
- [X] T024 [US2] Crear la pantalla `apps/mobile/src/app/(app)/(tabs)/finance/income/index.tsx` siguiendo la estructura de `spending/index.tsx`:
  - título "Ingresos por categoría" y subtítulo "Sin transferencias ni reembolsables";
  - `PeriodSwitcher` con `min` y periodo ajustado con `clampPeriod`;
  - tarjeta "Ingreso total · <periodo>" con `DeltaText goodWhen="up"`;
  - `CategoryDonut` + `CategoryBreakdownList basePath="/finance/income"`;
  - estado vacío "Sin ingresos en este periodo" (ícono `cash-outline`);
  - `EvolutionChart` con `color={theme.colors.income}` y el título "Últimos 6 meses" o "Últimos 6 años".
- [X] T025 [US2] Crear `apps/mobile/src/app/(app)/(tabs)/finance/income/[categoryId].tsx` siguiendo `spending/[categoryId].tsx` (`none` = sin categoría; `fallback="/finance/income"`; mensaje vacío "No hay ingresos de esta categoría en el periodo") con `useCategoryIncome`
- [X] T026 [US2] Añadir la sección `income` a `financeSections` en `apps/mobile/src/modules/finance/sections.ts` (label "Ingresos por categoría", description "Mensual y anual, con evolución", icon `arrow-down-circle-outline`, route `/finance/income`), situada antes de `spending`, y mover allí la tarjeta `month-income` (order 1) desde `transactions`
- [X] T027 [US2] Cambiar el `href` de `MonthIncomeCard` a `/finance/income?granularity=MONTH&anchor=<mes seleccionado>` en `apps/mobile/src/modules/finance/components/summary/MonthIncomeCard.tsx` (FR-005)

**Checkpoint**: quickstart P2 completo; la tarjeta de ingresos abre la pantalla nueva en el mes seleccionado.

---

## Phase 5: User Story 3 - Pantalla dedicada de balance (Priority: P2)

**Goal**: `/finance/balance` con balance, ingresos, gastos, variación y evolución de 6 periodos, accesible desde el menú y desde la tarjeta de balance.

**Independent Test**: quickstart P3. En cada periodo, balance = ingresos − gastos; déficit resaltado; variación absoluta si el balance anterior ≤ 0; las filas llevan a Ingresos y Gastos con el mismo periodo.

### Tests for User Story 3

- [X] T028 [P] [US3] Pruebas de `balanceReport` y `balanceEvolution` en `apps/mobile/src/modules/finance/domain/monthSummary.test.ts`:
  - `balance === income − expense` en `Cents` exactos;
  - `balanceDelta`: `null` si ambos balances son 0; `{kind:'abs', value: actual − anterior}` si el anterior ≤ 0; `{kind:'pct'}` en otro caso;
  - `incomeDelta` y `expenseDelta` coinciden con `monthSummary`;
  - la evolución tiene 6 puntos (MONTH y YEAR) del más antiguo al actual.

### Implementation for User Story 3

- [X] T029 [US3] Implementar el tipo `BalanceDelta`, `balanceReport(transactions, period)` y `balanceEvolution(transactions, period, count = 6)` en `apps/mobile/src/modules/finance/domain/monthSummary.ts`, reutilizando `totalsIn` y `delta` (R5, [contracts/domain.md](./contracts/domain.md) §Balance)
- [X] T030 [P] [US3] Crear `useBalance(period)` → `{ report, evolution }` en `apps/mobile/src/modules/finance/hooks/useBalance.ts`
- [X] T031 [P] [US3] Crear `BalanceDeltaText` en `apps/mobile/src/modules/finance/components/balance/BalanceDeltaText.tsx`: `pct` delega en `DeltaText` con `goodWhen="up"`; `abs` muestra `± $ X vs. <periodo anterior>` con `Amount`, coloreado por signo; `null` no muestra nada
- [X] T032 [P] [US3] Crear `BalanceEvolutionChart` en `apps/mobile/src/modules/finance/components/balance/BalanceEvolutionChart.tsx`:
  - `BarChart` de react-native-gifted-charts con barras agrupadas por periodo: ingresos en `theme.colors.income` y gastos en `theme.colors.expense`;
  - etiqueta de balance abreviado (`abbreviateCop`) sobre cada grupo, coloreada por signo;
  - leyenda Ingresos / Gastos;
  - `accessibilityLabel` con los tres valores por periodo;
  - ancho con `useWidth`, igual que `EvolutionChart`.
- [X] T033 [US3] Crear la pantalla `apps/mobile/src/app/(app)/(tabs)/finance/balance/index.tsx`:
  - título "Balance" y subtítulo "Ingresos − gastos";
  - `PeriodSwitcher` con `min` y `clampPeriod`;
  - tarjeta principal "Balance · <periodo>" con `Amount variant="auto" size="large"` (déficit en color de egreso y con signo) y `BalanceDeltaText`;
  - una `GlassCard` con dos `ListItem` pulsables, "Ingresos" (con `incomeDelta`) y "Gastos" (con `expenseDelta`), que navegan a `/finance/income` y `/finance/spending` con el mismo `granularity` / `anchor`;
  - sección "Últimos 6 meses" o "Últimos 6 años" con `BalanceEvolutionChart`;
  - un periodo sin movimientos muestra ceros sin estado de error.
- [X] T034 [US3] Añadir la sección `balance` a `financeSections` en `apps/mobile/src/modules/finance/sections.ts` (label "Balance", description "Ingresos − gastos por periodo", icon `swap-vertical-outline`, route `/finance/balance`), situada después de `spending`, y mover allí la tarjeta `month-balance` (order 3) desde `transactions`
- [X] T035 [US3] Cambiar el `href` de `MonthBalanceCard` a `/finance/balance?granularity=MONTH&anchor=<mes seleccionado>` en `apps/mobile/src/modules/finance/components/summary/MonthBalanceCard.tsx` y añadir un footer con `BalanceDeltaText` (FR-005)

**Checkpoint**: quickstart P3 completo; las tres tarjetas del Resumen abren su pantalla dedicada en el mes seleccionado (quickstart P1 paso 5 completo).

---

## Phase 6: User Story 4 - Gestionar categorías de ingresos y egresos (Priority: P2)

**Goal**: sección Categorías para crear y editar (sin archivar ni borrar), con un catálogo amplio de íconos con búsqueda, una paleta fija y creación en línea desde el formulario de movimientos.

**Independent Test**: quickstart P4 a–d. Crear "Mascotas" con ícono y color, rechazar duplicados sin distinguir tildes, editar con el tipo bloqueado, crear desde el formulario sin perder datos, y que funcione sin conexión y se sincronice.

### Tests for User Story 4

- [X] T036 [P] [US4] Pruebas del catálogo en `apps/mobile/src/modules/finance/categories/iconCatalog.test.ts`:
  - cada `name` existe en `Ionicons.glyphMap` y no hay duplicados;
  - "≥ 80 entradas" y "cada grupo ≥ 4";
  - incluye los 15 íconos de `apps/api/app/modules/categories/defaults.py`;
  - `searchIcons` encuentra resultado para mercado, gasolina, salario, arriendo, mascota, médico, colegio, regalo, café y bus;
  - "Médico" y "medico" devuelven lo mismo, y una consulta vacía devuelve todo el catálogo.
- [X] T037 [P] [US4] Ampliar `apps/mobile/src/theme/contrast.test.ts`:
  - `categoryPalette` tiene 20 hex únicos `#RRGGBB`;
  - cada color tiene etiqueta en `paletteColorLabels`;
  - incluye los 15 colores de `defaults.py`;
  - cada color tiene contraste "≥ 1.8:1 en claro y ≥ 3:1 en oscuro" sobre `surfaceSolid` (R8).
- [X] T038 [P] [US4] Pruebas de `normalizeCategoryName`, `isDuplicateCategoryName` y `nextSortOrder` en `apps/mobile/src/modules/finance/domain/categories.test.ts`:
  - "  Mascótas " ≡ "mascotas";
  - los espacios internos se colapsan;
  - el duplicado se detecta solo dentro del mismo `kind` y excluye `exceptId`;
  - se ignoran las categorías con `deletedAt`;
  - `nextSortOrder` = max + 1 del tipo, o 0 si no hay ninguna.
- [X] T039 [P] [US4] Pruebas del repositorio en `apps/mobile/src/modules/finance/data/local/categoriesRepo.test.ts`, con los helpers de `data/local/testing.ts`:
  - `createCategory` persiste con `is_dirty = 1`, `sortOrder` correcto e ID UUID;
  - el duplicado lanza `ValidationError('DUPLICATE_NAME','name')`;
  - el nombre debe tener "1–50 caracteres tras trim";
  - al crear, el ícono debe estar en el catálogo y el color en la paleta;
  - `updateCategory` ignora `kind`, acepta el ícono o color heredado sin cambiar y rechaza uno nuevo fuera del catálogo o la paleta;
  - un ID inexistente lanza `NOT_FOUND`.
- [X] T040 [P] [US4] Ampliar `apps/mobile/src/modules/finance/components/transactions/TransactionForm.test.tsx`:
  - con `allowCreateCategory`, el chip "Nueva" aparece en ingreso y egreso pero no en transferencia;
  - al crear desde la hoja, la categoría queda seleccionada y el monto, la cuenta y la descripción se conservan;
  - al cancelar, el formulario no cambia;
  - sin la prop, el chip no aparece.

### Implementation for User Story 4

- [X] T041 [P] [US4] Ampliar `categoryPalette` a 20 colores en `apps/mobile/src/theme/tokens.ts` (tipo `string[]` sin cambios): mantener los 13 actuales, añadir `#0EA5E9`, `#22C55E`, `#64748B`, `#D946EF` y `#F59E0B` (defaults del servidor) y 2 más que cumplan el piso de contraste de R8
- [X] T042 [P] [US4] Crear `paletteColorLabels: Record<string, string>` con nombres en español para los 20 colores en `apps/mobile/src/modules/finance/categories/paletteLabels.ts`
- [X] T043 [P] [US4] Crear `ICON_GROUPS` (14 grupos en orden: Comida y bebida, Transporte, Hogar, Servicios, Salud, Educación, Ocio, Compras, Finanzas, Trabajo, Viajes, Mascotas, Familia y personal, Otros) e `ICON_CATALOG` (~120 entradas `{ name, label, keywords, group }` de Ionicons `-outline`, con palabras clave en español en minúsculas y sin tildes, incluidos los 15 íconos de `defaults.py`) en `apps/mobile/src/modules/finance/categories/iconCatalog.ts`
- [X] T044 [US4] Implementar `searchIcons(query)` (NFD sin diacríticos, minúsculas, subcadena sobre `label`, `keywords` y `name`) en `apps/mobile/src/modules/finance/categories/searchIcons.ts`
- [X] T045 [P] [US4] Implementar `normalizeCategoryName`, `isDuplicateCategoryName` y `nextSortOrder` en `apps/mobile/src/modules/finance/domain/categories.ts`
- [X] T046 [US4] Crear `categoryInputSchema` (Zod) en `apps/mobile/src/modules/finance/domain/schemas/category.ts`, con modos `create` / `edit(current)`:
  - `name`: trim, 1–50 caracteres ("Escribe un nombre" / "Máximo 50 caracteres");
  - `kind`: `INCOME | EXPENSE`;
  - `icon`: del catálogo, o igual al actual en edit ("Elige un ícono");
  - `color`: de la paleta, o igual al actual en edit ("Elige un color").
- [X] T047 [US4] Añadir `'DUPLICATE_NAME'` a `ErrorCode` en `apps/mobile/src/modules/finance/data/FinanceRepository.ts`
- [X] T048 [US4] Implementar `createCategory(input)` y `updateCategory(id, changes)` en `apps/mobile/src/modules/finance/data/local/categoriesRepo.ts`, con el patrón de `assetsRepo.ts` (`insert` / `patch` + `validate`):
  - duplicado → `ValidationError('DUPLICATE_NAME','name','Ya tienes una categoría de {egreso|ingreso} llamada «{nombre}».')`;
  - `sortOrder = nextSortOrder`;
  - `kind` inmutable;
  - sin función de borrado ([contracts/categories.md](./contracts/categories.md)).
- [X] T049 [P] [US4] Usar `pricetag-outline` cuando `name` no existe en `Ionicons.glyphMap`, en `Icon` de `apps/mobile/src/components/ui/Icon.tsx` (R13)
- [X] T050 [US4] Crear `useCategoriesByKind()` → `{ EXPENSE, INCOME }` (activas, por `sortOrder`) y reexportar `createCategory` / `updateCategory` en `apps/mobile/src/modules/finance/hooks/useCategoriesAdmin.ts`. Añadir `useCategory(id)`.
- [X] T051 [P] [US4] Crear `ColorPalettePicker` (cuadrícula de círculos de 36 dp con área táctil ≥ 44, check en el seleccionado, `accessibilityRole="radio"`, etiqueta de `paletteColorLabels`; si el valor está fuera de la paleta, no se marca ninguno) en `apps/mobile/src/modules/finance/components/categories/ColorPalettePicker.tsx`
- [X] T052 [P] [US4] Crear `IconPickerSheet` en `apps/mobile/src/modules/finance/components/categories/IconPickerSheet.tsx`:
  - `Modal` + `GlassSurface` con `TextField` de búsqueda arriba (autofoco en web);
  - sin consulta, `SectionList` por grupo; con consulta, una cuadrícula `FlatList` de resultados o el estado vacío "Sin íconos para «…»";
  - 5 columnas en móvil y 8 con `useIsWide()`; celdas ≥ 44 × 44 con `accessibilityLabel = label` y `selected`;
  - al tocar un ícono se selecciona y se cierra.
- [X] T053 [US4] Crear `CategoryForm` en `apps/mobile/src/modules/finance/components/categories/CategoryForm.tsx` (react-hook-form + `categoryInputSchema`):
  - vista previa con `IconBadge` grande y el nombre (o "Nueva categoría");
  - `SegmentedControl` Egreso / Ingreso, de solo lectura si `initial` o `fixedKind`;
  - `TextField` del nombre con `maxLength` 50;
  - botón de ícono que abre `IconPickerSheet`, y `ColorPalettePicker`;
  - valores por defecto al crear: `pricetag-outline` y `categoryPalette[0]`;
  - Guardar y Cancelar; los `ValidationError` del repo se muestran en el campo `name`.
- [X] T054 [US4] Crear la pantalla `apps/mobile/src/app/(app)/(tabs)/finance/categories/index.tsx`:
  - título "Categorías" y subtítulo "Ingresos y egresos";
  - `SectionHeader` "Egresos" e "Ingresos", cada uno con su acción "Nueva" → `/finance/categories/new?kind=…`;
  - `GlassCard` con un `ListItem` por categoría (`IconBadge` del color, nombre, chevron) → `/finance/categories/[id]/edit`;
  - estado vacío por grupo;
  - sin acciones de borrar ni archivar.
- [X] T055 [P] [US4] Crear el modal `apps/mobile/src/app/(app)/(tabs)/finance/categories/new.tsx`: `Screen modal back fallback="/finance/categories"` con `CategoryForm` (kind inicial de `?kind=`, por defecto `EXPENSE`), `createCategory` y `goBack()` al guardar
- [X] T056 [P] [US4] Crear el modal `apps/mobile/src/app/(app)/(tabs)/finance/categories/[id]/edit.tsx`: carga con `useCategory(id)` (`EmptyState` "La categoría ya no existe" si falta), `CategoryForm initial`, `updateCategory` y `goBack()`
- [X] T057 [US4] Añadir la sección `categories` a `financeSections` en `apps/mobile/src/modules/finance/sections.ts` (label "Categorías", description "Crea y edita tus categorías", icon `pricetags-outline`, route `/finance/categories`), situada después de `net-worth`
- [X] T058 [US4] Crear `CategoryEditorSheet` (`Modal` con `CategoryForm fixedKind={kind}`; al guardar llama a `createCategory`, luego a `onCreated(c)` y cierra; Cancelar solo cierra) en `apps/mobile/src/modules/finance/components/categories/CategoryEditorSheet.tsx`
- [X] T059 [US4] Añadir la prop `allowCreateCategory?: boolean` a `TransactionForm` en `apps/mobile/src/modules/finance/components/transactions/TransactionForm.tsx`:
  - chip final "Nueva" (ícono `add`), solo si no es transferencia;
  - abre `CategoryEditorSheet` con `kind = type`;
  - `onCreated` → `setValue('categoryId', c.id, { shouldDirty: true })`;
  - la lista `kindCategories` se actualiza sola desde el store.
- [X] T060 [US4] Pasar `allowCreateCategory` a `TransactionForm` en `apps/mobile/src/app/(app)/(tabs)/finance/transactions/new.tsx` y `apps/mobile/src/app/(app)/(tabs)/finance/transactions/[id]/edit.tsx` (no en suscripciones ni ingresos recurrentes)

**Checkpoint**: quickstart P4 a–d completo; `npm test` pasa.

---

## Phase 7: User Story 5 - Elegir el periodo de la gráfica de patrimonio (Priority: P3)

**Goal**: selector 6M / 12M / 24M / Todo en Patrimonio, con "Todo" desde el primer dato patrimonial y sin meses vacíos al inicio.

**Independent Test**: quickstart P5. Número de puntos por rango con historial corto, título, etiquetas legibles y rendimiento < 1 s.

### Tests for User Story 5

- [X] T061 [P] [US5] Pruebas de `firstNetWorthMonth` y `netWorthMonthsFor` en `apps/mobile/src/modules/finance/domain/netWorth.test.ts`:
  - mínimo entre `occurredAt` de movimientos, `startDate` de CDT y `createdAt` de cuentas y bienes, en mes local;
  - con 8 meses de historial: `6M` → 6, `12M` → 8, `24M` → 8, `ALL` → 8;
  - sin datos → 1 en todos los rangos;
  - `netWorthEvolution` con `months = 30` devuelve 30 puntos y el último es hoy.

### Implementation for User Story 5

- [X] T062 [US5] Implementar `NetWorthRange`, `firstNetWorthMonth(accounts, transactions, cdts, assets)` y `netWorthMonthsFor(range, firstMonth, today)` en `apps/mobile/src/modules/finance/domain/netWorth.ts` (R12; `netWorthEvolution` mantiene su firma)
- [X] T063 [US5] Cambiar `useNetWorth(range = '12M')` → `{ report, evolution, firstMonth }` en `apps/mobile/src/modules/finance/hooks/useNetWorth.ts`, calculando `months` con `netWorthMonthsFor`. `NetWorthCard` sigue llamándolo sin argumento.
- [X] T064 [P] [US5] Crear `NetWorthRangeSelector` (`SegmentedControl<NetWorthRange>` con opciones "6M", "12M", "24M" y "Todo", y `accessibilityLabel` "Rango de la gráfica") en `apps/mobile/src/modules/finance/components/netWorth/NetWorthRangeSelector.tsx`
- [X] T065 [P] [US5] Ajustar las etiquetas del eje en `NetWorthChart` (`apps/mobile/src/modules/finance/components/netWorth/NetWorthChart.tsx`):
  - mostrar la etiqueta cada `step = ceil(n / 6)` puntos, contando desde el último;
  - formato `MMM` si n ≤ 12 y `MMM yy` si n > 12;
  - con 1 punto, la gráfica se renderiza sin dividir por cero (`spacing` ya usa `Math.max(1, …)`).
- [X] T066 [US5] Integrar en `apps/mobile/src/app/(app)/(tabs)/finance/net-worth/index.tsx`:
  - estado local `range` con valor inicial `'12M'`;
  - `NetWorthRangeSelector` entre el `SectionHeader` y la gráfica;
  - título "Últimos 6 meses", "Últimos 12 meses", "Últimos 24 meses" o, en Todo, "Desde <mes año de firstMonth>".
- [X] T067 [US5] Medir el cambio a "Todo" con 2 años y unos 3.000 movimientos en un Android de gama media (quickstart P5.4). Si supera 1 s, optimizar `netWorthEvolution` en `apps/mobile/src/modules/finance/domain/netWorth.ts` para que recorra una sola vez los movimientos ordenados y acumule saldos por mes (R12), sin cambiar la salida (las pruebas de T061 y las existentes deben seguir pasando).

**Checkpoint**: quickstart P5 completo.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T068 [P] Revisar las pantallas nuevas en modo claro y oscuro, en Android y web, con ancho < 1024 y ≥ 1024 (layout de dos columnas, como en `spending/index.tsx` donde aplique) (SC-007)
- [X] T069 [P] Accesibilidad: revisar que `accessibilityLabel` y `accessibilityState` estén en español en MonthSelector, MonthPickerSheet, IconPickerSheet, ColorPalettePicker, NetWorthRangeSelector y las gráficas nuevas, y que todos los controles tengan área táctil ≥ 44
- [X] T070 Actualizar [specs/001-finance-ui-mockup/contracts/navigation.md](../001-finance-ui-mockup/contracts/navigation.md) con las rutas nuevas, o enlazar a [contracts/navigation.md](./contracts/navigation.md) de esta spec
- [X] T071 Ejecutar `npm run typecheck`, `npm run lint`, `npm test` y `npm run test:tz` en `apps/mobile` y corregir los fallos
- [ ] T072 Recorrer [quickstart.md](./quickstart.md) P1–P5 completo y anotar el resultado en el PR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)** → **Foundational (2)** → historias.
- **US1, US2, US3 y US5** dependen de la fase 2 (fechas, reporte generalizado, `firstActivityMonth`, `PeriodSwitcher.min`).
- **US4** no depende de la fase 2: puede empezar justo tras la fase 1.
- **Polish (8)** cuando terminen las historias que se entreguen.

### User Story Dependencies

- **US1 (P1)**: independiente. Sus tarjetas enlazan a Movimientos (ingresos y balance) o a Gastos hasta que lleguen US2 y US3.
- **US2 (P2)**: independiente. T027 modifica una tarjeta de US1 (si US1 no está hecha, aplicar el mismo `href` con el mes en curso).
- **US3 (P2)**: independiente. T035 modifica una tarjeta de US1 (misma nota). Las filas de Balance enlazan a `/finance/income`, que viene de US2; sin US2, la fila de ingresos puede enlazar temporalmente a Movimientos filtrados.
- **US4 (P2)**: totalmente independiente.
- **US5 (P3)**: independiente.
- **Conflictos de archivo**: `sections.ts` lo tocan T026, T034 y T057; `MonthIncomeCard` T017 y T027; `MonthBalanceCard` T019 y T035; `spending/index.tsx` T010, T022 y T023. Esas tareas se hacen en serie.

### Within Each User Story

- Pruebas primero (deben fallar), luego dominio, hooks, componentes y pantallas, y por último registro en secciones y enlaces.

### Parallel Opportunities

- Fase 2: T002, T003 y T004 (pruebas) en paralelo; luego T005 en paralelo con T006 → T007.
- US4 completa en paralelo con la fase 2 y con US1.
- Dentro de US4: T036–T040 (pruebas), T041–T043 y T045 (datos estáticos y dominio), T051 y T052 (pickers), T055 y T056 (modales).
- US2, US3 y US5 pueden ir en paralelo entre sí tras la fase 2, salvo los archivos compartidos indicados.

---

## Parallel Example: User Story 4

```text
# Pruebas en paralelo:
T036 iconCatalog.test.ts · T037 contrast.test.ts · T038 categories.test.ts · T039 categoriesRepo.test.ts · T040 TransactionForm.test.tsx

# Datos estáticos y dominio en paralelo:
T041 tokens.ts · T042 paletteLabels.ts · T043 iconCatalog.ts · T045 domain/categories.ts

# UI en paralelo (tras T044 y T046–T050):
T051 ColorPalettePicker.tsx · T052 IconPickerSheet.tsx
```

## Parallel Example: User Story 1

```text
T013 MonthPickerSheet.tsx   (en paralelo con T012 useSummaryMonth.ts)
T017 MonthIncomeCard.tsx · T018 MonthSpendingCard.tsx · T019 MonthBalanceCard.tsx   (tras T012 y T016)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Fase 1 → Fase 2 → Fase 3 (US1).
2. **Parar y validar**: quickstart P1. El usuario ya puede consultar meses anteriores desde el Resumen.

### Incremental Delivery

1. Fundacional + US1 → MVP.
2. US2 (Ingresos) → US3 (Balance): con ambas, las tres tarjetas abren su pantalla dedicada.
3. US4 (Categorías), que puede desarrollarse en paralelo desde el inicio.
4. US5 (Patrimonio).
5. Polish.

### Parallel Team Strategy

- Persona A: Fase 2 → US1 → US3.
- Persona B: US4 completa (sin esperar a la fase 2).
- Persona C: tras la fase 2, US2 → US5.

---

## Notes

- **Estado de implementación (2026-10-31)**: T068 y T072 quedan pendientes; requieren revisión visual y manual en Android y web. T067 se midió en Node (3.000 movimientos, 2 años: 24 meses pasó de 133 ms a 12 ms tras la optimización), no en un Android de gama media. La medición en dispositivo forma parte de T072 (quickstart P5.4).

- Commits pequeños por tarea o grupo lógico; sin commit ni push salvo que se pida (CLAUDE.md).
- Sin cambios en `apps/api` ni migraciones.
- No se implementa archivar ni borrar categorías (Clarifications 2026-10-31).
