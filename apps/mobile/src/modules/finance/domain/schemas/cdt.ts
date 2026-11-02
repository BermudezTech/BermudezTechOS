import { Decimal } from 'decimal.js';
import { z } from 'zod';

import type { InterestPayment } from '../types';
import { amountField, intField, isoDateField, messages, optionalText, rateField, requiredText } from './common';

export const interestPayments = [
  'AT_MATURITY',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
] as const satisfies readonly InterestPayment[];

const rate = z.string().refine((v) => {
  try {
    const d = new Decimal(v);
    return d.gt(0) && d.lt(100);
  } catch {
    return false;
  }
}, 'La tasa debe estar entre 0 y 100.');

/**
 * Reglas de data-model ("Cdt"): `issuer` obligatorio; `principal` > 0; tasas E.A. y nominal
 * como decimal en (0, 100); `termDays` > 0; `maturesOn` = `openedOn + termDays` por defecto,
 * editable, > `openedOn`; `withholdingRate` por defecto "4.00"; cuentas de origen (obligatoria)
 * y destino (opcional) de activo.
 */
const cents = z.number().int();
const nullableCents = cents.nonnegative().nullable();

/**
 * Reglas de data-model ("Cdt", specs 001 y 009): `issuer` obligatorio; `principal` > 0; tasas E.A. y
 * nominal como decimal en (0, 100); `termDays` > 0; `maturesOn` > `openedOn`; `withholdingRate`
 * en [0, 100); cuenta de origen opcional (CDT existente o renovación); override del valor final
 * ≥ capital; liquidación toda o nada con bruto − retención = neto.
 */
export const cdtInputSchema = z
  .object({
    issuer: requiredText(100),
    certificateNumber: z.string().max(50).nullable(),
    principal: cents.positive('El capital debe ser mayor que cero.'),
    annualRateEa: rate,
    annualRateNominal: rate,
    termDays: z.number().int().positive('El plazo debe ser mayor que cero.'),
    openedOn: isoDateField,
    maturesOn: isoDateField,
    interestPayment: z.enum(interestPayments),
    withholdingRate: z.string().refine((v) => {
      try {
        const d = new Decimal(v);
        return d.gte(0) && d.lt(100);
      } catch {
        return false;
      }
    }, 'La retención debe estar entre 0 y 100.'),
    sourceAccountId: z.string().min(1).nullable(),
    payoutAccountId: z.string().nullable(),
    status: z.enum(['ACTIVE', 'MATURED', 'RENEWED', 'CANCELLED']),
    renewedFromCdtId: z.string().nullable(),
    maturityValueOverride: cents.positive().nullable(),
    settledGrossInterest: nullableCents,
    settledWithholding: nullableCents,
    settledNetInterest: nullableCents,
  })
  .refine((v) => v.maturesOn > v.openedOn, { path: ['maturesOn'], message: 'El vencimiento debe ser posterior a la apertura.' })
  .refine((v) => v.maturityValueOverride === null || v.maturityValueOverride >= v.principal, {
    path: ['maturityValue'],
    message: 'El valor final no puede ser menor que el capital.',
  })
  .refine(
    (v) => {
      const settled = [v.settledGrossInterest, v.settledWithholding, v.settledNetInterest];
      if (settled.every((x) => x === null)) return true;
      if (settled.some((x) => x === null)) return false;
      return v.settledGrossInterest! - v.settledWithholding! === v.settledNetInterest!;
    },
    { path: ['settledNetInterest'], message: 'La liquidación debe cumplir bruto − retención = neto.' },
  );

export const cdtOrigins = ['TRANSFER', 'EXISTING'] as const;

const minMaturityMessage = 'El valor final no puede ser menor que el capital.';

/**
 * Formulario de creación/edición (spec 009, data-model §4): la tasa nominal no se ingresa (se
 * deriva); el valor neto al vencimiento es editable (`maturityValueEdited` → override); la
 * cuenta de origen solo aplica al origen "Transferencia"; la cuenta destino es opcional.
 */
