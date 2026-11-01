# Implementation Plan: Mejoras de UI en Finanzas (meses anteriores, categorías y periodos de patrimonio)

**Branch**: `008-improvements-ui-finances` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-improvements-ui-finances/spec.md`

## Summary

Cuatro mejoras de cliente sobre el módulo de Finanzas:

1. **Selector de mes en el Resumen**: las tarjetas de ingresos, gastos y balance pasan a leer un mes seleccionado en memoria (flechas y lista de meses agrupada por año, acotada al primer mes con movimientos). Al tocar una tarjeta se abre su pantalla dedicada en ese mes.
2. **Pantallas dedicadas**: "Ingresos por categoría" (`/finance/income`), simétrica a "Gastos por categoría" mediante un reporte por categoría parametrizado por tipo, y "Balance" (`/finance/balance`) con ingresos, gastos, balance y su evolución.
3. **Sección Categorías** (`/finance/categories`): crear y editar categorías de ingreso y egreso con un catálogo de más de 80 íconos agrupados y con búsqueda en español, y una paleta fija de 20 colores. Además, creación en línea desde el formulario de movimientos (chip "+ Nueva" que abre una hoja con el mismo formulario).
4. **Rango de Patrimonio**: selector 6M / 12M / 24M / Todo sobre la gráfica, con "Todo" desde el primer mes con datos patrimoniales.

No hay cambios de servidor ni de esquema. Las categorías ya se sincronizan por el motor genérico, y el servidor ya rechaza duplicados con `DUPLICATE` (índice `uq_categories_user_name_kind`).

## Technical Context

**Language/Version**: TypeScript estricto (~6.0), React Native 0.88, Expo SDK 58

**Primary Dependencies**: Expo Router, Zustand (estado), Zod + react-hook-form (formularios), decimal.js (montos), react-native-gifted-charts (gráficas), `@expo/vector-icons` 15 (Ionicons). No se añaden dependencias.

**Storage**: Expo SQLite local (fuente de verdad) vía el store de finanzas; sync existente con la API (FastAPI + PostgreSQL) sin cambios.

**Testing**: Jest (`jest-expo`) para dominio, repositorios locales y formularios; `npm run test:tz` para comprobar que los cálculos no dependen de la zona del dispositivo.

**Target Platform**: Android (principal) y web (Expo for Web)

**Project Type**: mobile-app (monorepo `apps/mobile` + `apps/api`; solo se toca `apps/mobile`)

**Performance Goals**: cambiar periodo o rango actualiza en < 1 s en Android de gama media con 2 años de movimientos (SC-006); la búsqueda de íconos filtra en cada pulsación sin retraso perceptible.

**Constraints**: offline-first (todo se lee y escribe en local), montos en centavos enteros (`Cents`), meses calculados en `America/Bogota`, blur limitado (las hojas reutilizan `GlassSurface` como `Select`).

**Scale/Scope**: 1 usuario por dispositivo, del orden de miles de movimientos y decenas de categorías. Son 4 pantallas nuevas (ingresos, detalle de ingresos por categoría, balance, categorías), 2 modales de categoría y 3 hojas (lista de meses, selector de íconos, editor de categoría en línea).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-first | Crear y editar categorías usa `insert`/`patch` del store local (IDs UUID, `is_dirty`, timestamps); reportes y selectores leen solo datos locales. | ✅ |
| II. Sync incremental y determinista | Sin cambios en el motor; las categorías ya son tabla sincronizable. El rechazo `DUPLICATE` del servidor se muestra con la UI de rechazos existente (spec 006). | ✅ |
| III. Multiusuario y seguridad | Sin `user_id` en cliente ni datos nuevos sensibles; sin scripts de terceros (los íconos vienen de la fuente empaquetada). | ✅ |
| IV. Precisión monetaria y temporal | Todos los totales se calculan con `Cents` y las utilidades de `lib/money`; los periodos con `periodRangeUtc` en `America/Bogota`; pruebas con `test:tz`. | ✅ |
| V. Modularidad y alcance | Solo módulo Finanzas; las nuevas secciones se añaden en `financeSections` (registro existente). Se reutiliza y generaliza el reporte de gastos en lugar de duplicarlo. | ✅ |
| VI. Multiplataforma liquid glass | Componentes del kit (`GlassCard`, `GlassSurface`, `SegmentedControl`); la paleta vive en `theme/tokens.ts` con prueba de contraste en ambos temas; las hojas usan `Modal` de RN (Android y web). | ✅ |
| Flujo y calidad | Spec y clarificaciones aprobadas; pruebas automatizadas para cálculos de ingresos, balance, rango de patrimonio, límites de mes y validación de categorías. | ✅ |

**Re-check post-diseño**: sin violaciones; no hace falta Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/008-improvements-ui-finances/
├── plan.md              # Este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   ├── navigation.md    # Rutas, secciones y parámetros
│   ├── domain.md        # Funciones de dominio y hooks nuevos/modificados
│   └── categories.md    # Repositorio, validación, catálogo de íconos y paleta
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/mobile/src/
├── app/(app)/(tabs)/finance/
│   ├── index.tsx                         # + MonthSelector sobre las estadísticas
│   ├── income/
│   │   ├── index.tsx                     # NUEVO Ingresos por categoría
│   │   └── [categoryId].tsx              # NUEVO movimientos de ingreso de una categoría
│   ├── balance/index.tsx                 # NUEVO Balance
│   ├── categories/
│   │   ├── index.tsx                     # NUEVO lista Egresos / Ingresos
│   │   ├── new.tsx                       # NUEVO modal crear (?kind=)
│   │   └── [id]/edit.tsx                 # NUEVO modal editar
│   ├── spending/index.tsx                # usa reporte generalizado + límite inferior
│   └── net-worth/index.tsx               # + selector de rango
├── modules/finance/
│   ├── sections.ts                       # + income, balance, categories
│   ├── domain/
│   │   ├── spending.ts                   # generaliza a categoryFlowReport(kind)
│   │   ├── monthSummary.ts               # + balanceEvolution, firstActivityMonth
│   │   ├── netWorth.ts                   # + NetWorthRange, firstNetWorthMonth, rango
│   │   ├── categories.ts                 # NUEVO normalización de nombre, sortOrder
│   │   └── schemas/category.ts           # NUEVO esquema Zod
│   ├── data/local/categoriesRepo.ts      # NUEVO createCategory / updateCategory
│   ├── data/FinanceRepository.ts         # + ErrorCode 'DUPLICATE_NAME'
│   ├── categories/
│   │   ├── iconCatalog.ts                # NUEVO catálogo agrupado + palabras clave
│   │   ├── searchIcons.ts                # NUEVO búsqueda sin tildes
│   │   └── paletteLabels.ts              # NUEVO nombres en español de la paleta
│   ├── hooks/
│   │   ├── useSummaryMonth.ts            # NUEVO store en memoria del mes del Resumen
│   │   ├── useMonthSummary.ts            # acepta periodo
│   │   ├── useIncome.ts / useBalance.ts  # NUEVOS
│   │   ├── useCategoriesAdmin.ts         # NUEVO listas por tipo + create/update
│   │   └── useNetWorth.ts                # acepta rango
│   └── components/
│       ├── summary/MonthSelector.tsx     # NUEVO flechas + nombre del mes
│       ├── summary/MonthPickerSheet.tsx  # NUEVO lista agrupada por año
│       ├── summary/Month*Card.tsx        # leen el mes seleccionado; nuevos href
│       ├── spending/PeriodSwitcher.tsx   # + prop `min` (límite inferior)
│       ├── balance/BalanceEvolutionChart.tsx  # NUEVO barras ingresos/gastos + línea balance
│       ├── categories/CategoryForm.tsx   # NUEVO nombre, tipo, ícono, color, vista previa
│       ├── categories/IconPickerSheet.tsx    # NUEVO grupos + búsqueda
│       ├── categories/ColorPalettePicker.tsx # NUEVO
│       ├── categories/CategoryEditorSheet.tsx # NUEVO hoja para crear en línea
│       ├── netWorth/NetWorthRangeSelector.tsx # NUEVO (SegmentedControl)
│       └── transactions/TransactionForm.tsx   # + chip "+ Nueva"
├── components/ui/Icon.tsx                # respaldo para íconos inexistentes
├── lib/dates.ts                          # + clampPeriod, isSamePeriod, monthsByYear
└── theme/tokens.ts                       # categoryPalette ampliada a 20 colores
```

**Structure Decision**: solo cliente, dentro de `apps/mobile/src`, siguiendo la organización existente: rutas en `app/(app)/(tabs)/finance`, y lógica pura en `modules/finance/domain` con pruebas junto al archivo (`*.test.ts`). Los repos locales van en `data/local` y la UI en `modules/finance/components/<sección>`. `apps/api` no cambia.

## Complexity Tracking

No aplica: no hay violaciones de la constitución.
