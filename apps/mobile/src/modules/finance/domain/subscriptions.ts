import { Decimal } from 'decimal.js';

import { addMonthsToYearMonth, clampedIsoDate, daysBetween, parseIsoDate, type IsoDate } from '@/lib/dates';
import { fromDecimal, toDecimal, type Cents } from '@/lib/money';

import type { Subscription, SubscriptionStatus } from './types';

export interface SubscriptionWithNext {
  subscription: Subscription;
  /** null si está pausada o cancelada. */
  nextBilling: IsoDate | null;
  daysUntil: number | null;
}

/**
 * Siguiente fecha ≥ hoy según el ciclo, `billingDay` (ajustado al último día del mes) y
 * `billingMonth`, nunca antes de `startDate`.
 */
export function nextBillingDate(
  sub: Pick<Subscription, 'billingCycle' | 'billingDay' | 'billingMonth' | 'startDate'>,
  today: IsoDate,
): IsoDate {
  const from = sub.startDate > today ? sub.startDate : today;
  const { year, month } = parseIsoDate(from);
  if (sub.billingCycle === 'YEARLY') {
    const billingMonth = sub.billingMonth ?? month;
    const thisYear = clampedIsoDate(year, billingMonth, sub.billingDay);
    return thisYear >= from ? thisYear : clampedIsoDate(year + 1, billingMonth, sub.billingDay);
  }
  const thisMonth = clampedIsoDate(year, month, sub.billingDay);
  if (thisMonth >= from) return thisMonth;
  const next = addMonthsToYearMonth(year, month, 1);
  return clampedIsoDate(next.year, next.month, sub.billingDay);
}

/** Σ activas: mensual + anual / 12 (decimal.js, half-up a centavos una sola vez). */
export function monthlyEquivalent(subs: Subscription[]): Cents {
  const total = subs
    .filter((s) => !s.deletedAt && s.status === 'ACTIVE')
    .reduce((acc, s) => acc.plus(s.billingCycle === 'MONTHLY' ? toDecimal(s.amount) : toDecimal(s.amount).div(12)), new Decimal(0));
  return fromDecimal(total);
}

/** ACTIVE ⇄ PAUSED ; ACTIVE|PAUSED → CANCELLED (final). */
export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  if (from === to) return false;
  if (from === 'CANCELLED') return false;
  return to === 'CANCELLED' || (from === 'ACTIVE' && to === 'PAUSED') || (from === 'PAUSED' && to === 'ACTIVE');
}

const statusOrder: Record<SubscriptionStatus, number> = { ACTIVE: 0, PAUSED: 1, CANCELLED: 2 };

export function subscriptionsWithNext(subs: Subscription[], today: IsoDate): SubscriptionWithNext[] {
  return subs
    .filter((s) => !s.deletedAt)
    .map((subscription) => {
      const nextBilling = subscription.status === 'ACTIVE' ? nextBillingDate(subscription, today) : null;
      return { subscription, nextBilling, daysUntil: nextBilling ? daysBetween(today, nextBilling) : null };
    })
    .sort(
      (a, b) =>
        statusOrder[a.subscription.status] - statusOrder[b.subscription.status] ||
        (a.nextBilling ?? '').localeCompare(b.nextBilling ?? '') ||
        a.subscription.name.localeCompare(b.subscription.name),
    );
}
