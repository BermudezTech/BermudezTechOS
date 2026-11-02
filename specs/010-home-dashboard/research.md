# Research: Dashboard de Inicio (finanzas)

Fase 0 del plan. Cada decisión responde a una incógnita del Technical Context o a un riesgo detectado al leer el código existente.

## R1. Registro de widgets por módulo

- **Decision**: nuevo registro `src/modules/dashboard.ts` con la interfaz `DashboardWidget` (`id`, `moduleId`, `order`, `span: 'full' | 'half'`, `Widget`). Cada módulo exporta su lista (Finanzas: `src/modules/finance/dashboard.ts`), y el registro las concatena, filtra por `activeModules` y ordena por `order`. Inicio solo itera `dashboardWidgets`.
- **Rationale**: es el mismo patrón que ya usan `modules/registry.ts` (navegación) y `financeSections[].summaryCards` (hub de Finanzas). Va en un archivo aparte de `registry.ts` porque ese archivo lo importan el menú y Ajustes, y no debe arrastrar componentes de Finanzas (evita ciclos de import y carga innecesaria).
- **Alternatives considered**: (a) agregar `widgets` a `AppModule` en `registry.ts`, descartado por el acoplamiento y los ciclos de import mencionados; (b) reutilizar `summaryCards` de Finanzas, descartado porque esas tarjetas dependen del mes elegido en el Resumen (`useSummaryMonth`) y FR-014 exige el mes en curso fijo.

## R2. Abrir el formulario de movimiento desde Inicio y volver a Inicio

- **Problem**: `/finance/transactions/new` vive en el stack de Finanzas. Si se abre desde Inicio, la app cambia a la pestaña Finanzas y, al guardar o cancelar (`goBack` → `router.dismiss()`), el usuario queda en Finanzas → Resumen, no en Inicio (incumple US3-4).
- **Decision**: crear una ruta modal a nivel de `(app)`: `src/app/(app)/quick-transaction.tsx`, registrada con `presentation: 'modal'` en `(app)/_layout.tsx` y con parámetro `?type=EXPENSE|INCOME|TRANSFER`. El cuerpo actual de `finance/transactions/new.tsx` se extrae a un componente compartido `NewTransactionScreen` (props `defaults`, `fallback`); las dos rutas lo usan. Como el modal se monta sobre `(tabs)`, `dismiss()` devuelve a la pestaña de origen (Inicio).
- **Sin cuentas**: en la ruta rápida, "Nueva cuenta" hace `router.dismiss()` y luego `router.push('/finance/accounts/new')`, en lugar del `router.replace` actual, que reemplazaría un modal de nivel raíz por una ruta anidada en las pestañas.
- **Alternatives considered**: (a) parámetro `returnTo=/` en la ruta de Finanzas, descartado porque el botón atrás de Android y el gesto de cerrar no pasan por `onSubmit` y el usuario igual caería en Finanzas; (b) duplicar el formulario, descartado por duplicar código.

## R3. Menú de acción rápida (Gasto / Ingreso / Transferencia)

- **Decision**: reutilizar `Fab` (ya existe, respeta `useNavInset` y el área segura) y `Sheet` (hoja inferior con fondo que cierra al tocar y `onRequestClose` para el botón atrás de Android). La hoja tiene tres `ListItem` con ícono y color de su tipo (`theme.colors.expense` / `income` / `transfer`). Al elegir, se cierra la hoja y se hace `router.push({ pathname: '/quick-transaction', params: { type } })`.
- **Rationale**: es lo más simple que cumple US3-2/3 (constitución V); no agrega capas de blur nuevas (VI) y el comportamiento de cierre ya está probado.
- **Alternatives considered**: un "speed dial" animado que despliega mini-botones sobre el FAB, descartado por ahora: necesita animaciones nuevas y manejo propio de fondo/atrás, y no aporta toques de menos.

## R4. Fecha "hoy" viva (medianoche y cambio de mes)

- **Problem**: `useToday()` memoiza `todayLocal()` una sola vez por montaje; Inicio puede quedar abierto pasada la medianoche (edge case y US2-7).
- **Decision**: nuevo hook `useLiveToday()` en `modules/finance/hooks/useFinanceData.ts`: guarda `todayLocal()` en estado, lo revisa cada 60 s y al volver la app a primer plano (`AppState` → `active`), y solo cambia el estado si el día es otro (no provoca renders extra). Los widgets del tablero usan `useLiveToday()`; `useNetWorth` acepta un `today` opcional para no duplicar lógica.
- **Rationale**: es local al tablero, no cambia el comportamiento del resto de pantallas y conserva el cálculo en America/Bogota (`todayLocal` ya usa `APP_TIME_ZONE`).
- **Alternatives considered**: hacer vivo el `useToday` global, descartado porque metería un temporizador en decenas de componentes de Finanzas y cambiaría su comportamiento fuera del alcance de esta feature.