export const cdtFormSchema = z
  .object({
    issuer: requiredText(100),
    certificateNumber: optionalText(50),
    origin: z.enum(cdtOrigins),
    sourceAccountId: z.string().nullable(),
    principal: amountField(),
    annualRateEa: rateField(4),
    termDays: intField(1, 3650, 'Ingresa un plazo en días (1–3650).'),
    openedOn: isoDateField,
    maturesOn: isoDateField,
    interestPayment: z.enum(interestPayments),
    withholdingRate: rateField(2, { allowZero: true }),
    payoutAccountId: z.string().nullable(),
    maturityValue: z.string(),
    maturityValueEdited: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.maturesOn <= v.openedOn) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maturesOn'], message: 'El vencimiento debe ser posterior a la apertura.' });
    }
    if (v.origin === 'TRANSFER' && !v.sourceAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceAccountId'], message: 'Elige la cuenta de origen.' });
    }
    if (v.maturityValueEdited) {
      const parsed = amountField().safeParse(v.maturityValue);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maturityValue'],
          message: parsed.error.issues[0]?.message ?? messages.amountInvalid,
        });
      } else if (parsed.data < v.principal) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maturityValue'], message: minMaturityMessage });
      }
    }
  })
  .transform(({ origin, maturityValue, maturityValueEdited, sourceAccountId, ...rest }) => ({
    ...rest,
    sourceAccountId: origin === 'TRANSFER' ? sourceAccountId : null,
    maturityValueOverride: maturityValueEdited ? amountField().parse(maturityValue) : null,
  }));

export type CdtFormValues = z.input<typeof cdtFormSchema>;
export type CdtFormOutput = z.output<typeof cdtFormSchema>;

export const renewalOperations = ['RENEW', 'ADD', 'WITHDRAW'] as const;

/**
 * Formulario de renovación (spec 009, data-model §4). `previousPrincipal` llega del CDT anterior
 * (no se edita) para validar que el valor final no sea menor que el capital.
 */
export const cdtRenewalFormSchema = z
  .object({
    previousPrincipal: z.number().int().positive(),
    previousMaturityValue: amountField(),
    operation: z.enum(renewalOperations),
    amount: z.string(),
    adjustmentAccountId: z.string().nullable(),
    principal: amountField(),
    annualRateEa: rateField(4),
    termDays: intField(1, 3650, 'Ingresa un plazo en días (1–3650).'),
    withholdingRate: rateField(2, { allowZero: true }),
    openedOn: isoDateField,
    maturesOn: isoDateField,
    maturityValue: z.string(),
    maturityValueEdited: z.boolean(),
    interestPayment: z.enum(interestPayments),
    payoutAccountId: z.string().nullable(),
    certificateNumber: optionalText(50),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (v.previousMaturityValue < v.previousPrincipal) issue('previousMaturityValue', minMaturityMessage);
    if (v.maturesOn <= v.openedOn) issue('maturesOn', 'El vencimiento debe ser posterior a la apertura.');
    if (v.operation !== 'RENEW') {
      const amount = amountField().safeParse(v.amount);
      if (!amount.success) issue('amount', amount.error.issues[0]?.message ?? messages.amountInvalid);
      else if (v.operation === 'WITHDRAW' && amount.data >= v.previousMaturityValue)
        issue('amount', 'El nuevo capital debe ser mayor que cero.');
      if (!v.adjustmentAccountId)
        issue('adjustmentAccountId', v.operation === 'ADD' ? 'Elige la cuenta de origen.' : 'Elige la cuenta destino.');
    }
    if (v.maturityValueEdited) {
      const parsed = amountField().safeParse(v.maturityValue);
      if (!parsed.success) issue('maturityValue', parsed.error.issues[0]?.message ?? messages.amountInvalid);
      else if (parsed.data < v.principal) issue('maturityValue', minMaturityMessage);
    }
  })
  .transform(({ previousPrincipal: _p, maturityValue, maturityValueEdited, amount, adjustmentAccountId, ...rest }) => ({
    ...rest,
    amount: rest.operation === 'RENEW' ? null : amountField().parse(amount),
    adjustmentAccountId: rest.operation === 'RENEW' ? null : adjustmentAccountId,
    maturityValueOverride: maturityValueEdited ? amountField().parse(maturityValue) : null,
  }));

export type CdtRenewalFormValues = z.input<typeof cdtRenewalFormSchema>;
export type CdtRenewalFormOutput = z.output<typeof cdtRenewalFormSchema>;
