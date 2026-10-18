# Implementation Plan: Ingresos recurrentes con valor sugerido

**Branch**: `002-recurring-income` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-recurring-income/spec.md`

## Summary

Añadir al módulo de Finanzas una entidad **RecurringIncome** (plantilla de ingreso con valor esperado, periodicidad, día, cuenta y categoría) con su sección de administración (lista, crear, editar, pausar, eliminar) y un **selector en el formulario de movimientos** que, en tipo Ingreso, prellena los campos y vincula el movimiento a la plantilla y a su periodo. El valor sigue editable y nunca modifica la plantilla. No hay generación automática. Se reutilizan los patrones de la spec 001: store en memoria detrás de repositorios, esquemas zod, hooks y componentes glass. Se documenta en `docs/modulo-finanzas.md` y `docs/db-finanzas.md` (la tabla `recurring_incomes` ya está agregada).

## Technical Context

**Language/Version**: TypeScript (`strict: true`) sobre React Native 0.88 con Expo SDK 58

**Primary Dependencies**: las existentes (expo-router, zustand, react-hook-form, zod, decimal.js, date-fns + @date-fns/tz); no se añaden dependencias

**Storage**: N/A — store en memoria de la spec 001 (se reinicia al recargar); el modelo sigue `docs/db-finanzas.md` §8

**Testing**: Jest (`jest-expo`) + React Native Testing Library; ESLint y `tsc --noEmit`

**Target Platform**: Android 10+ (principal) y web

**Project Type**: Aplicación móvil multiplataforma (mobile + web) en monorepo

**Performance Goals**: igual que la spec 001; el selector abre al instante con decenas de plantillas

**Constraints**: offline; montos exactos en centavos; sin generación automática (FR-012); interfaz en español

**Scale/Scope**: 1 entidad nueva, 2 campos nuevos en Transaction, 3 rutas nuevas, 1 sección de Finanzas, cambios en el formulario de movimientos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Verificación | Estado |
|---|---|---|
| I. Offline-first | Lectura y escritura solo en el store local. `RecurringIncome` lleva `id` UUID de cliente, `createdAt`, `updatedAt` y `deletedAt`. `isDirty` sigue pospuesto, como en la spec 001. | ✅ |
| II. Sincronización | Fuera de alcance. No hay generación automática, así que no hace falta un ID determinista; el vínculo (`recurringIncomeId`, `recurringIncomePeriod`) está documentado en `docs/db-finanzas.md`. | ✅ N/A |
| III. Multiusuario y seguridad | Sin `user_id` en el cliente (la tabla lo define solo en el servidor). | ✅ |
| IV. Precisión monetaria y temporal | `expectedAmount` en `Cents`; el periodo se deriva de la fecha **local** del movimiento, que se almacena en UTC. | ✅ |
| V. Modularidad y alcance | Solo Finanzas; la entidad es nueva y no se reutiliza `Subscription`, por semántica distinta (research R1). Sin dependencias nuevas. | ✅ |
| VI. Liquid glass | Se reutilizan `GlassCard`, `Select`, tokens y los formularios existentes; sin blur nuevo. | ✅ |
| Flujo y calidad | Spec aprobada y este plan. Pruebas del dominio (periodo, duplicado) y del formulario (prellenado y valor editable). | ✅ |

**Resultado (pre-research)**: PASA. **Resultado (post-design)**: PASA, sin violaciones nuevas.

## Project Structure

### Documentation (this feature)

```text
specs/002-recurring-income/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── finance-repository.md
│   └── ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
apps/mobile/src/
├── app/(tabs)/finance/
│   ├── _layout.tsx                         # + rutas modales new/edit de recurring-income
│   ├── recurring-income/
│   │   ├── index.tsx                       # Lista (nuevo)
│   │   ├── new.tsx                         # Crear (nuevo)
│   │   └── [id]/edit.tsx                   # Editar, pausar, eliminar (nuevo)
│   └── transactions/new.tsx                # + param recurringIncomeId opcional
└── modules/finance/
    ├── domain/
    │   ├── types.ts                        # + RecurringIncome; Transaction + recurringIncomeId/Period
    │   ├── recurringIncomes.ts             # periodFor, hasEntryInPeriod, prefill (nuevo) + test
    │   └── schemas/{recurringIncome.ts, transaction.ts}
    ├── data/
    │   ├── FinanceRepository.ts            # + métodos de RecurringIncome
    │   ├── inMemory/{store.ts, recurringIncomesRepo.ts, transactionsRepo.ts}
    │   └── mock/seed.ts                    # + "Salario" y sus ingresos vinculados
    ├── hooks/useRecurringIncomes.ts        # (nuevo)
    ├── components/recurringIncome/
    │   ├── RecurringIncomeForm.tsx         # (nuevo)
    │   ├── RecurringIncomeListItem.tsx     # (nuevo)
    │   └── RecurringIncomePicker.tsx       # Selector dentro de TransactionForm (nuevo)
    ├── components/transactions/TransactionForm.tsx   # + selector, prellenado y aviso
    └── sections.ts                         # + sección "Ingresos recurrentes"
docs/
├── modulo-finanzas.md                      # + sección de ingresos recurrentes
└── db-finanzas.md                          # §8 recurring_incomes (ya agregado)
```

**Structure Decision**: se sigue la estructura de la spec 001 dentro de `apps/mobile/src` (rutas en `app/`, lógica en `modules/finance/`). No se toca `apps/api`.

## Complexity Tracking

No aplica: el Constitution Check no tiene violaciones.
