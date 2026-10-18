import { z } from 'zod';

import type { RecurringIncomeCycle } from '../types';
import { amountField, intField, isoDateField, messages, optionalIntField, requiredText } from './common';

export const recurringIncomeCycles = ['MONTHLY', 'YEARLY'] as const satisfies readonly RecurringIncomeCycle[];

/**
 * Reglas de data-model ("RecurringIncome"): `name` 1–100; `expectedAmount` > 0; `expectedDay`
 * 1–31; `expectedMonth` 1–12, obligatorio en YEARLY y `null` en MONTHLY; `accountId` obligatorio;
 * `categoryId` opcional de tipo INCOME (lo verifica el repositorio).
 */
const yearlyNeedsMonth = (v: { cycle: RecurringIncomeCycle; expectedMonth: number | null }) =>
  v.cycle === 'MONTHLY' || v.expectedMonth !== null;

export const recurringIncomeInputSchema = z
  .object({
    accountId: z.string().min(1, 'Elige la cuenta de destino.'),
    categoryId: z.string().nullable(),
    name: requiredText(100),
    icon: z.string().nullable(),
    expectedAmount: z.number().int().positive(messages.amountPositive),
    cycle: z.enum(recurringIncomeCycles),
    expectedDay: z.number().int().min(1, messages.day).max(31, messages.day),
    expectedMonth: z.number().int().min(1, messages.month).max(12, messages.month).nullable(),
    startDate: isoDateField,
    status: z.enum(['ACTIVE', 'PAUSED']),
  })
  .refine(yearlyNeedsMonth, { path: ['expectedMonth'], message: 'Elige el mes esperado.' })
  .transform((v) => ({ ...v, expectedMonth: v.cycle === 'YEARLY' ? v.expectedMonth : null }));

export const recurringIncomeFormSchema = z
  .object({
    name: requiredText(100),
    icon: z.string().nullable(),
    expectedAmount: amountField(),
    cycle: z.enum(recurringIncomeCycles),
    expectedDay: intField(1, 31, messages.day),
    expectedMonth: optionalIntField(1, 12, messages.month),
    startDate: isoDateField,
    accountId: z
      .string()
      .nullable()
      .refine((v): v is string => !!v, 'Elige la cuenta de destino.'),
    categoryId: z.string().nullable(),
  })
  .refine(yearlyNeedsMonth, { path: ['expectedMonth'], message: 'Elige el mes esperado.' })
  .transform((v) => ({ ...v, expectedMonth: v.cycle === 'YEARLY' ? v.expectedMonth : null }));

export type RecurringIncomeFormValues = z.input<typeof recurringIncomeFormSchema>;
export type RecurringIncomeFormOutput = z.output<typeof recurringIncomeFormSchema>;
