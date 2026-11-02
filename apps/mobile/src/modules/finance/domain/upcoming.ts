import { addMonthsToYearMonth, clampedIsoDate, daysBetween, parseIsoDate, type IsoDate } from '@/lib/dates';
import { ZERO, type Cents } from '@/lib/money';

import { debtOf } from './balances';
import { MATURING_SOON_DAYS } from './cdts';
import { maturityValue } from './cdtValuation';
import { subscriptionsWithNext } from './subscriptions';
import type { Account, Cdt, Subscription } from './types';

/**
 * Próximos vencimientos de Inicio (spec 010, US4; data-model.md → UpcomingItem): cobros de
 * suscripciones activas, CDTs activos por vencer (o ya vencidos sin gestionar) y pagos de
 * tarjetas con deuda, dentro de una ventana de días desde hoy (Bogotá).
 */
export type UpcomingKind = 'CARD_PAYMENT' | 'CDT_MATURITY' | 'SUBSCRIPTION';

export interface UpcomingItem {
  kind: UpcomingKind;
  /** id de la cuenta, el CDT o la suscripción. */
  sourceId: string;
  name: string;
  date: IsoDate;
  /** Negativo = ya vencido (solo CDTs). */
  daysUntil: number;
  /** Siempre ≥ 0: deuda, valor al vencimiento o monto del cobro. */
  amount: Cents;
  /** Hoy, mañana o vencido. */
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

const KIND_ORDER: Record<UpcomingKind, number> = { CARD_PAYMENT: 0, CDT_MATURITY: 1, SUBSCRIPTION: 2 };

/** Próximo `day` del mes (1–31, ajustado al último día en meses cortos) en o después de `today`. */
export function nextMonthlyDate(day: number, today: IsoDate): IsoDate {
  const { year, month } = parseIsoDate(today);
  const thisMonth = clampedIsoDate(year, month, day);
  if (thisMonth >= today) return thisMonth;
  const next = addMonthsToYearMonth(year, month, 1);
  return clampedIsoDate(next.year, next.month, day);
}

function item(kind: UpcomingKind, sourceId: string, name: string, date: IsoDate, amount: Cents, today: IsoDate): UpcomingItem {
  const daysUntil = daysBetween(today, date);
  return { kind, sourceId, name, date, daysUntil, amount, urgent: daysUntil <= 1, overdue: daysUntil < 0 };
}

export function upcomingItems(input: UpcomingInput, today: IsoDate, windowDays: number = MATURING_SOON_DAYS): UpcomingItem[] {
  const items: UpcomingItem[] = [];

  for (const { subscription, nextBilling, daysUntil } of subscriptionsWithNext(input.subscriptions, today)) {
    // `nextBilling` es null si no está activa.
    if (nextBilling === null || daysUntil === null || daysUntil > windowDays) continue;
    items.push(item('SUBSCRIPTION', subscription.id, subscription.name, nextBilling, subscription.amount, today));
  }

  for (const cdt of input.cdts) {
    if (cdt.deletedAt || cdt.status !== 'ACTIVE') continue;
    // Sin límite inferior: un CDT activo con la fecha pasada sigue pendiente de renovar o cobrar.
    if (daysBetween(today, cdt.maturesOn) > windowDays) continue;
    items.push(item('CDT_MATURITY', cdt.id, `CDT ${cdt.issuer}`, cdt.maturesOn, maturityValue(cdt), today));
  }

  for (const account of input.accounts) {
    if (account.type !== 'CREDIT_CARD' || account.deletedAt || account.isArchived || account.paymentDueDay === null) continue;
    const debt = debtOf(input.balances.get(account.id) ?? ZERO);
    if (debt <= 0) continue;
    const date = nextMonthlyDate(account.paymentDueDay, today);
    if (daysBetween(today, date) > windowDays) continue;
    items.push(item('CARD_PAYMENT', account.id, account.name, date, debt, today));
  }

  return items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.name.localeCompare(b.name, 'es') ||
      a.sourceId.localeCompare(b.sourceId),
  );
}

/** "Vencido hace N días" | "Vencido ayer" | "Hoy" | "Mañana" | "En N días". */
export function daysUntilLabel(daysUntil: number): string {
  if (daysUntil < -1) return `Vencido hace ${-daysUntil} días`;
  if (daysUntil === -1) return 'Vencido ayer';
  if (daysUntil === 0) return 'Hoy';
  if (daysUntil === 1) return 'Mañana';
  return `En ${daysUntil} días`;
}