## R5. Cálculo de próximos vencimientos

- **Decision**: función pura `upcomingItems({ subscriptions, cdts, accounts, balances }, today, windowDays = MATURING_SOON_DAYS)` en `domain/upcoming.ts` (detalle en [contracts/domain.md](./contracts/domain.md)):
  - **Suscripciones**: `subscriptionsWithNext` (ya resuelve día 31, cobro anual y fecha de inicio futura); entran las que tienen `daysUntil ≤ windowDays`; el monto es `amount`.
  - **CDTs**: `status === 'ACTIVE'` y `maturesOn ≤ today + windowDays`; incluye fechas pasadas (`overdue`). El monto es `maturityValue(cdt)`, el mismo valor del detalle. No se usa `isMaturingSoon` porque excluye los vencidos.
  - **Tarjetas**: `type === 'CREDIT_CARD'`, no archivadas ni borradas, `paymentDueDay` no nulo y `debtOf(balance) > 0`; fecha = próximo `paymentDueDay` ≥ hoy, ajustado al último día del mes (`clampedIsoDate`). El monto es la deuda actual.
  - **Orden**: fecha ascendente, luego tipo (CARD, CDT, SUBSCRIPTION), luego nombre (`localeCompare('es')`), luego id (orden estable).
- **Rationale**: reutiliza el dominio existente; una función pura y probada cumple FR-027. La ventana se define con la constante `MATURING_SOON_DAYS = 15` existente para mantener un solo criterio (clarificación).
- **Alternatives considered**: calcularlo dentro del componente, descartado porque sería imposible probarlo sin renderizar (FR-027).

## R6. Visibilidad de montos

- **Decision**: reutilizar `useAmountVisibilityStore`. Cada widget usa `useAmountVisible('home-<id>')`. El encabezado de Inicio tiene un `IconButton` de ojo que llama `setAll`, igual que el hub de Finanzas, así que la preferencia "todos" es compartida (US5-4). Los montos ocultos se muestran como `$ ******`, y la gráfica de patrimonio se oculta junto con el valor (sus ejes revelarían el monto).
- **Note**: el store es solo en memoria y arranca oculto al abrir la app (decisión de la spec 008); el tablero hereda ese comportamiento. Las barras de ingresos/gastos, que son proporciones, siguen visibles con los montos ocultos porque no revelan cifras.

## R7. Gráfica compacta de patrimonio

- **Decision**: reutilizar `NetWorthChart` agregándole una prop opcional `height` (default 180; en el tablero 120). La variación frente al mes anterior es `evolution[11].netWorth − evolution[10].netWorth` y se muestra como monto con signo y flecha.
- **Rationale**: los valores coinciden exactamente con Patrimonio 12M (SC-003) porque el cálculo y el componente son los mismos.

## R8. Rendimiento

- **Decision**: cada widget se suscribe solo a las listas que necesita (`useActive*` ya memoizadas por entidad) y memoiza sus cálculos con `useMemo` sobre `[listas, today]`. `netWorthEvolution` ya está optimizado (ordena una vez y usa búsqueda binaria, research R12 de la spec 004/008). Solo hay un `GlassCard` por widget (sin blur anidado).
- **Rationale**: SC-001 (< 1 s con 2 años de datos en gama media); Patrimonio ya hace el mismo cálculo dentro de ese presupuesto.

## R9. Estado durante la descarga inicial y sin datos

- **Decision**: si `useInitialSync().downloading` es verdadero y el widget no tiene datos, el widget muestra un estado de carga ("Cargando…" atenuado) en lugar de ceros. Fuera de la descarga, sin datos, muestra su estado vacío (Patrimonio: "Crea tu primera cuenta"; Vencimientos: una línea; Este mes: ceros, porque cero es un valor real del mes).

## R10. Navegación desde los widgets

- **Decision**: Patrimonio → `/finance/net-worth`; Este mes → `/finance/balance?granularity=MONTH&anchor=<hoy>`; fila de suscripción → `/finance/subscriptions/<id>/edit` (no hay pantalla de detalle; es lo mismo que hace la lista de Suscripciones); CDT → `/finance/investments/<id>`; tarjeta → `/finance/accounts/<id>`. Estas rutas cambian a la pestaña Finanzas, igual que cualquier acceso a una sección de Finanzas.
