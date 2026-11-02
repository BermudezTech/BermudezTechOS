# Implementation Plan: Dashboard de Inicio (finanzas)

**Branch**: `010-home-dashboard` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-home-dashboard/spec.md`

## Summary

La pestaña Inicio pasa de mostrar solo un saludo a ser un tablero con widgets que aportan los módulos mediante un registro nuevo (`src/modules/dashboard.ts`). Finanzas aporta tres widgets:

1. **Patrimonio neto**: valor actual, variación frente al mes anterior y gráfica compacta de 12 meses. Reutiliza `netWorthReport`/`netWorthEvolution` y `NetWorthChart`.
2. **Este mes**: ingresos vs. gastos con barras proporcionales y el balance neto. Reutiliza `monthSummary`, siempre sobre el mes en curso.
3. **Próximos vencimientos**: cobros de suscripciones activas, CDTs activos por vencer o vencidos y pagos de tarjetas con deuda, dentro de 15 días. Usa una función de dominio nueva y probada, `upcomingItems`.

Además hay un **FAB** que abre una hoja Gasto / Ingreso / Transferencia. La opción elegida abre el formulario existente como modal sobre las pestañas, en una ruta nueva `/quick-transaction`, para que al cerrar se vuelva a Inicio.

No hay cambios de servidor, esquema ni sincronización.

## Technical Context

**Language/Version**: TypeScript estricto (~6.0), React Native 0.88, Expo SDK 58

**Primary Dependencies**: Expo Router (Stack/Tabs de `expo-router/ui`), Zustand, decimal.js, react-native-gifted-charts, react-native-reanimated (FAB), `@expo/vector-icons` (Ionicons). No se añaden dependencias.

**Storage**: Expo SQLite local vía el store de finanzas (`useFinanceStore`); solo lectura en el tablero; la escritura la hace el formulario de movimientos existente.

**Testing**: Jest (`jest-expo`) para dominio (`upcoming.test.ts`), registro (`dashboard.test.ts`) y un test de render de Inicio; `npm run test:tz`.

**Target Platform**: Android (principal) y web (Expo for Web)

**Project Type**: mobile-app (monorepo; solo cambia `apps/mobile`)

**Performance Goals**: el tablero se ve completo en < 1 s tras el saludo, en Android de gama media con 2 años de datos (SC-001); sin renders extra por el temporizador del día (R4).

**Constraints**: offline-first; montos en `Cents`; fechas en `America/Bogota`; un solo `GlassCard` por widget (sin blur anidado); la visibilidad de montos se comparte con el hub de Finanzas.

**Scale/Scope**: 1 pantalla rediseñada (Inicio), 1 ruta modal nueva, 5 componentes nuevos, 1 módulo de dominio nuevo, 2 registros nuevos y 1 componente extraído (`NewTransactionScreen`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-first | Los widgets leen solo del store local y se actualizan con sus cambios; el registro rápido usa el mismo `createTransaction` local. | ✅ |
| II. Sync incremental y determinista | Sin cambios en el motor ni en las tablas. | ✅ |
| III. Multiusuario y seguridad | Sin datos nuevos ni `user_id` en el cliente; sin scripts de terceros. | ✅ |
| IV. Precisión monetaria y temporal | Todos los cálculos en `Cents` con `lib/money`; las proporciones de las barras son solo presentación. "Hoy" y las fechas de cobro/pago en Bogotá (`todayLocal`, `clampedIsoDate`); pruebas con `test:tz`. | ✅ |
| V. Modularidad y alcance | Solo Finanzas; el registro de widgets permite que otros módulos aporten sin tocar Inicio (FR-002, SC-005). Se reutiliza el dominio, la gráfica, `Fab` y `Sheet`; el formulario se extrae en lugar de duplicarse. | ✅ |
| VI. Multiplataforma liquid glass | Componentes del kit con tokens del tema en claro/oscuro; animación del FAB con Reanimated (ya existe); sin capas de blur nuevas; cuadrícula adaptable con `useIsWide`. | ✅ |
| Flujo y calidad | Spec con clarificaciones resueltas; pruebas automatizadas del cálculo de vencimientos (FR-027) y del registro. | ✅ |

**Re-check post-diseño**: sin violaciones; no hace falta Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/010-home-dashboard/
├── plan.md              # Este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   ├── domain.md        # upcomingItems, useLiveToday, hooks del tablero
│   ├── navigation.md    # /quick-transaction y destinos desde los widgets
│   └── widgets.md       # Registro de widgets, pantalla de Inicio y componentes
├── checklists/requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/mobile/src/
├── app/(app)/
│   ├── _layout.tsx                         # + Stack.Screen "quick-transaction" (modal)
│   ├── quick-transaction.tsx               # NUEVO: NewTransactionScreen con fallback "/"
│   └── (tabs)/
│       ├── index.tsx                       # REESCRITO: saludo compacto + widgets + FAB
│       └── finance/transactions/new.tsx    # usa NewTransactionScreen (sin cambio de comportamiento)
├── modules/
│   ├── dashboard.ts                        # NUEVO registro de widgets (+ dashboard.test.ts)
│   └── finance/
│       ├── dashboard.ts                    # NUEVO widgets de Finanzas
│       ├── domain/
│       │   ├── upcoming.ts                 # NUEVO upcomingItems, nextMonthlyDate, daysUntilLabel
│       │   └── upcoming.test.ts            # NUEVO
│       ├── hooks/
│       │   ├── useFinanceData.ts           # + useLiveToday
│       │   ├── useNetWorth.ts              # + parámetro today opcional
│       │   └── useHomeFinance.ts           # NUEVO useHomeNetWorth, useHomeMonthFlow, useUpcoming
│       └── components/
│           ├── netWorth/NetWorthChart.tsx  # + prop height opcional
│           ├── transactions/NewTransactionScreen.tsx  # NUEVO (extraído de new.tsx)
│           └── home/                       # NUEVO
│               ├── NetWorthWidget.tsx
│               ├── MonthFlowWidget.tsx
│               ├── UpcomingWidget.tsx
│               ├── UpcomingRow.tsx
│               └── QuickActionSheet.tsx
```

**Structure Decision**: cliente únicamente (`apps/mobile`). Los widgets viven dentro del módulo dueño (`modules/finance/components/home/`) y se exponen por `modules/finance/dashboard.ts`; el registro general `modules/dashboard.ts` es independiente de `modules/registry.ts` para no acoplar la navegación a los componentes (research R1).

## Decisiones clave (ver [research.md](./research.md))

- R1: registro de widgets por módulo, aparte de `registry.ts`.
- R2: ruta modal `/quick-transaction` a nivel `(app)`, para volver a Inicio al guardar o cancelar.
- R3: `Fab` + `Sheet` para el menú de tipos.
- R4: `useLiveToday` para el cambio de día y de mes con la app abierta.
- R5: `upcomingItems` puro y probado; ventana = `MATURING_SOON_DAYS` (15).
- R6: visibilidad de montos compartida (`setAll`), con la gráfica oculta junto con los montos.
- R10: las filas de suscripción abren su edición (no existe pantalla de detalle).

## Complexity Tracking

No aplica: no hay violaciones de la constitución.
