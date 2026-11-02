---

description: "Lista de tareas: Dashboard de Inicio (finanzas)"
---

# Tasks: Dashboard de Inicio (finanzas)

**Input**: documentos de diseño en `/specs/010-home-dashboard/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **incluidas**. FR-027 y la constitución exigen pruebas automatizadas para el cálculo de montos y fechas. En cada historia, las pruebas se escriben primero y deben fallar antes de implementar.

**Organization**: por historia de usuario (spec.md). Prioridades: US1 y US2 son P1, US3 y US4 son P2, US5 es P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (otro archivo, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1…US5)
- Todas las rutas son relativas a la raíz del repo; solo cambia `apps/mobile/`.

---

## Phase 1: Setup

**Purpose**: partir de un estado verde. No se añaden dependencias (plan.md).

- [X] T001 Verificar que pasan las pruebas existentes antes de empezar: `cd apps/mobile && npm test && npm run typecheck && npm run lint`. Anotar cualquier fallo previo.

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: registro de widgets, "hoy" vivo y la estructura de la pantalla de Inicio. Cada historia solo agrega su widget al registro.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta terminar esta fase.

- [X] T002 [P] Escribir `apps/mobile/src/modules/dashboard.test.ts` (debe fallar):
  - `buildDashboardWidgets(sources, modules)` ordena por `order` ascendente y desempata por `id`.
  - Descarta los widgets cuyo `moduleId` no esté entre los módulos `status === 'active'` (probar con un widget de `routines`, que está en `coming_soon`).
  - Lanza error si hay dos `id` repetidos.
- [X] T003 Crear `apps/mobile/src/modules/dashboard.ts` según [contracts/widgets.md](./contracts/widgets.md):
  - `interface DashboardWidget { id: string; moduleId: string; order: number; span: 'full' | 'half'; Widget: ComponentType }`.
  - Función pura `buildDashboardWidgets(sources: DashboardWidget[][], modules: AppModule[])`.
  - `export const dashboardWidgets = buildDashboardWidgets([financeDashboardWidgets], appModules)`.
  - No importar este archivo desde `modules/registry.ts` (research R1).
  - Hace pasar T002.
- [X] T004 [P] Crear `apps/mobile/src/modules/finance/dashboard.ts` con `export const financeDashboardWidgets: DashboardWidget[] = []` (las historias agregan sus entradas).
- [X] T005 [P] Agregar `useLiveToday(): IsoDate` en `apps/mobile/src/modules/finance/hooks/useFinanceData.ts` (research R4):
  - El estado inicial es `todayLocal()`.
  - Revisa cada 60 s con `setInterval` y al pasar `AppState` a `'active'`; solo hace `setState` si el día cambió.
  - Limpia el intervalo y el listener al desmontar.
  - No modificar `useToday`.
- [X] T006 Reescribir `apps/mobile/src/app/(app)/(tabs)/index.tsx` como estructura del tablero, sin widgets aún:
  - Usar `Screen` con scroll.
  - Encabezado compacto con el saludo `greetingFor(now)`, una coma y `displayName` en tono acento, en `variant="title"`, alineado a la izquierda (ya no centrado a pantalla completa). Mantener el temporizador de 60 s de `now`.
  - A la derecha, un `IconButton` de ojo que llama `useAmountVisibilityStore.setAll(!allVisible)`, con etiquetas "Mostrar todos los valores" / "Ocultar todos los valores" (igual que `finance/index.tsx`).
  - Mantener sin cambios el `GlassCard` de descarga inicial (`useInitialSync`).
  - Cuadrícula con `flexDirection: 'row'`, `flexWrap: 'wrap'` y `gap: theme.spacing(3)`. Para cada `dashboardWidgets`: `<View key={id} style={wide && span === 'half' ? { flexBasis: '48%', flexGrow: 1 } : { width: '100%' }}><Widget /></View>` (`wide = useIsWide()`).
  - Actualizar el comentario de cabecera (ya no es "solo un saludo").

**Checkpoint**: Inicio muestra el saludo compacto, el ojo y una cuadrícula vacía; `npm test -- dashboard` pasa.

---

## Phase 3: User Story 1 - Patrimonio neto y su evolución (Priority: P1) 🎯 MVP

**Goal**: tarjeta con el patrimonio actual, la variación frente al mes anterior y la gráfica de 12 meses; al tocarla, abre Patrimonio.

**Independent Test**: con datos de varios meses, el valor y los 12 puntos coinciden con Finanzas → Patrimonio (12M) (quickstart #3).

### Tests

- [X] T007 [P] [US1] Agregar a `apps/mobile/src/modules/finance/domain/netWorth.test.ts` un caso que confirme que `netWorthEvolution(..., today, 12)` devuelve 12 puntos, que el último coincide con `netWorthReport(...).netWorth` y que la diferencia entre el punto 11 y el 10 es la variación esperada (debe pasar sin cambios de dominio; sirve de garantía para SC-003).

### Implementation

- [X] T008 [P] [US1] Agregar la prop opcional `height?: number` (default 180) a `NetWorthChart` en `apps/mobile/src/modules/finance/components/netWorth/NetWorthChart.tsx` y usarla en `<LineChart height>`. El uso actual en `net-worth/index.tsx` no cambia.
- [X] T009 [P] [US1] Cambiar `useNetWorth(range = '12M', today?: IsoDate)` en `apps/mobile/src/modules/finance/hooks/useNetWorth.ts` para usar `today ?? useToday()` (llamar siempre a `useToday()` para respetar las reglas de hooks). Los llamadores actuales no cambian.
- [X] T010 [US1] Crear `apps/mobile/src/modules/finance/hooks/useHomeFinance.ts` con `useHomeNetWorth()`:
  - Usa `useLiveToday()` y `useNetWorth('12M', today)`.
  - Devuelve `{ netWorth: report.netWorth, evolution, monthDelta: sub(evolution[11].netWorth, evolution[10].netWorth), isEmpty }`.
  - `isEmpty` es verdadero si no hay cuentas activas no archivadas, ni CDTs vivos, ni bienes (equivale a `report.groups.length === 0`).
- [X] T011 [US1] Crear `apps/mobile/src/modules/finance/components/home/NetWorthWidget.tsx` según [contracts/widgets.md](./contracts/widgets.md):
  - `GlassCard` con `Pressable` → `router.push('/finance/net-worth')`, `accessibilityRole="button"` y etiqueta "Patrimonio neto, ver detalle".
  - Contenido: `IconBadge` `analytics` (color `accentAlt`), etiqueta "Patrimonio neto" y `Amount variant="auto" size="large"`.
  - Variación: ícono `arrow-up`/`arrow-down` y `formatCop(monthDelta, { signDisplay: 'always' })` en color `income`/`expense`, con el texto "vs. mes anterior"; si es 0, tono muted y "Sin cambios vs. mes anterior".
  - Gráfica `NetWorthChart points={evolution} height={120}`.
  - Visibilidad con `useAmountVisible('home-net-worth')`: si está oculto, mostrar `$ ******` y no renderizar la variación ni la gráfica (research R6).
  - Si `isEmpty`, mostrar `EmptyState` compacto (ícono `analytics-outline`, "Aún no hay patrimonio", acción "Crear cuenta" → `/finance/accounts/new`) en lugar de valor y gráfica.
- [X] T012 [US1] Registrar `{ id: 'finance.net-worth', moduleId: 'finance', order: 10, span: 'full', Widget: NetWorthWidget }` en `apps/mobile/src/modules/finance/dashboard.ts`.

**Checkpoint**: Inicio muestra Patrimonio con valores iguales a Finanzas → Patrimonio.

---

## Phase 4: User Story 2 - Cómo voy este mes (Priority: P1)

**Goal**: ingresos vs. gastos del mes en curso con barras y el balance neto; al tocarlo, abre Balance.

**Independent Test**: los valores coinciden con Finanzas → Balance del mes en curso, aunque el Resumen tenga otro mes elegido (quickstart #4 y #5).

### Tests

- [X] T013 [P] [US2] Crear `apps/mobile/src/modules/finance/components/home/MonthFlowWidget.test.tsx` (debe fallar):
  - Con movimientos del mes en curso y de meses anteriores, y con `useSummaryMonthStore.getState().setSelected(<mes anterior>)`, el widget muestra los totales del mes en curso.
  - Con los montos visibles (`setAll(true)`), muestra ingresos, gastos y balance formateados.
  - Sin movimientos, muestra `$ 0` en los tres.
  - Usar los helpers de `apps/mobile/src/modules/finance/data/local/testing.ts` y `jest.setup.tsx`.

### Implementation

- [X] T014 [US2] Agregar `useHomeMonthFlow()` en `apps/mobile/src/modules/finance/hooks/useHomeFinance.ts`: `today = useLiveToday()`; `monthSummary(useActiveTransactions(), { granularity: 'MONTH', anchor: today })` memoizado; devuelve `{ month: today, income, expense, balance }`. No usar `useSummaryMonth` (FR-014).
- [X] T015 [US2] Crear `apps/mobile/src/modules/finance/components/home/MonthFlowWidget.tsx` según [contracts/widgets.md](./contracts/widgets.md):
  - `GlassCard` presionable → `router.push({ pathname: '/finance/balance', params: { granularity: 'MONTH', anchor: month } })`.
  - Título "Este mes · " + `formatDateLocal(month, 'MMMM yyyy')`.
  - Filas Ingresos y Gastos, cada una con su etiqueta, monto y una barra (`View` con `borderRadius: theme.radii.pill`, fondo `theme.colors.border`, relleno `income`/`expense`). El ancho del relleno es `x / max(income, expense)` en %, solo para presentación; si ambos son 0, el ancho es 0.
  - Separador y "Balance" con `Amount variant="auto"`.
  - Visibilidad con `useAmountVisible('home-month-flow')`: los montos ocultos se muestran como `$ ******` y las barras siguen visibles.
  - `accessibilityLabel` resumido según el contrato. Hace pasar T013.
- [X] T016 [US2] Registrar `{ id: 'finance.month-flow', moduleId: 'finance', order: 20, span: 'half', Widget: MonthFlowWidget }` en `apps/mobile/src/modules/finance/dashboard.ts`.

**Checkpoint**: US1 y US2 funcionan juntas; en ≥ 1024 px, Este mes ocupa media columna.

---

## Phase 5: User Story 3 - Registrar un movimiento en un toque (Priority: P2)

**Goal**: FAB → hoja Gasto / Ingreso / Transferencia → formulario con el tipo preseleccionado → al guardar o cancelar, vuelve a Inicio.

**Independent Test**: quickstart #8–#11.

### Implementation

- [X] T017 [US3] Extraer el cuerpo de `apps/mobile/src/app/(app)/(tabs)/finance/transactions/new.tsx` a `apps/mobile/src/modules/finance/components/transactions/NewTransactionScreen.tsx`:
  - Props: `{ defaults: { type?; accountId?; reimbursementGroupId?; recurringIncomeId? }; fallback: Href; onCreateAccount: () => void }`.
  - Incluye `Screen title="Nuevo movimiento" back fallback={fallback} modal`, el `EmptyState` sin cuentas (acción → `onCreateAccount`) y el `TransactionForm` con `onSubmit` → `createTransaction(input)` y luego `goBack(fallback)`.
  - `new.tsx` queda como envoltorio que lee los `useLocalSearchParams` actuales y pasa `fallback="/finance/transactions"` y `onCreateAccount={() => router.replace('/finance/accounts/new')}`. El comportamiento actual no cambia; `TransactionForm.test.tsx` debe seguir pasando.
- [X] T018 [US3] Crear `apps/mobile/src/app/(app)/quick-transaction.tsx` según [contracts/navigation.md](./contracts/navigation.md):
  - Lee `type` de `useLocalSearchParams`; solo acepta `'EXPENSE' | 'INCOME' | 'TRANSFER'` y cualquier otro valor se convierte en `undefined`.
  - Renderiza `NewTransactionScreen defaults={{ type }} fallback="/" onCreateAccount={() => { router.dismiss(); router.push('/finance/accounts/new'); }}`.
- [X] T019 [US3] Registrar `<Stack.Screen name="quick-transaction" options={{ presentation: 'modal' }} />` en `apps/mobile/src/app/(app)/_layout.tsx`, junto a `reauth`.
- [X] T020 [P] [US3] Crear `apps/mobile/src/modules/finance/components/home/QuickActionSheet.tsx`:
  - Props `{ visible: boolean; onClose: () => void }`.
  - `Sheet title="Registrar movimiento"` con tres `ListItem`:
    - Gasto: ícono `arrow-up-circle-outline`, color `expense`, tipo `EXPENSE`.
    - Ingreso: ícono `arrow-down-circle-outline`, color `income`, tipo `INCOME`.
    - Transferencia: ícono `swap-horizontal-outline`, color `transfer`, tipo `TRANSFER`.
  - Al tocar una opción: `onClose()` y luego `router.push({ pathname: '/quick-transaction', params: { type } })`.
  - Usar las props `icon` e `iconColor` de `ListItem`.
- [X] T021 [US3] En `apps/mobile/src/app/(app)/(tabs)/index.tsx`, agregar `const [quickOpen, setQuickOpen] = useState(false)`, `<Fab accessibilityLabel="Registrar movimiento" onPress={() => setQuickOpen(true)} />` fuera del `Screen` (dentro de un `View style={{ flex: 1 }}`, como en `finance/_layout.tsx`) y `<QuickActionSheet visible={quickOpen} onClose={() => setQuickOpen(false)} />`. Esta tarea depende de T006.
- [ ] T022 [US3] Verificar a mano en Android y web (quickstart #8–#11):
  - Guardar y cancelar vuelven a Inicio.
  - El botón atrás cierra la hoja.
  - Sin cuentas, "Nueva cuenta" abre el formulario de cuenta.
  - El FAB de Finanzas sigue funcionando igual.
  - Documentar cualquier diferencia de comportamiento del modal en web.

**Checkpoint**: registrar un gasto desde Inicio toma 2 toques hasta el formulario y el tablero se actualiza al volver.

---

## Phase 6: User Story 4 - Próximos vencimientos (Priority: P2)

**Goal**: lista ordenada de suscripciones, CDTs y pagos de tarjeta para los próximos 15 días, con días restantes y monto.

**Independent Test**: `npm test -- upcoming` + quickstart #6 y #7.

### Tests

- [X] T023 [P] [US4] Crear `apps/mobile/src/modules/finance/domain/upcoming.test.ts` con **todos** los casos de [contracts/domain.md](./contracts/domain.md) (debe fallar):
  - `nextMonthlyDate` en fin de mes y en febrero bisiesto y no bisiesto.
  - Inclusión y exclusión por tipo y estado.
  - Ventana con 15 días incluido y 16 excluido.
  - CDT ACTIVE vencido, que va primero y con `overdue`.
  - Monto del CDT = `maturityValue`, con override.
  - Tarjeta: deuda > 0, deuda 0, saldo a favor, sin `paymentDueDay`, archivada.
  - Desempate CARD_PAYMENT < CDT_MATURITY < SUBSCRIPTION y luego nombre.
  - `isExcludedFromNetWorth` no excluye.
  - `daysUntilLabel(-3) === 'Vencido hace 3 días'`, `(-1) === 'Vencido ayer'`, `(0) === 'Hoy'`, `(1) === 'Mañana'`, `(5) === 'En 5 días'`.
  - Usar los constructores de `apps/mobile/src/modules/finance/domain/testUtils.ts`.

### Implementation

- [X] T024 [US4] Crear `apps/mobile/src/modules/finance/domain/upcoming.ts` según [contracts/domain.md](./contracts/domain.md) y [data-model.md](./data-model.md):
  - Tipos `UpcomingKind`, `UpcomingItem` (`urgent = daysUntil ≤ 1`, `overdue = daysUntil < 0`) y `UpcomingInput`.
  - `nextMonthlyDate(day, today)` con `clampedIsoDate` y `addMonthsToYearMonth`.
  - `upcomingItems(input, today, windowDays = MATURING_SOON_DAYS)`, con estas reglas de inclusión:
    - SUBSCRIPTION: vía `subscriptionsWithNext`, con `0 ≤ daysUntil ≤ W`; monto `amount`.
    - CDT_MATURITY: `status === 'ACTIVE'`, no borrado y `daysBetween(today, maturesOn) ≤ W`; nombre `CDT ${issuer}`; monto `maturityValue(cdt)`.
    - CARD_PAYMENT: `type === 'CREDIT_CARD'`, `!deletedAt && !isArchived`, `paymentDueDay !== null` y `debtOf(balances.get(id) ?? ZERO) > 0`, con `0 ≤ daysUntil ≤ W`; monto = deuda.
  - Orden: `date`, luego tipo, luego `name.localeCompare(other, 'es')`, luego `sourceId`.
  - `daysUntilLabel`.
  - Hace pasar T023, también con `npm run test:tz`.
- [X] T025 [US4] Agregar `useUpcoming()` en `apps/mobile/src/modules/finance/hooks/useHomeFinance.ts`: combina `useActiveSubscriptions()`, `useActiveCdts()`, `useActiveAccounts()`, `useBalances()` y `useLiveToday()`, y devuelve `upcomingItems(...)` memoizado.
- [X] T026 [P] [US4] Crear `apps/mobile/src/modules/finance/components/home/UpcomingRow.tsx`:
  - Props `{ item: UpcomingItem; visible: boolean }`.
  - `Pressable` con alto ≥ `theme.layout.minTouchTarget` que navega según `kind`: SUBSCRIPTION → `/finance/subscriptions/${id}/edit`, CDT_MATURITY → `/finance/investments/${id}`, CARD_PAYMENT → `/finance/accounts/${id}`.
  - `IconBadge` por tipo (`card-outline`, `trending-up-outline`, `repeat-outline`).
  - Nombre (1 línea), fecha `formatDateLocal(date, "d 'de' MMM")` y `daysUntilLabel` (color `danger` si `overdue`, `warning` si `urgent`, muted en otro caso).
  - Monto con `Amount`, o `$ ******` si no es `visible`.
  - `accessibilityLabel` "<nombre>, <días>, <monto u oculto>".
- [X] T027 [US4] Crear `apps/mobile/src/modules/finance/components/home/UpcomingWidget.tsx`:
  - `GlassCard` con título "Próximos vencimientos" y un `Badge` con el conteo si es > 0.
  - Muestra las primeras 5 `UpcomingRow` y, si hay más, un botón de texto "Ver todos (N)" / "Ver menos" que alterna un estado local `expanded`.
  - Visibilidad con `useAmountVisible('home-upcoming')`.
  - Sin elementos: una sola línea muted "Nada por vencer en los próximos 15 días" (usar `MATURING_SOON_DAYS` en el texto).
- [X] T028 [US4] Registrar `{ id: 'finance.upcoming', moduleId: 'finance', order: 30, span: 'half', Widget: UpcomingWidget }` en `apps/mobile/src/modules/finance/dashboard.ts`.

**Checkpoint**: el tablero completo de finanzas funciona; en ≥ 1024 px, Este mes y Vencimientos quedan lado a lado.

---

## Phase 7: User Story 5 - Tablero adaptable, privado y extensible (Priority: P3)

**Goal**: estados de carga, accesibilidad, tema y extensibilidad verificados.

**Independent Test**: quickstart #1, #2, #12–#14 + prueba de render de Inicio.

- [X] T029 [US5] Estado durante la descarga inicial (research R9): en `NetWorthWidget.tsx` y `UpcomingWidget.tsx`, si `useInitialSync().downloading` y no hay datos (`isEmpty` / lista vacía), mostrar "Cargando…" en tono muted en lugar del estado vacío. `MonthFlowWidget` muestra lo mismo si `downloading` y no hay movimientos.
- [X] T030 [P] [US5] Crear `apps/mobile/src/app/(app)/(tabs)/index.test.tsx`, basado en `apps/mobile/src/session/routing.test.tsx` y `jest.setup.tsx`:
  - Inicio renderiza el saludo, los tres widgets en orden (Patrimonio, Este mes, Próximos vencimientos) y el botón "Registrar movimiento".
  - Al tocar el ojo del encabezado, los montos pasan de `$ ******` a visibles en los tres widgets.
  - Al tocar el FAB aparecen las opciones Gasto, Ingreso y Transferencia.
- [X] T031 [US5] Revisar la accesibilidad de todos los componentes de `apps/mobile/src/modules/finance/components/home/`: etiquetas en español, áreas táctiles ≥ 48 dp y contraste con los tokens en claro y oscuro (si hace falta, ampliar `apps/mobile/src/theme/contrast.test.ts` para los pares texto/fondo nuevos, como `warning` sobre `surface`).

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T032 Ejecutar `cd apps/mobile && npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:tz` y corregir fallos.
- [ ] T033 Recorrer el [quickstart.md](./quickstart.md) completo en Android (gama media si es posible) y web a ≥ 1024 px; anotar resultados y cualquier desviación en este archivo.
- [X] T034 [P] Revisar que `apps/mobile/src/app/(app)/(tabs)/finance/index.tsx` (Resumen) siga igual (FR-028) y que no haya imports de `modules/dashboard.ts` desde `modules/registry.ts`.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T006)** → historias.
- **US1 (T007–T012)** y **US2 (T013–T016)**: independientes entre sí; ambas editan `useHomeFinance.ts` y `finance/dashboard.ts`, así que conviene hacerlas en secuencia o fusionar con cuidado.
- **US3 (T017–T022)**: solo depende de Foundational; T021 depende de T006. Puede ir en paralelo con US1, US2 y US4.
- **US4 (T023–T028)**: depende de Foundational; T025 edita `useHomeFinance.ts`, creado en T010 (si US4 va antes que US1, T025 crea el archivo).
- **US5 (T029–T031)**: depende de US1, US2, US3 y US4.
- **Polish (T032–T034)**: al final.

Dentro de cada historia: pruebas → dominio → hook → componentes → registro.

## Parallel Examples

```text
# Foundational
T002 (dashboard.test.ts) ∥ T004 (finance/dashboard.ts) ∥ T005 (useLiveToday)

