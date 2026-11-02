import { Decimal } from 'decimal.js';

import { fromDecimal, toDecimal, type Cents } from '@/lib/money';

import type { Cdt } from './types';

/**
 * Valoración de un periodo de CDT (spec 009, research R2). Base de 360 días comerciales; la tasa
 * nominal es siempre la equivalente con pago al vencimiento. Los cálculos se hacen con Decimal y
 * solo se redondea al final, al centavo.
 */
export type CdtTerms = Pick<Cdt, 'principal' | 'annualRateEa' | 'termDays' | 'withholdingRate'>;
export type CdtValuationInput = CdtTerms & Pick<Cdt, 'maturityValueOverride'>;

const YEAR_DAYS = 360;
const pct = (value: string) => new Decimal(value).div(100);

/** (1 + EA)^(días/360) − 1. */
function periodFactor(annualRateEa: string, termDays: number): Decimal {
  return pct(annualRateEa).plus(1).pow(new Decimal(termDays).div(YEAR_DAYS)).minus(1);
}

/** Interés bruto del periodo: principal × ((1 + EA)^(días/360) − 1). */
export function grossInterest(terms: CdtTerms): Cents {
  return fromDecimal(toDecimal(terms.principal).mul(periodFactor(terms.annualRateEa, terms.termDays)));
}

/** Valor neto al vencimiento calculado: principal + bruto × (1 − retención). */
export function calculatedMaturityValue(terms: CdtTerms): Cents {
  const gross = toDecimal(terms.principal).mul(periodFactor(terms.annualRateEa, terms.termDays));
  const net = gross.mul(new Decimal(1).minus(pct(terms.withholdingRate)));
  return fromDecimal(toDecimal(terms.principal).plus(net));
}

/** Valor neto al vencimiento vigente: el del banco si se ajustó, si no el calculado. */
export function maturityValue(cdt: CdtValuationInput): Cents {
  return cdt.maturityValueOverride ?? calculatedMaturityValue(cdt);
}

/** Tasa nominal anual (pago al vencimiento) desde la TEA: ((1 + EA)^(días/360) − 1) × 360/días. */
export function nominalFromEa(annualRateEa: string, termDays: number): string {
  return periodFactor(annualRateEa, termDays).mul(YEAR_DAYS).div(termDays).mul(100).toFixed(4);
}

/** Interés bruto implícito en un valor neto final: (valor − principal) ÷ (1 − retención). */
function impliedGross(terms: CdtTerms, value: Cents): Decimal {
  const keep = new Decimal(1).minus(pct(terms.withholdingRate));
  return toDecimal(value).minus(toDecimal(terms.principal)).div(keep);
}

/** Tasa nominal anual implícita en el valor final del banco: (bruto ÷ principal) × 360/días. */
export function nominalFromMaturityValue(terms: CdtTerms, value: Cents): string {
  return impliedGross(terms, value).div(toDecimal(terms.principal)).mul(YEAR_DAYS).div(terms.termDays).mul(100).toFixed(4);
}

/** Tasa nominal a guardar (FR-010): desde el valor ajustado si lo hay, si no desde la TEA. */
export function nominalRate(cdt: CdtValuationInput): string {
  return cdt.maturityValueOverride === null
    ? nominalFromEa(cdt.annualRateEa, cdt.termDays)
    : nominalFromMaturityValue(cdt, cdt.maturityValueOverride);
}

export interface Settlement {
  gross: Cents;
  withholding: Cents;
  net: Cents;
}

/**
 * Liquidación de un periodo con valor neto final `value` (FR-019a): neto = valor − principal;
 * bruto = neto ÷ (1 − retención) redondeado; retención = bruto − neto (exacto al centavo).
 */
export function settlement(terms: CdtTerms, value: Cents): Settlement {
  const net = value - terms.principal;
  const gross = fromDecimal(impliedGross(terms, value));
  return { gross, withholding: (gross - net) as Cents, net: net as Cents };
}
