import { Decimal } from 'decimal.js';
import { z } from 'zod';

import type { InterestPayment } from '../types';
import { amountField, intField, isoDateField, optionalText, rateField, requiredText } from './common';

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
export const cdtInputSchema = z
  .object({
    issuer: requiredText(100),
    certificateNumber: z.string().max(50).nullable(),
    principal: z.number().int().positive('El capital debe ser mayor que cero.'),
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
    sourceAccountId: z.string().min(1, 'Elige la cuenta de origen.'),
    payoutAccountId: z.string().nullable(),
    status: z.enum(['ACTIVE', 'MATURED', 'RENEWED', 'CANCELLED']),
    renewedFromCdtId: z.string().nullable(),
  })
  .refine((v) => v.maturesOn > v.openedOn, { path: ['maturesOn'], message: 'El vencimiento debe ser posterior a la apertura.' });

export const cdtFormSchema = z
  .object({
    issuer: requiredText(100),
    certificateNumber: optionalText(50),
    principal: amountField(),
    annualRateEa: rateField(4),
    annualRateNominal: rateField(4),
    termDays: intField(1, 3650, 'Ingresa un plazo en días (1–3650).'),
    openedOn: isoDateField,
    maturesOn: isoDateField,
    interestPayment: z.enum(interestPayments),
    withholdingRate: rateField(2, { allowZero: true }),
    sourceAccountId: z
      .string()
      .nullable()
      .refine((v): v is string => !!v, 'Elige la cuenta de origen.'),
    payoutAccountId: z.string().nullable(),
  })
  .refine((v) => v.maturesOn > v.openedOn, { path: ['maturesOn'], message: 'El vencimiento debe ser posterior a la apertura.' });

export type CdtFormValues = z.input<typeof cdtFormSchema>;
export type CdtFormOutput = z.output<typeof cdtFormSchema>;
