# Tasks: Ingresos recurrentes con valor sugerido

**Input**: Design documents from `/specs/002-recurring-income/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: incluidos. La constitución exige pruebas de la lógica de montos, y el plan pide pruebas del dominio (periodo, duplicado) y del formulario (prellenado, valor editable).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario de [spec.md](./spec.md)

## Path Conventions

Cliente en `apps/mobile/src/`: rutas en `app/(tabs)/finance/`, lógica en `modules/finance/`. Abreviatura: `FIN/` = `apps/mobile/src/modules/finance/`.

---

## Phase 1: Setup

Sin tareas: no hay dependencias ni configuración nuevas (plan → Technical Context).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: modelo, store, validación, repositorio, dominio y seed que necesitan ambas historias.

**⚠️ CRITICAL**: ninguna historia puede empezar antes de completar esta fase.

- [X] T001 Add `RecurringIncomeCycle = 'MONTHLY' | 'YEARLY'`, `RecurringIncomeStatus = 'ACTIVE' | 'PAUSED'`, `RecurringIncomeInput` (`accountId: string`, `categoryId: string | null`, `name: string`, `icon: string | null`, `expectedAmount: Cents`, `cycle`, `expectedDay: number`, `expectedMonth: number | null`, `startDate: IsoDate`, `status`) and `RecurringIncome extends SyncFields, RecurringIncomeInput` in FIN/domain/types.ts; add `recurringIncomeId: string | null` and `recurringIncomePeriod: string | null` to `TransactionInput`; add `recurringIncomes` to `FinanceData` and `EntityName`
- [X] T002 Add `recurringIncomes: {}` to the empty data in FIN/data/mock/seed.ts and set `recurringIncomeId: null, recurringIncomePeriod: null` everywhere a transaction is built (seed, FIN/domain/testUtils.ts `makeTx`, `toTransactionInput` in FIN/domain/schemas/transaction.ts) so `npm run typecheck` passes (depends on T001)
- [X] T003 [P] Create FIN/domain/schemas/recurringIncome.ts mirroring FIN/domain/schemas/subscription.ts: `recurringIncomeInputSchema` ("`name` 1–100"; "`expectedAmount` > 0"; "`expectedDay` 1–31"; "`expectedMonth` 1–12; obligatorio en `YEARLY`, `null` en `MONTHLY`"; `accountId` required with message "Elige la cuenta de destino."; `status` enum ACTIVE/PAUSED) and `recurringIncomeFormSchema` + `RecurringIncomeFormValues`/`RecurringIncomeFormOutput` (transform sets `expectedMonth` to `null` when MONTHLY) (depends on T001)
- [X] T004 [P] Create FIN/domain/recurringIncomes.ts with pure functions: `periodFor(cycle, localDate)` ("`MONTHLY` → `YYYY-MM`; `YEARLY` → `YYYY`"), `hasEntryInPeriod(transactions, recurringIncomeId, period, excludeId?)` (ignores `deletedAt`), `prefillFrom(recurringIncome, today)` → `{ amount, accountId, categoryId, description: name, date: today }`, `expectedDateIn(recurringIncome, period)` (day clamped to month end with `clampedIsoDate` from `@/lib/dates`) and `canTransition` (`ACTIVE ⇄ PAUSED` only) (depends on T001)
- [X] T005 [P] Create FIN/domain/recurringIncomes.test.ts: periodFor monthly/yearly; hasEntryInPeriod true/false, ignores deleted and `excludeId`; prefillFrom fields; expectedDateIn day 31 in February → last day; canTransition (depends on T004)
- [X] T006 Create FIN/data/inMemory/recurringIncomesRepo.ts with `createRecurringIncome`, `updateRecurringIncome`, `setRecurringIncomeStatus`, `deleteRecurringIncome` (soft delete via `softDelete`, never touches transactions), following FIN/data/inMemory/subscriptionsRepo.ts; errors per contracts/finance-repository.md: `NOT_FOUND` (`accountId`), `CATEGORY_KIND_MISMATCH` (`categoryId`, message "Elige una categoría de ingreso."), `INVALID_TRANSITION` (depends on T003, T004)
- [X] T007 Extend transaction validation in FIN/data/inMemory/transactionsRepo.ts (and the transaction input schema): `RECURRING_INCOME_TYPE` if `recurringIncomeId` with `type ≠ INCOME`; `NOT_FOUND` (`recurringIncomeId`) if the template never existed (deleted ones are allowed); `INVALID_PERIOD` if exactly one of `recurringIncomeId`/`recurringIncomePeriod` is set (depends on T001)
- [X] T008 [P] Add the four methods to the interface in FIN/data/FinanceRepository.ts per contracts/finance-repository.md (depends on T001)
- [X] T009 Add `useActiveRecurringIncomes()` to FIN/hooks/useFinanceData.ts and create FIN/hooks/useRecurringIncomes.ts exporting the repo functions plus `useRecurringIncomes()` (list sorted ACTIVE first, then by name) and `useRecurringIncome(id)` (depends on T006)
- [X] T010 Seed in FIN/data/mock/seed.ts (full mode): template "Salario" (MONTHLY, `expectedDay` 30, payroll account, Salario income category, `expectedAmount` equal to the existing salary amount) and link the existing salary incomes to it with `recurringIncomePeriod` = `YYYY-MM` of their date, making at least one month differ from the expected value; keep FIN/data/mock/seed.test.ts passing (depends on T002, T004)

**Checkpoint**: `npm run typecheck && npm test` pasa; el store tiene plantillas.

---

## Phase 3: User Story 1 - Registrar un ingreso desde un ingreso recurrente (Priority: P1) 🎯 MVP

**Goal**: en "Nuevo movimiento" → Ingreso, elegir una plantilla prellena el formulario; el valor sigue editable y el movimiento queda vinculado con su periodo.

**Independent Test**: con el "Salario" del seed, registrar un ingreso desde él con y sin cambiar el valor; verificar el movimiento, su valor y que la plantilla no cambió (quickstart escenarios 2, 3 y 7).

### Tests for User Story 1

- [ ] T011 [P] [US1] *(omitida: pruebas manuales por decisión del usuario)* Extend FIN/components/transactions/TransactionForm.test.tsx: selector only visible with type INCOME when creating and with active templates; selecting prefills amount/account/category/description; editing the amount submits the edited value with `recurringIncomeId` and `recurringIncomePeriod`; switching type to EXPENSE clears the link; duplicate warning text shown when `hasEntryInPeriod`

### Implementation for User Story 1

- [X] T012 [P] [US1] Create FIN/components/recurringIncome/RecurringIncomePicker.tsx: `Select` labeled "Ingreso recurrente (opcional)" with option "Ninguno" and the active templates (name + formatted expected amount), props `value: string | null`, `options: RecurringIncome[]`, `onChange(id | null)`
- [X] T013 [US1] Integrate in FIN/components/transactions/TransactionForm.tsx: new props `recurringIncomes?: RecurringIncome[]` and `defaults.recurringIncomeId`; form field `recurringIncomeId`; render the picker only when `type === 'INCOME'` and `!initial`; on select call `setValue` with `prefillFrom` (R3); on deselect only clear the link; hint "Valor esperado: $ X" under the amount; warning (tone `warning`) "Ya registraste {nombre} en {periodo}." using `hasEntryInPeriod`; clear the link when type changes away from INCOME; on submit set `recurringIncomePeriod = periodFor(cycle, date)` (depends on T012)
- [X] T014 [US1] Update FIN/domain/schemas/transaction.ts `transactionFormSchema`/`toTransactionInput` to carry `recurringIncomeId` and compute the period; on edit, recompute the period if the date changed and keep the link (depends on T013)
- [X] T015 [US1] Wire apps/mobile/src/app/(tabs)/finance/transactions/new.tsx to pass `recurringIncomes` (active) and accept `?recurringIncomeId=` into `defaults`; pass existing link through in apps/mobile/src/app/(tabs)/finance/transactions/[id]/edit.tsx (depends on T013)
- [X] T016 [US1] Pass the templates to the form in apps/mobile/src/app/(tabs)/finance/transactions/[id]/edit.tsx so the duplicate check excludes the edited transaction (`excludeId`) (depends on T015)

**Checkpoint**: US1 funciona con el seed; "Ingresos del mes" y "Balance del mes" incluyen el ingreso registrado (FR-011).

---

## Phase 4: User Story 2 - Administrar ingresos recurrentes (Priority: P1)

**Goal**: sección propia para crear, editar, pausar, reactivar y eliminar plantillas.

**Independent Test**: crear "Honorarios", editar su valor, pausarlo (desaparece del selector) y eliminarlo (sus ingresos siguen) — quickstart escenarios 1, 4, 5 y 6.

### Tests for User Story 2

- [ ] T017 [P] [US2] *(omitida: pruebas manuales por decisión del usuario)* Create FIN/data/inMemory/recurringIncomesRepo.test.ts: create/update validation errors; changing `expectedAmount` does not modify linked transactions (FR-008); delete keeps linked transactions and their `recurringIncomeId` (FR-009); pause/resume transitions

### Implementation for User Story 2

- [X] T018 [P] [US2] Create FIN/components/recurringIncome/RecurringIncomeForm.tsx following FIN/components/subscriptions/SubscriptionForm.tsx: fields name, icon, expected amount (`AmountInput`), cycle (`SegmentedControl` Mensual/Anual), expected day, expected month (only Anual), start date, destination account and optional income category; uses `recurringIncomeFormSchema`
- [X] T019 [P] [US2] Create FIN/components/recurringIncome/RecurringIncomeListItem.tsx: icon, name, expected amount (`Amount`), "Mensual · día N" / "Anual · {mes} N", and a "Pausado" `Badge` when PAUSED
- [X] T020 [US2] Create apps/mobile/src/app/(tabs)/finance/recurring-income/index.tsx: `Screen` "Ingresos recurrentes", "+" `IconButton` to `new`, list with `RecurringIncomeListItem` opening `[id]/edit`, `EmptyState` "Aún no tienes ingresos recurrentes" with action "Nuevo ingreso recurrente" (depends on T019, T009)
- [X] T021 [US2] Create apps/mobile/src/app/(tabs)/finance/recurring-income/new.tsx (modal, fallback `/finance/recurring-income`) using `RecurringIncomeForm` + `createRecurringIncome` (depends on T018)
- [X] T022 [US2] Create apps/mobile/src/app/(tabs)/finance/recurring-income/[id]/edit.tsx (modal): form with `updateRecurringIncome`, button Pausar/Reactivar (`setRecurringIncomeStatus`) and Eliminar with `confirm` (`deleteRecurringIncome`); `NotFound` if missing (depends on T018)
- [X] T023 [US2] Register modal routes `recurring-income/new` and `recurring-income/[id]/edit` in apps/mobile/src/app/(tabs)/finance/_layout.tsx and add the section `{ id: 'recurring-income', label: 'Ingresos recurrentes', description: 'Salario y otros ingresos fijos', icon: 'cash-outline', route: '/finance/recurring-income' }` in FIN/sections.ts (depends on T020)

**Checkpoint**: US1 y US2 funcionan juntas: una plantilla creada en US2 aparece en el selector de US1; una pausada o eliminada no.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T024 [P] Add a "Ingresos recurrentes" section to docs/modulo-finanzas.md (after §4): purpose, fields, manual registration with editable value, duplicate warning, pause/delete rules; reference spec 002 (FR-014)
- [X] T025 [P] Review docs/db-finanzas.md §8 `recurring_incomes` and the new `transactions` columns against data-model.md and fix any mismatch (FR-014)
- [X] T026 [P] Add the new screens and components to docs/pantallas-y-componentes.md
- [X] T027 Run `npm run typecheck && npm run lint && npm run format:check && npm test` in apps/mobile and fix failures
- [ ] T028 *(pendiente: prueba manual del usuario)* Run quickstart.md scenarios 1–8 on Android (dev build) and web, light and dark theme

---

## Dependencies & Execution Order

- **Foundational (T001–T010)** bloquea todo. T001 → (T002, T003, T004, T007, T008) → T006 → T009; T010 tras T002 y T004.
- **US1 (T011–T016)** depende solo de Foundational: usa las plantillas del seed, así que no necesita US2.
- **US2 (T017–T023)** depende solo de Foundational; puede hacerse en paralelo con US1.
- **Polish** tras las historias que se quieran entregar.

## Parallel Example

```text
# Foundational, tras T001:
T003 recurringIncome.ts schema · T004 recurringIncomes.ts domain · T008 FinanceRepository.ts

# US1:
T011 TransactionForm.test.tsx · T012 RecurringIncomePicker.tsx

# US2:
T017 repo test · T018 RecurringIncomeForm.tsx · T019 RecurringIncomeListItem.tsx
```

## Implementation Strategy

1. **MVP**: Foundational + US1 → registrar el salario desde la plantilla del seed y validar (quickstart 2, 3, 7).
2. **Incremento**: US2 → administración completa de plantillas (quickstart 1, 4, 5, 6).
3. **Cierre**: Polish → documentación y verificación en Android y web.