# US1
T007 (netWorth.test) ∥ T008 (NetWorthChart height) ∥ T009 (useNetWorth today)

# US3 + US4 en paralelo (archivos distintos)
T017–T020 (formulario rápido y hoja) ∥ T023 → T024 (upcoming) ∥ T026 (UpcomingRow)
```

## Implementation Strategy

1. **MVP**: Setup + Foundational + US1. Inicio ya muestra el patrimonio con su gráfica.
2. **+ US2**: completa el núcleo P1 (patrimonio + mes en curso).
3. **+ US3**: la acción rápida, de alto valor diario e independiente del resto.
4. **+ US4**: vencimientos, con las pruebas de dominio primero.
5. **+ US5 y Polish**: estados de carga, pruebas de render, accesibilidad y el quickstart completo.

Hacer un commit pequeño por fase o por historia, solo cuando el usuario lo pida.

## Notas de implementación (2026-11-01)

- **T007**: el caso "12 puntos / último = neto actual" ya existía. La variación mensual se extrajo a la función pura `netWorthMonthDelta` en `domain/netWorth.ts`, con 3 pruebas nuevas, y `useHomeNetWorth` la usa.
- **T011 y otros widgets**: se agregó `components/home/WidgetHeader.tsx` (encabezado común y constante `HIDDEN_AMOUNT`). El estado vacío de Patrimonio se dibuja dentro del mismo `GlassCard` en lugar de `EmptyState`, para no anidar superficies de vidrio.
- **T026/T027**: el ícono del encabezado de Vencimientos es `notifications-outline` (el contrato no lo fijaba). El `Badge` con el conteo se pinta en tono `warning` si hay algo urgente.
- **T030**: la prueba de render vive en `apps/mobile/src/modules/home.test.tsx`, no en `src/app/`, porque `jest.config.js` ignora `src/app/` (Expo Router trataría el archivo como una ruta).
- **T031**: `contrast.test.ts` ya cubría `income`, `expense`, `transfer`, `warning` y `danger` sobre las superficies de ambos temas; no hizo falta ampliarlo.
- **T022 / T033**: pendientes de verificación manual en dispositivo (Android) y navegador. Lo automatizado pasa: typecheck, lint, formato, 421 pruebas (también con `test:tz`) y `expo export --platform web`.
