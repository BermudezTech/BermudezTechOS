# Contract — FinanceRepository

Interfaz entre las pantallas de finanzas y la fuente de datos. En esta feature la implementa
`InMemoryFinanceRepository` (seed + store Zustand); en la feature de datos la implementará una
versión sobre Expo SQLite **sin cambiar las pantallas** (FR-031). Tipos en
[data-model.md](../data-model.md).

## Reglas del contrato

1. Las pantallas **solo** acceden a datos a través de los hooks de este contrato; nunca importan el
   seed ni el store.
2. Toda lectura excluye registros con `deletedAt` (y cuentas archivadas, salvo que se pida).
3. Las escrituras son **síncronas desde el punto de vista de la UI** (offline-first): se aplican de
   inmediato al estado local y las lecturas reactivas se actualizan (FR-032). La firma devuelve
   `Promise` para que la implementación SQLite encaje sin cambios.
4. Las escrituras validan con los esquemas zod del dominio y lanzan `ValidationError`
   (`{ field, code }`) en lugar de guardar datos inválidos.
5. `create*` genera `id`, `createdAt`, `updatedAt` (UTC). `update*` actualiza `updatedAt`.
   `delete*` es lógico (`deletedAt`).
6. Los valores derivados (saldos, totales…) se exponen como lecturas y se calculan desde las
   transacciones; no existen *setters* para ellos (FR-033).
7. El cliente nunca maneja `user_id`.

## Lecturas (hooks reactivos)

```ts
useAccounts(opts?: { includeArchived?: boolean }): AccountWithBalance[]
useAccount(id: string): AccountDetail | undefined         // saldo total, disponible, cajitas, tarjeta
useAccountsSummary(): { assets: Group[]; liabilities: Group[]; availableTotal: Cents }
useCategories(kind?: CategoryKind): Category[]
useTransactions(filter: TransactionFilter): { days: DayGroup[]; total: Cents }
useTransaction(id: string): Transaction | undefined
useRecentTransactions(limit: number): Transaction[]
useSpendingByCategory(period: Period): SpendingReport      // total, items, variación, evolución
useNetWorth(): NetWorthReport                               // neto, activos, pasivos, desglose, 12 meses
useAssets(): AssetWithStatus[]                              // incluye isValueExpired
useCdts(): { items: CdtWithValues[]; totalInvested: Cents; weightedRate: string }
useCdt(id: string): CdtDetail | undefined
useSubscriptions(): { items: SubscriptionWithNext[]; monthlyEquivalent: Cents }
useReimbursementGroups(): { open: GroupWithBalance[]; closed: GroupWithBalance[];
                            totalOwedToMe: Cents; totalHeldForOthers: Cents }
useReimbursementGroup(id: string): GroupDetail | undefined
```

```ts
type TransactionFilter = {
  accountId?: string; type?: TransactionType; categoryId?: string | 'NONE';
  from?: IsoDate; to?: IsoDate; search?: string; reimbursementGroupId?: string;
};
type Period = { granularity: 'MONTH' | 'YEAR'; anchor: IsoDate }; // anchor = cualquier día del periodo
```

## Escrituras

```ts
createAccount(input: AccountInput): Promise<Account>
updateAccount(id: string, patch: Partial<AccountInput>): Promise<Account>
archiveAccount(id: string, archived: boolean): Promise<void>
deleteAccount(id: string): Promise<void>        // rechaza si tiene movimientos o cajitas → sugerir archivar

createTransaction(input: TransactionInput): Promise<Transaction>
updateTransaction(id: string, patch: Partial<TransactionInput>): Promise<Transaction>
deleteTransaction(id: string): Promise<void>
setTransactionCategory(id: string, categoryId: string | null): Promise<void> // ⇒ categorySource 'MANUAL'

createSubscription(input: SubscriptionInput): Promise<Subscription>
updateSubscription(id: string, patch: Partial<SubscriptionInput>): Promise<Subscription>
setSubscriptionStatus(id: string, status: SubscriptionStatus): Promise<void>

createReimbursementGroup(input: ReimbursementGroupInput): Promise<ReimbursementGroup>
setReimbursementGroupStatus(id: string, status: GroupStatus): Promise<void>  // SETTLED solo con saldo 0

createCdt(input: CdtInput): Promise<Cdt>        // crea también la cuenta INVESTMENT y la transferencia de apertura
updateCdt(id: string, patch: Partial<CdtInput>): Promise<Cdt>

createAsset(input: AssetInput): Promise<Asset>
updateAsset(id: string, patch: Partial<AssetInput>): Promise<Asset>
deleteAsset(id: string): Promise<void>
```

## Utilidades de sesión (solo implementación en memoria)

```ts
resetMockData(mode: 'full' | 'empty'): void      // Ajustes → "Restablecer datos de prueba" (FR-039)
```

## Errores

| Código | Cuándo |
|---|---|
| `REQUIRED` | Falta un campo obligatorio. |
| `AMOUNT_INVALID` | Monto ≤ 0, no numérico, > 2 decimales o fuera de rango. |
| `SAME_ACCOUNT` | Transferencia con origen = destino. |
| `CATEGORY_KIND_MISMATCH` | Categoría de ingreso en egreso o viceversa. |
| `HAS_DEPENDENCIES` | Eliminar cuenta con movimientos o cajitas. |
| `GROUP_NOT_BALANCED` | Marcar como saldado un grupo con saldo ≠ 0. |
| `INVALID_TRANSITION` | Cambio de estado no permitido (ver data-model). |
| `NOT_FOUND` | ID inexistente o borrado. |
