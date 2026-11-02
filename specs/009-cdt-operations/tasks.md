---

description: "Lista de tareas: Operaciones de CDT"
---

# Tasks: Operaciones de CDT (borrar, alta sin histórico, vencimiento comercial y renovación)

**Input**: documentos de diseño en `/specs/009-cdt-operations/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **incluidas**. La constitución exige pruebas automatizadas para la lógica de montos, saldos y sync. En cada historia, las pruebas se escriben primero y deben fallar antes de implementar.

**Organization**: por historia de usuario (spec.md). Prioridades: US1, US2 y US3 son P1; US4 y US5 son P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (otro archivo, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1…US5)
- Rutas relativas a la raíz del repo. `M/` = `apps/mobile/src/`, `F/` = `apps/mobile/src/modules/finance/`, `A/` = `apps/api/`. Las descripciones usan siempre la ruta completa.

---

## Phase 1: Setup

**Purpose**: dejar la rama lista. No se añaden dependencias (plan.md).

- [X] T001 Verificar que en la rama `009-cdt-operations` pasan las pruebas existentes: `cd apps/mobile && npm test && npm run typecheck` y `cd apps/api && uv run pytest`. Anotar cualquier fallo previo antes de empezar.

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: esquema de `cdts` en cliente y servidor, tipos del dominio y sync. Todas las historias dependen de estos campos.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta terminar esta fase.

### Servidor

- [X] T002 Actualizar el modelo en `apps/api/app/db/models/cdts.py`:
  - `source_account_id: Mapped[uuid.UUID | None]`.
  - Quitar `UniqueConstraint("account_id", name="uq_cdts_account_id")` y añadir `Index("ix_cdts_user_id_account_id", "user_id", "account_id")`.
  - Nuevas columnas `maturity_value_override`, `settled_gross_interest`, `settled_withholding` y `settled_net_interest`, todas `Mapped[Decimal | None] = mapped_column(Money)`.
  - Nuevos checks con el helper `check()`:
    - `settled_all_or_none`: los tres `settled_*` nulos o los tres no nulos.
    - `settled_consistent`: `settled_gross_interest - settled_withholding = settled_net_interest`.
    - `settled_non_negative`: los tres ≥ 0.
    - `maturity_value_gte_principal`: `maturity_value_override IS NULL OR maturity_value_override >= principal`.
- [X] T003 Crear la migración `apps/api/alembic/versions/0002_cdt_operations.py` (`revision="0002"`, `down_revision="0001"`) con los mismos cambios de T002:
  - `alter_column source_account_id nullable=True`.
  - `drop_constraint uq_cdts_account_id` y `create_index ix_cdts_user_id_account_id`.
  - `add_column` ×4 `NUMERIC(14,2) NULL` y `create_check_constraint` ×4. Usar los nombres reales que genera la convención de `app/db/base.py`; revisarlos en `0001_initial_schema.py`.
  - `downgrade` en orden inverso. Debe fallar con un mensaje claro si existen filas con `source_account_id IS NULL`.
- [X] T004 Actualizar `CdtRecord` en `apps/api/app/modules/sync/entities/cdts/schemas.py` según [contracts/sync.md](./contracts/sync.md):
  - `source_account_id: uuid.UUID | None = None`.
  - Cuatro campos `MoneyStr | None = None`.
  - En `_single_record_rules`:
    - `maturity_value_override` nulo o ≥ `principal`.
    - `settled_*` todos nulos o todos presentes, cada uno ≥ 0, y `gross − withholding == net`.
- [X] T005 Actualizar `CdtsSyncEntity` en `apps/api/app/modules/sync/entities/cdts/entity.py`:
  - Quitar `constraint_codes["uq_cdts_account_id"]`.
  - `reference_fields = {"accounts": ("type",), "cdts": ("account_id",)}`.
  - En `check_coherence`:
    - Comparar origen ≠ cuenta solo si `source_account_id is not None`.
    - **Nueva regla**: si `renewed_from_cdt_id` no es nulo, `account_id` debe ser igual al `account_id` del anterior. Si el anterior viene en el mismo lote, tomarlo de `batch`. Si no, `INCOHERENT` con el mensaje "La renovación debe usar la misma cuenta del CDT anterior.".
- [X] T006 [P] Pruebas del servidor en `apps/api/tests/unit/sync/test_coherence.py` y `apps/api/tests/integration/sync/test_push_entities.py`:
  - Se acepta un CDT con `source_account_id` nulo.
  - Se acepta una renovación en la misma cuenta, tanto en el mismo lote como en lotes separados.
  - Se rechaza (`INCOHERENT`) una renovación con otra cuenta.
  - Se rechazan (`VALIDATION_ERROR`) `settled_*` parciales o incoherentes y un override menor que `principal`.
  - Dos CDTs de la misma cadena pueden compartir `account_id`.
  - En `apps/api/tests/integration/sync/test_money_roundtrip.py`: ida y vuelta exacta de los 4 montos nuevos.

### Cliente

- [X] T007 Actualizar los tipos en `apps/mobile/src/modules/finance/domain/types.ts`:
  - En `CdtInput`: `sourceAccountId: string | null`; nuevos `maturityValueOverride: Cents | null`, `settledGrossInterest: Cents | null`, `settledWithholding: Cents | null` y `settledNetInterest: Cents | null`.
  - Exportar `type RenewalOperation = 'RENEW' | 'ADD' | 'WITHDRAW'`, `type CdtOrigin = 'TRANSFER' | 'EXISTING' | 'RENEWAL'` y la interfaz `CdtRenewalInput` tal como está en [contracts/domain.md](./contracts/domain.md).
- [X] T008 Actualizar `TABLE_COLUMNS.cdts` en `apps/mobile/src/sync/tables.ts`:
  - `source_account_id` con `nullable = true`.
  - Añadir `col('maturity_value_override','maturityValueOverride','money',true)`, `col('settled_gross_interest','settledGrossInterest','money',true)`, `col('settled_withholding','settledWithholding','money',true)` y `col('settled_net_interest','settledNetInterest','money',true)`.
- [X] T009 Añadir la migración local 2 en `apps/mobile/src/db/schema.ts` (`MIGRATIONS = [migration1, migration2]`). Reconstruye `cdts`:
  1. `CREATE TABLE cdts_new` con el esquema actual de `createTable('cdts')`, renombrado.
  2. `INSERT INTO cdts_new (<lista EXPLÍCITA de columnas de la v1: id, created_at, updated_at, deleted_at, account_id, issuer, certificate_number, principal, annual_rate_ea, annual_rate_nominal, term_days, opened_on, matures_on, interest_payment, withholding_rate, source_account_id, payout_account_id, status, renewed_from_cdt_id, server_updated_at, is_dirty>) SELECT … FROM cdts`.
  3. `DROP TABLE cdts`, `ALTER TABLE cdts_new RENAME TO cdts` y recrear `idx_cdts_dirty`.

  Debe funcionar tanto en una instalación nueva (la v1 ya tiene las columnas nuevas) como en una actualización desde la v1 (research R9).
- [X] T010 [P] Pruebas de la migración en `apps/mobile/src/db/schema.test.ts`:
  - Una base v1 con un CDT pasa a la v2 conservando todas sus columnas, con los campos nuevos en NULL y `source_account_id` aceptando NULL.
  - Una instalación nueva llega a `user_version = 2`.
  - Actualizar las aserciones de columnas en `apps/mobile/src/db/rows.test.ts` y `apps/mobile/src/sync/mappers.test.ts`.
- [X] T011 Actualizar `cdtInputSchema` en `apps/mobile/src/modules/finance/domain/schemas/cdt.ts`:
  - `sourceAccountId: z.string().nullable()`.
  - `maturityValueOverride`: entero positivo o null.
  - `settled*`: entero ≥ 0 o null.
  - Refinamientos: override nulo o ≥ `principal` (mensaje "El valor final no puede ser menor que el capital."), y `settled*` todos nulos o todos presentes con bruto − retención = neto.
- [X] T012 Actualizar las fábricas de prueba en `apps/mobile/src/modules/finance/domain/testUtils.ts` y `apps/mobile/src/modules/finance/data/local/atomicity.test.ts` para que construyan `Cdt` con los campos nuevos en `null`. Ajustar `checkAccounts` en `apps/mobile/src/modules/finance/data/local/cdtsRepo.ts`, que ya ignora ids nulos, para que compile con el tipo nullable.

**Checkpoint**: `npm test`, `npm run typecheck` y `uv run pytest` pasan. El esquema está listo y no hay cambios de comportamiento.

---

## Phase 3: User Story 1 - Fecha de vencimiento en días comerciales (Priority: P1) 🎯 MVP

**Goal**: la fecha de vencimiento propuesta replica `helpComercialDays` (FR-001 a FR-003).

**Independent Test**: en el formulario de nuevo CDT, 2026-01-15 + 90 → 2026-04-15; 2026-01-31 + 30 → 2026-03-03; 2026-01-15 + 45 → 2026-03-02.

### Tests for User Story 1

- [X] T013 [P] [US1] Crear `apps/mobile/src/lib/dates.commercial.test.ts`:
  - Copiar **tal cual** la función `helpComercialDays` del usuario (ver spec.md / research R1) como oráculo local del test.
  - Comparar `addCommercialDays` contra el oráculo para cada fecha entre 2024-01-01 y 2030-12-31 y cada plazo de 1 a 360.
  - Comprobar la tabla de FR-001 (8 filas).
  - Para plazos múltiplos de 30 hasta 3650: mismo día *m* meses después cuando el día existe en el mes destino.
  - Debe pasar también con `npm run test:tz`.

### Implementation for User Story 1

- [X] T014 [US1] Implementar `addCommercialDays(openedOn: IsoDate, termDays: number): IsoDate` en `apps/mobile/src/lib/dates.ts` con aritmética de calendario pura (sin `new Date` local): `m = floor(termDays/30)`, `extra = Σ_{k=0..m-1}(díasDelMes(año, mesApertura+k) − 30)` (el mes y el año avanzan juntos), y el resultado es `addDays(openedOn, termDays + extra)` (research R1).
- [X] T015 [US1] En `apps/mobile/src/modules/finance/domain/cdts.ts`, hacer que `defaultMaturesOn` delegue en `addCommercialDays`. Actualizar los casos de `defaultMaturesOn` en `apps/mobile/src/modules/finance/domain/cdts.test.ts` a los valores comerciales.
- [X] T016 [US1] Verificar que `apps/mobile/src/modules/finance/components/investments/CdtForm.tsx` sigue proponiendo el vencimiento con `defaultMaturesOn`, recalculándolo mientras `maturesTouched` sea falso, y que se respeta la regla "vencimiento > apertura" (FR-003).

**Checkpoint**: US1 se puede demostrar en el formulario actual.

---

## Phase 4: User Story 2 - Registrar un CDT existente sin histórico (Priority: P1)

**Goal**: crear un CDT sin cuenta de origen ni movimientos; la cuenta INVESTMENT arranca con el capital como saldo inicial (FR-004 a FR-006).

**Independent Test**: crear un CDT "existente" → el patrimonio sube el valor del capital y ninguna otra cuenta cambia de saldo.

### Tests for User Story 2

- [X] T017 [P] [US2] Crear `apps/mobile/src/modules/finance/data/local/cdtsRepo.test.ts` (patrón de `atomicity.test.ts` / `persistence.test.ts`):
  - `createCdt` con `sourceAccountId = null` crea la cuenta INVESTMENT con `openingBalance = principal` y **0** transacciones.
  - Con `sourceAccountId` crea la transferencia de apertura por `principal` y `openingBalance = 0`, como hoy.
  - En ambos casos, `balancesByAccount` de las demás cuentas no cambia en el caso existente.
  - Se acepta una apertura en el pasado.

### Implementation for User Story 2

- [X] T018 [US2] Añadir `cdtOrigin(c: Cdt): CdtOrigin` en `apps/mobile/src/modules/finance/domain/cdts.ts` (`renewedFromCdtId` → `'RENEWAL'`; `sourceAccountId` → `'TRANSFER'`; si no, `'EXISTING'`) y su prueba en `apps/mobile/src/modules/finance/domain/cdts.test.ts`.
- [X] T019 [US2] En `createCdt` de `apps/mobile/src/modules/finance/data/local/cdtsRepo.ts`:
  - Si `valid.sourceAccountId === null`, crear la cuenta con `openingBalance: valid.principal` y **no** crear la transacción de apertura.
  - Si no, mantener el comportamiento actual.
  - Todo dentro del mismo `batch`.
- [X] T020 [US2] En `cdtFormSchema` de `apps/mobile/src/modules/finance/domain/schemas/cdt.ts`:
  - Añadir `origin: z.enum(['TRANSFER','EXISTING'])`.
  - `sourceAccountId` obligatorio solo si `origin === 'TRANSFER'` (mensaje "Elige la cuenta de origen.").
  - `payoutAccountId: z.string().nullable()` opcional.
- [X] T021 [US2] En `apps/mobile/src/modules/finance/components/investments/CdtForm.tsx`:
  - Añadir el segmentado "Origen del dinero" con las opciones *Transferencia desde una cuenta* / *CDT existente (sin movimiento)*, por defecto Transferencia.
  - Mostrar "Cuenta de origen" solo con Transferencia y enviar `sourceAccountId: null` con Existente.
  - "Cuenta destino al vencer" admite la opción "Sin definir" (null) y su valor por defecto es null (FR-018a).
  - Ver [contracts/ui.md](./contracts/ui.md).
- [X] T022 [US2] En `apps/mobile/src/modules/finance/components/investments/CdtDetailPanel.tsx`, mostrar la fila "Origen" con "Transferencia desde {cuenta}", "CDT existente" o "Renovación de {fecha}" según `cdtOrigin`. Si `sourceAccountId` es null, no romper la fila "Cuenta de origen": ocultarla.

**Checkpoint**: US1 y US2 funcionan juntas.

---

## Phase 5: User Story 3 - Valores inicial/final editables y tasa nominal calculada (Priority: P1)

**Goal**: valoración con base 360, valor neto al vencimiento editable (override), tasa nominal derivada, sin interés causado, y edición de CDTs ya creados (FR-007 a FR-013, research R2, R3, R11 y R12).

**Independent Test**: 10.000.000 · TEA 10 % · 180 días · 4 % → 10.468.564,94 y nominal 9,7618 %. Al editar el valor final a 10.470.000 se guarda ese valor y cambia la nominal.

### Tests for User Story 3

- [X] T023 [P] [US3] Reescribir `apps/mobile/src/modules/finance/domain/cdtValuation.test.ts`:
  - `grossInterest` y `calculatedMaturityValue` con base 360 (caso de quickstart: 1.000.000.000 centavos → 1.046.856.494).
  - `nominalFromEa('10', 180) === '9.7618'`.
  - `nominalFromMaturityValue` con override.
  - `maturityValue` usa el override cuando no es null.
  - `settlement(t, value)` cumple `gross − withholding === net` exacto en al menos 20 combinaciones (incluida retención 0, donde bruto = neto).
  - Rechazo de valor < capital.
- [X] T024 [P] [US3] Actualizar `apps/mobile/src/modules/finance/domain/netWorth.test.ts`: un CDT vivo aporta `principal` (ya no `currentValue`), y un INCOME ligado al CDT no se resta.

### Implementation for User Story 3

- [X] T025 [US3] Reescribir `apps/mobile/src/modules/finance/domain/cdtValuation.ts` según [contracts/domain.md](./contracts/domain.md):
  - Implementar `grossInterest`, `calculatedMaturityValue`, `maturityValue`, `nominalFromEa`, `nominalFromMaturityValue`, `nominalRate` y `settlement`, con Decimal y redondeo solo al final (`fromDecimal`).
  - Nominal con 4 decimales.
  - En `settlement`: `net = value − principal`; `gross = round(net / (1 − ret))`; `withholding = gross − net`.
  - **Eliminar** `accruedInterest`, `currentValue`, `elapsedDays`, `totalInterest` y `withholdingAmount`.
- [X] T026 [US3] Actualizar `apps/mobile/src/modules/finance/domain/cdts.ts`:
  - `CdtValues` según contracts/domain.md: sin `accrued`/`currentValue`/`totalInterest`/`withholding`/`expectedNet`; con `maturityValue`, `isOverridden` y `settlement`.
  - `daysElapsed` se calcula localmente con `daysBetween`, acotado a `[0, termDays]`.
  - `cdtValues(cdt, cdts, today)` ya no recibe transacciones.
  - Ajustar `apps/mobile/src/modules/finance/domain/cdts.test.ts`.
- [X] T027 [US3] En `apps/mobile/src/modules/finance/domain/netWorth.ts`, valorar cada CDT vivo por `c.principal`, eliminar `paidInterest` y el import de `currentValue` (R11).
- [X] T028 [US3] En `apps/mobile/src/modules/finance/data/local/cdtsRepo.ts`, en `createCdt` y `updateCdt`, calcular y persistir `annualRateNominal = nominalRate(valid)` antes de guardar. La nominal nunca viene del formulario (FR-010).
- [X] T029 [US3] En `cdtFormSchema` de `apps/mobile/src/modules/finance/domain/schemas/cdt.ts`:
  - **Quitar** `annualRateNominal`.
  - Añadir `maturityValue: amountField()` y `maturityValueEdited: z.boolean()`.
  - Refinamiento: si está editado, `maturityValue ≥ principal`, con path `maturityValue` y mensaje "El valor final no puede ser menor que el capital." (FR-012).
  - El output mapea `maturityValueOverride = maturityValueEdited ? cents : null`.
- [X] T030 [US3] En `apps/mobile/src/modules/finance/components/investments/CdtForm.tsx`:
  - Quitar el campo "Tasa nominal" como entrada.
  - Añadir "Valor neto al vencimiento" (`AmountInput`) prellenado en vivo con `calculatedMaturityValue` mientras no esté editado. Al editarlo, `maturityValueEdited = true` y aparece la insignia "Ajustado al banco".
  - Mostrar "Tasa nominal" en solo lectura, recalculada en vivo con `nominalRate`.
  - Si con el valor editado cambian capital, TEA, plazo o retención, mostrar el aviso en línea "El valor final fue ajustado a mano." con el botón "Recalcular", que pone `maturityValueEdited = false` (FR-011).
- [X] T031 [US3] Actualizar `apps/mobile/src/modules/finance/components/investments/CdtDetailPanel.tsx`:
  - Encabezado: "Valor neto esperado al vencimiento" (`maturityValue`) con la insignia "Ajustado al banco" si `isOverridden`.
  - Tarjeta de valores: Capital, Interés bruto, Retención y Valor neto al vencimiento, desde `settlement`.
  - **Eliminar** "Interés causado a la fecha" y "Valor actual estimado" (FR-013).
- [X] T032 [P] [US3] Actualizar `apps/mobile/src/modules/finance/components/investments/CdtListItem.tsx` y `apps/mobile/src/modules/finance/components/netWorth/NetWorthBreakdown.tsx` para que usen `maturityValue`/`principal` en lugar de `currentValue`.
- [X] T033 [US3] Actualizar `apps/mobile/src/modules/finance/hooks/useCdts.ts` a la nueva firma `cdtValues(cdt, cdts, today)`, sin transacciones, y revisar `apps/mobile/src/modules/finance/hooks/useNetWorth.ts`.
- [X] T034 [US3] Edición (R12) en `apps/mobile/src/modules/finance/data/local/cdtsRepo.ts`, dentro de `updateCdt`, todo en un `batch`:
  - Rechazar si el CDT tiene sucesor vivo.
  - Impedir cambiar el origen.
  - Si cambia `principal`: con origen TRANSFER, actualizar el `amount` de la transferencia de apertura (`cdtId = id`, `type = 'TRANSFER'`, `counterAccountId = accountId`); con origen EXISTING, actualizar el `openingBalance` de la cuenta.
  - Añadir los casos a `apps/mobile/src/modules/finance/data/local/cdtsRepo.test.ts`.
- [X] T035 [US3] Mover `apps/mobile/src/app/(app)/(tabs)/finance/investments/[id].tsx` a `apps/mobile/src/app/(app)/(tabs)/finance/investments/[id]/index.tsx` y crear `apps/mobile/src/app/(app)/(tabs)/finance/investments/[id]/edit.tsx`, que monta `CdtForm` en modo edición:
  - Prop `initial?: Cdt`; el origen se muestra como texto y no es editable.
  - Llama a `updateCdt` y vuelve al detalle.
  - Añadir el botón "Editar" en `CdtDetailPanel.tsx`, solo si no hay sucesor vivo.

**Checkpoint**: las historias P1 están completas. Este es el MVP.

---

## Phase 6: User Story 4 - Borrar un CDT (Priority: P2)

**Goal**: borrado en cascada con confirmación. Se puede borrar solo el periodo más reciente; borrar una renovación la deshace (FR-014 a FR-016, research R8).

**Independent Test**: crear un CDT por transferencia y borrarlo → la cuenta de origen recupera su saldo exacto y desaparecen la cuenta INVESTMENT y la transferencia.

### Tests for User Story 4

- [X] T036 [P] [US4] Añadir a `apps/mobile/src/modules/finance/data/local/cdtsRepo.test.ts`:
  - **Raíz por transferencia**: borra el CDT, la cuenta y todas las transacciones con `cdtId = id` o que toquen la cuenta; los saldos de las demás cuentas son idénticos a los de antes de crearlo (SC-005).
  - **Raíz existente**: borra el CDT y la cuenta.
  - **Renovación** (fixture construido a mano: anterior `RENEWED` con `settled*`, ingreso de interés y nuevo `ACTIVE` con ajuste): se borran el nuevo, su ajuste y el ingreso del anterior; el anterior vuelve a `ACTIVE` con `settled* = null`.
  - Borrar un CDT con sucesor vivo lanza `ValidationError` "Primero borra la renovación más reciente.".
  - Atomicidad: si falla la persistencia, no cambia nada (patrón de `atomicity.test.ts`).
  - `cdtDeletionPreview` devuelve el conteo correcto.

### Implementation for User Story 4

- [X] T037 [US4] Añadir `liveSuccessor(c, cdts)` en `apps/mobile/src/modules/finance/domain/cdts.ts`: el CDT no borrado con `renewedFromCdtId === c.id`, o `null`. Con su prueba en `apps/mobile/src/modules/finance/domain/cdts.test.ts`.
- [X] T038 [US4] Implementar `cdtDeletionPreview(id)` y `deleteCdt(id)` en `apps/mobile/src/modules/finance/data/local/cdtsRepo.ts`, con un solo `batch` y `deletedAt = updatedAt = nowUtc()` en cada registro afectado, según research R8. Declararlos en `apps/mobile/src/modules/finance/data/FinanceRepository.ts` y reexportarlos en `apps/mobile/src/modules/finance/hooks/useCdts.ts`.
- [X] T039 [US4] En `apps/mobile/src/modules/finance/components/investments/CdtDetailPanel.tsx`:
  - Añadir la acción "Borrar" (variante destructiva).
  - Si `preview.allowed`, abrir un diálogo de confirmación con el texto "Se borrará el CDT y {N} movimientos asociados. Esta acción no se puede deshacer.". Al confirmar, llamar a `deleteCdt` y navegar a la lista de inversiones; o, si era una renovación, al detalle del anterior.
  - Si no se permite, mostrar `preview.reason`.
  - Usar el helper existente de `apps/mobile/src/components/ui/confirm.ts`, igual que en `apps/mobile/src/app/(app)/(tabs)/finance/accounts/[id]/index.tsx`.

**Checkpoint**: se pueden borrar CDTs. Borrar renovaciones queda listo para cuando exista US5.

---

## Phase 7: User Story 5 - Renovar un CDT al vencimiento (Priority: P2)

**Goal**: renovar desde el día del vencimiento con *Solo renovar*, *Agregar capital* o *Retirar capital*, en una sola operación atómica con IDs deterministas e historial (FR-017 a FR-022, research R4, R6, R7 y R10).

**Independent Test**: un CDT vencido renovado con cada operación → capital nuevo = VF ± monto; saldo de la cuenta del CDT = capital nuevo; ingreso de interés neto registrado; liquidación guardada; historial con 2 periodos.

### Tests for User Story 5

- [X] T040 [P] [US5] Crear `apps/mobile/src/lib/ids.test.ts`: `uuidV5` coincide con `uuid.uuid5` de Python. Vectores: `uuidV5('6ba7b810-9dad-11d1-80b4-00c04fd430c8','python.org') === '886313e1-3b8a-5372-9b90-0c9aee199e5d'`, más 2 vectores generados con `python3 -c "import uuid; print(uuid.uuid5(...))"`. Comprobar también que la salida tiene versión 5 y variante RFC 4122.
- [X] T041 [P] [US5] Añadir a `apps/mobile/src/modules/finance/domain/cdts.test.ts`:
  - `canRenew`: `false` el día anterior al vencimiento, `true` el día del vencimiento y después, `false` si hay sucesor vivo o si el estado no es `ACTIVE`.
  - `renewalPrincipal` y `previousValueFromPrincipal` para RENEW, ADD y WITHDRAW, y que son inversas.
  - `cdtChain` ordenada del más antiguo al actual.
- [X] T042 [P] [US5] Añadir a `apps/mobile/src/modules/finance/data/local/cdtsRepo.test.ts` la renovación con cada operación:
  - IDs del nuevo periodo, del interés y del ajuste iguales a `uuidV5(CDT_ID_NAMESPACE, '<anterior>:renewal' | '<anterior>:interest' | '<nuevo>:adjustment')`.
  - El nuevo periodo tiene el mismo `accountId`, `sourceAccountId = null` y `renewedFromCdtId = anterior`.
  - Ingreso `INCOME` en la cuenta del CDT por `VF − capital`, fechado `localDateTimeToUtc(maturesOn, 10, 0)`.
  - `settled*` del anterior según `settlement`, con el anterior en `RENEWED`.
  - Saldo de la cuenta del CDT = capital nuevo.
  - Rechazos: renovar antes del vencimiento, renovar dos veces, retiro ≥ VF y VF < capital.
  - "Solo renovar" sin ninguna cuenta.
  - Renovar → borrar renovación → renovar otra vez reutiliza los mismos IDs y deja los registros vivos.
  - Atomicidad.

### Implementation for User Story 5

- [X] T043 [US5] Implementar en `apps/mobile/src/lib/ids.ts` un SHA-1 síncrono en TS puro y `uuidV5(namespace: string, name: string): string` (RFC 4122 §4.3). Exportar `CDT_ID_NAMESPACE`, un UUID fijo generado una sola vez con `uuid.uuid5(uuid.NAMESPACE_URL, 'https://bermudeztech.os/cdt')`, con el comentario "No cambiar".
- [X] T044 [US5] Añadir en `apps/mobile/src/modules/finance/domain/cdts.ts`:
  - `canRenew(c, cdts, today)`: `status === 'ACTIVE' && !deletedAt && today >= maturesOn && !liveSuccessor`.
  - `cdtChain(c, byId)`.
  - `renewalPrincipal(previousValue, op, amount)`.
  - `previousValueFromPrincipal(principal, op, amount)`.
  - Incluir `canRenew` y `chain` en `CdtValues`.
- [X] T045 [US5] Crear `cdtRenewalFormSchema` en `apps/mobile/src/modules/finance/domain/schemas/cdt.ts` con las reglas de data-model §4:
  - `previousMaturityValue ≥ principal anterior`.
  - `operation: z.enum(['RENEW','ADD','WITHDRAW'])`.
  - `amount > 0` si la operación es ADD o WITHDRAW. Con WITHDRAW, además `< previousMaturityValue`, con el mensaje "El nuevo capital debe ser mayor que cero.".
  - `adjustmentAccountId` obligatorio con ADD o WITHDRAW.
  - `principal`, `annualRateEa`, `termDays` (1–3650), `withholdingRate`, `openedOn`, `maturesOn > openedOn`, `maturityValue` y `maturityValueEdited`, `interestPayment`, `payoutAccountId` nullable y `certificateNumber`.
  - Exportar los tipos `CdtRenewalFormValues` y `CdtRenewalFormOutput`.
- [X] T046 [US5] Implementar `renewCdt(id, input: CdtRenewalInput): Promise<Cdt>` en `apps/mobile/src/modules/finance/data/local/cdtsRepo.ts`, en un solo `batch`, según research R6:
  1. Validar con `canRenew` y con `principal === renewalPrincipal(previousMaturityValue, operation, amount)`.
  2. Validar que la cuenta de ajuste es ASSET y no es INVESTMENT ni POCKET (reutilizar `checkAccounts`).
  3. Crear el ingreso de interés (se omite si es 0). Categoría: la primera categoría de ingreso activa cuyo nombre normalizado, sin tildes y en minúsculas, contenga "interes" o "rendimiento"; si no hay, `null`.
  4. Fijar los `settled*` del anterior, `status: 'RENEWED'` y `maturityValueOverride = previousMaturityValue` si difiere de `calculatedMaturityValue`.
  5. Crear el nuevo periodo con `annualRateNominal = nominalRate(...)`.
  6. Crear la transferencia de ajuste.

  Al reutilizar un ID borrado lógicamente, sobrescribir con `deletedAt: null` y timestamps nuevos. Declarar `renewCdt` en `apps/mobile/src/modules/finance/data/FinanceRepository.ts` y reexportarlo en `apps/mobile/src/modules/finance/hooks/useCdts.ts`.
- [X] T047 [US5] Crear `apps/mobile/src/modules/finance/components/investments/CdtRenewalForm.tsx` según [contracts/ui.md](./contracts/ui.md):
  - Secciones "Periodo que termina" (valor final editable; interés neto, retención y bruto en vivo con `settlement`), "Operación" (segmentado y, con ADD/WITHDRAW, Monto y Cuenta; con WITHDRAW la cuenta se prellena con `payoutAccountId`) y "Nuevo periodo".
  - El capital está ligado por R4: editar VF recalcula el capital, y editar el capital recalcula VF con `previousValueFromPrincipal`.
  - Valores por defecto: TEA, plazo, retención, pago de intereses, cuenta destino y número de título del anterior; inicio = `maturesOn` anterior; vencimiento con `defaultMaturesOn`.
  - Valor neto del nuevo periodo editable, con el aviso de Recalcular (como en T030), y nominal en solo lectura.
  - Botón "Renovar CDT".
- [X] T048 [US5] Crear `apps/mobile/src/app/(app)/(tabs)/finance/investments/[id]/renew.tsx`: carga el CDT con `useCdt`. Si `!canRenew`, muestra el motivo y vuelve. Monta `CdtRenewalForm`, llama a `renewCdt` y navega al detalle del nuevo periodo.
- [X] T049 [US5] En `apps/mobile/src/modules/finance/components/investments/CdtDetailPanel.tsx`:
  - Habilitar "Renovar" cuando `canRenew` (navega a `[id]/renew`). Si no, dejarlo deshabilitado con el texto "Disponible desde el {maturesOn con formato 'd de MMMM de yyyy'}".
  - Insignia "Vencido: listo para renovar" en el encabezado cuando `canRenew`.
  - Sección "Historial" si `chain.length > 1`: un renglón por periodo con apertura → vencimiento, capital, TEA y valor final (`maturityValue`, o `principal + settledNetInterest` en periodos liquidados).
  - "Registrar vencimiento" sigue deshabilitado con el texto "Disponible próximamente".
- [X] T050 [US5] En `apps/mobile/src/modules/finance/hooks/useCdts.ts` y `apps/mobile/src/app/(app)/(tabs)/finance/investments/index.tsx`, excluir de la lista los periodos `RENEWED` (se ven en el historial) y mostrar la insignia "Listo para renovar" en `apps/mobile/src/modules/finance/components/investments/CdtListItem.tsx` cuando `canRenew`. `cdtSummary` sigue contando solo los `ACTIVE`.

**Checkpoint**: todas las historias funcionan, incluido borrar una renovación (US4 escenario 4) de punta a punta.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T051 [P] Revisar que no queden referencias a `accruedInterest`, `currentValue`, `expectedNetAtMaturity` ni `annualRateNominal` como entrada de formulario: `grep -rn` en `apps/mobile/src`. Limpiar las etiquetas sin uso en `apps/mobile/src/modules/finance/components/investments/labels.ts`.
- [X] T052 [P] Actualizar los datos de prueba o semilla que construyan CDTs (`grep -rln "renewedFromCdtId" apps/mobile/src apps/api/app`): incluir al menos un CDT existente sin origen y una cadena con una renovación.
- [X] T053 Ejecutar la validación completa: `cd apps/mobile && npm test && npm run test:tz && npm run typecheck && npm run lint` y `cd apps/api && uv run pytest && uv run ruff check . && uv run mypy app`. Corregir lo que falle.
- [ ] T054 Hacer el recorrido manual de [quickstart.md](./quickstart.md) en Android y en web, incluido el escenario de sync con dos dispositivos sin conexión. Anotar las discrepancias en la spec.
- [X] T055 [P] Documentar en `specs/009-cdt-operations/quickstart.md` (sección de despliegue) el orden: primero la migración de la API, luego la actualización OTA del cliente (research R9).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (F1)** → **Foundational (F2)** → historias.
- **US1 (F3)**: solo depende de F2.
- **US2 (F4)**: depende de F2. Comparte `CdtForm.tsx` con US1 y US3, así que conviene hacerla después de US1 para evitar conflictos.
- **US3 (F5)**: depende de F2. Cambia `cdtValues` y su firma (T026, T033), que usan US4 y US5.
- **US4 (F6)**: depende de F2 y de T026 (US3). El caso de renovación se prueba con fixtures, sin esperar a US5.
- **US5 (F7)**: depende de F2, US3 (valoración y `settlement`) y T037 (`liveSuccessor`, US4).
- **Polish (F8)**: al final.

### Orden recomendado

F1 → F2 → US1 → US2 → US3 (**MVP**) → US4 → US5 → F8

### Dentro de cada historia

Pruebas (deben fallar) → dominio puro → repositorio → esquema del formulario → componentes → rutas.

### Parallel Opportunities

- F2: T006 (servidor) y T010 (migración cliente) en paralelo cuando estén T002 a T005 y T007 a T009. Las tareas de servidor (T002 a T006) y las de cliente (T007 a T012) también son paralelas entre sí.
- US3: T023 y T024 en paralelo; T032 en paralelo con T030 y T031.
- US5: T040, T041 y T042 en paralelo; T043 (ids) en paralelo con T044 (dominio).
- Polish: T051, T052 y T055 en paralelo.

## Parallel Example: User Story 5

```bash
# Pruebas primero, en paralelo:
Task: "T040 Vectores uuidV5 en apps/mobile/src/lib/ids.test.ts"
Task: "T041 canRenew/renewalPrincipal/cdtChain en apps/mobile/src/modules/finance/domain/cdts.test.ts"
Task: "T042 renewCdt en apps/mobile/src/modules/finance/data/local/cdtsRepo.test.ts"

# Luego, en paralelo (archivos distintos):
Task: "T043 uuidV5 en apps/mobile/src/lib/ids.ts"
Task: "T044 canRenew/cdtChain en apps/mobile/src/modules/finance/domain/cdts.ts"
```

## Implementation Strategy

### MVP (P1: US1 + US2 + US3)

1. F1 + F2 (esquema y migraciones listos).
2. US1: vencimiento correcto. Ya se puede demostrar.
3. US2: CDTs existentes. El usuario puede cargar su portafolio real.
4. US3: valores ajustables al banco y edición de CDTs legados.
5. **Validar** con quickstart pasos 1 a 3 y desplegar (API primero).

### Entrega incremental

6. US4: borrado en cascada.
7. US5: renovación con historial. Habilita el escenario 4 de US4 de punta a punta.
8. Polish y recorrido completo del quickstart.

## Notes

- Commits pequeños por tarea o grupo lógico, **solo cuando el usuario lo pida** (CLAUDE.md).
- Montos siempre en `Cents` y Decimal; nunca operar con `number` fraccionario.
- "Hoy" es siempre `todayLocal()` (America/Bogota).
- Fuera de alcance: liquidar sin renovar y pagos periódicos de intereses ("Registrar vencimiento" sigue deshabilitado).
