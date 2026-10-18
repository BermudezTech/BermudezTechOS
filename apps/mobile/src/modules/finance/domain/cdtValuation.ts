import { Decimal } from 'decimal.js';

import { daysBetween, type IsoDate } from '@/lib/dates';
import { fromDecimal, toDecimal, type Cents } from '@/lib/money';

import type { Cdt } from './types';

type CdtTerms = Pick<Cdt, 'principal' | 'annualRateEa' | 'termDays' | 'openedOn' | 'withholdingRate'>;

/** Interés compuesto con tasa E.A. por `days` días, en centavos sin redondear. */
function interestFor(cdt: CdtTerms, days: number): Decimal {
  const rate = new Decimal(cdt.annualRateEa).div(100);
  const factor = rate.plus(1).pow(new Decimal(days).div(365)).minus(1);
  return toDecimal(cdt.principal).mul(factor);
}

export function elapsedDays(cdt: Pick<Cdt, 'openedOn' | 'termDays'>, today: IsoDate): number {
  return Math.max(0, Math.min(cdt.termDays, daysBetween(cdt.openedOn, today)));
}

/** Interés causado a la fecha: principal × ((1 + EA)^(días/365) − 1), días acotados al plazo. */
export function accruedInterest(cdt: CdtTerms, today: IsoDate): Cents {
  return fromDecimal(interestFor(cdt, elapsedDays(cdt, today)));
}

/** Interés bruto total al vencimiento. */
export function totalInterest(cdt: CdtTerms): Cents {
  return fromDecimal(interestFor(cdt, cdt.termDays));
}

/** Retención en la fuente sobre el interés total. */
export function withholdingAmount(cdt: CdtTerms): Cents {
  return fromDecimal(interestFor(cdt, cdt.termDays).mul(new Decimal(cdt.withholdingRate).div(100)));
}

/** principal + interésTotal × (1 − retención). */
export function expectedNetAtMaturity(cdt: CdtTerms): Cents {
  const net = interestFor(cdt, cdt.termDays).mul(new Decimal(1).minus(new Decimal(cdt.withholdingRate).div(100)));
  return fromDecimal(toDecimal(cdt.principal).plus(net));
}

/** principal + interés causado − intereses ya pagados. */
export function currentValue(cdt: CdtTerms, paidInterest: Cents, today: IsoDate): Cents {
  const value = toDecimal(cdt.principal)
    .plus(interestFor(cdt, elapsedDays(cdt, today)))
    .minus(toDecimal(paidInterest));
  return fromDecimal(value);
}
