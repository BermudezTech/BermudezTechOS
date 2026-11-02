# Contrato: funciones de dominio y repositorio (cliente)

Funciones puras con pruebas Jest obligatorias (constitución: la lógica de montos lleva pruebas). Todos los montos son `Cents` (enteros) y las tasas son strings decimales en porcentaje ("10.2500").

## `lib/dates.ts`

```ts
/** Vencimiento con días comerciales (R1). Replica helpComercialDays sin límite de 24 meses. */
export function addCommercialDays(openedOn: IsoDate, termDays: number): IsoDate;
```

| Entrada | Salida |
|---|---|
| `('2026-01-15', 90)` | `'2026-04-15'` |
| `('2026-11-01', 180)` | `'2027-05-01'` |
| `('2026-01-15', 45)` | `'2026-03-02'` |
| `('2026-01-31', 30)` | `'2026-03-03'` |
| `('2026-03-31', 30)` | `'2026-05-01'` |
| `('2028-01-15', 60)` | `'2028-03-15'` |

## `lib/ids.ts`

```ts
export const CDT_ID_NAMESPACE: string; // UUID fijo, no cambiar
export function uuidV5(namespace: string, name: string): string; // RFC 4122 §4.3, SHA-1 en TS puro
```

## `modules/finance/domain/cdtValuation.ts` (reescrito)

```ts
type Terms = { principal: Cents; annualRateEa: string; termDays: number; withholdingRate: string };

export function grossInterest(t: Terms): Cents;           // principal·((1+EA)^(días/360) − 1)
export function calculatedMaturityValue(t: Terms): Cents; // principal + bruto·(1 − ret)
export function maturityValue(c: Terms & { maturityValueOverride: Cents | null }): Cents;
export function nominalFromEa(ea: string, termDays: number): string;                 // 4 decimales
export function nominalFromMaturityValue(t: Terms, value: Cents): string;            // 4 decimales
export function nominalRate(c: Terms & { maturityValueOverride: Cents | null }): string;
/** Liquidación del periodo con valor final `value` (FR-019a): bruto − retención = neto, exacto. */
export function settlement(t: Terms, value: Cents): { gross: Cents; withholding: Cents; net: Cents };
```

Se eliminan `accruedInterest`, `currentValue`, `elapsedDays`, `totalInterest` y `withholdingAmount`. Los dos últimos se reemplazan por `settlement(t, maturityValue(c))`.

## `modules/finance/domain/cdts.ts`

```ts
export function cdtOrigin(c: Cdt): 'TRANSFER' | 'EXISTING' | 'RENEWAL';
export function liveSuccessor(c: Cdt, cdts: Cdt[]): Cdt | null;
export function canRenew(c: Cdt, cdts: Cdt[], today: IsoDate): boolean;        // R10, inclusive
export function cdtChain(c: Cdt, cdts: Record<string, Cdt>): Cdt[];            // del más antiguo al actual
export function renewalPrincipal(previousValue: Cents, op: RenewalOperation, amount: Cents): Cents;
export function previousValueFromPrincipal(principal: Cents, op: RenewalOperation, amount: Cents): Cents; // R4

export interface CdtValues {
  cdt: Cdt;
  maturityValue: Cents;
  isOverridden: boolean;
  settlement: { gross: Cents; withholding: Cents; net: Cents };
  daysElapsed: number; daysRemaining: number; maturingSoon: boolean;
  canRenew: boolean;
  chain: Cdt[];
}
```

`type RenewalOperation = 'RENEW' | 'ADD' | 'WITHDRAW'`. `defaultMaturesOn` delega en `addCommercialDays`.

## `FinanceRepository` (y su implementación local `cdtsRepo.ts`)

```ts
createCdt(input: CdtInput): Promise<Cdt>;                 // R5: TRANSFER u origen EXISTING
updateCdt(id: string, changes: Partial<CdtInput>): Promise<Cdt>;  // R12: sincroniza apertura/saldo inicial/liquidación
cdtDeletionPreview(id: string): { allowed: boolean; reason?: string; transactionCount: number };
deleteCdt(id: string): Promise<void>;                     // R8, un solo batch
renewCdt(id: string, input: CdtRenewalInput): Promise<Cdt>; // R6, un solo batch; devuelve el nuevo periodo

interface CdtRenewalInput {
  previousMaturityValue: Cents;
  operation: RenewalOperation;
  amount: Cents | null;              // ADD/WITHDRAW
  adjustmentAccountId: string | null;
  principal: Cents;                  // = renewalPrincipal(...) salvo edición (R4)
  annualRateEa: string; termDays: number; withholdingRate: string;
  openedOn: IsoDate; maturesOn: IsoDate;
  maturityValueOverride: Cents | null;
  interestPayment: InterestPayment; payoutAccountId: string | null;
  certificateNumber: string | null;
}
```

**Errores** (`ValidationError`, con el campo indicado):

| Caso | Campo | Mensaje |
|---|---|---|
| Se renueva antes del vencimiento | `openedOn` | "Podrás renovar desde el {fecha}." |
| Ya renovado | — | "Este CDT ya fue renovado." |
| Retiro ≥ VF | `amount` | "El nuevo capital debe ser mayor que cero." |
| VF < capital | `maturityValue` / `previousMaturityValue` | "El valor final no puede ser menor que el capital." |
| `principal ≠ renewalPrincipal(VF, op, amount)` | `principal` | Error interno: el formulario debe aplicar R4 |
| Se borra un CDT con sucesor vivo | — | "Primero borra la renovación más reciente." |
