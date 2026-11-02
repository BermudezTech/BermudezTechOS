# Contract: dominio y hooks

Todo en `apps/mobile/src/modules/finance/`. Montos en `Cents`, fechas `IsoDate` en America/Bogota.

## `domain/upcoming.ts` (nuevo)

```ts
export type UpcomingKind = 'CARD_PAYMENT' | 'CDT_MATURITY' | 'SUBSCRIPTION';

export interface UpcomingItem {
  kind: UpcomingKind;
  sourceId: string;
  name: string;
  date: IsoDate;
  daysUntil: number;
  amount: Cents;
  urgent: boolean;
  overdue: boolean;
}

export interface UpcomingInput {
  subscriptions: Subscription[];
  cdts: Cdt[];
  accounts: Account[];
  /** Saldos con signo de `balancesByAccount`. */
  balances: Map<string, Cents>;
}

/** Próximo `day` (1–31, ajustado al fin de mes) en o después de `today`. */
export function nextMonthlyDate(day: number, today: IsoDate): IsoDate;

/** Elementos dentro de [hoy, hoy + windowDays] (+ CDTs activos vencidos), ordenados (data-model). */
export function upcomingItems(input: UpcomingInput, today: IsoDate, windowDays?: number /* = MATURING_SOON_DAYS */): UpcomingItem[];

/** "Vencido hace N días" | "Vencido ayer" | "Hoy" | "Mañana" | "En N días". */
export function daysUntilLabel(daysUntil: number): string;
```

**Pruebas obligatorias** (`domain/upcoming.test.ts`, FR-027):

- Suscripción mensual con día 31 en febrero → último día de febrero (también año bisiesto).
- Suscripción anual fuera de la ventana → excluida; dentro → incluida con su monto.
- Suscripción pausada, cancelada o borrada → excluida.
- Suscripción con `startDate` futura dentro de la ventana → fecha = primer cobro desde el inicio.
- CDT activo que vence en 15 días → incluido; en 16 → excluido; vencido hace 3 días y aún ACTIVE → incluido, `overdue`, primero en la lista.
- CDT RENEWED, MATURED o CANCELLED → excluido. Monto = `maturityValue` (respeta el override).
- Tarjeta con deuda > 0 y día de pago → incluida con monto = deuda; deuda 0, saldo a favor, sin `paymentDueDay`, archivada o borrada → excluida.
- `paymentDueDay` = hoy → `daysUntil` 0, urgente; día ya pasado este mes → mes siguiente.
- Desempate el mismo día: tarjeta, luego CDT, luego suscripción, luego nombre.
- Exclusión del patrimonio no afecta la inclusión.
- Se ejecuta también con `npm run test:tz` (zona del dispositivo irrelevante).

## `domain/netWorth.ts` (sin cambios de firma)

Se reutilizan `netWorthReport` y `netWorthEvolution`.

## Hooks

```ts
// hooks/useFinanceData.ts (nuevo export)
/** Hoy en Bogotá; se actualiza al cambiar el día (cada 60 s y al volver a primer plano). */
export function useLiveToday(): IsoDate;

// hooks/useNetWorth.ts (cambio compatible)
export function useNetWorth(range?: NetWorthRange, today?: IsoDate): { report; evolution; firstMonth };

// hooks/useHomeFinance.ts (nuevo)
export function useHomeNetWorth(): { netWorth: Cents; evolution: NetWorthPoint[]; monthDelta: Cents; isEmpty: boolean };
export function useHomeMonthFlow(): { month: IsoDate; income: Cents; expense: Cents; balance: Cents };
export function useUpcoming(): UpcomingItem[];
```
