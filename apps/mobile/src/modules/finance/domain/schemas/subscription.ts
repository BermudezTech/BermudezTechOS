import { z } from 'zod';

import type { BillingCycle } from '../types';
import { amountField, intField, isoDateField, messages, optionalIntField, requiredText } from './common';

export const billingCycles = ['MONTHLY', 'YEARLY'] as const satisfies readonly BillingCycle[];

/**
 * Reglas de data-model ("Subscription"): `name` 1–100; `amount` > 0; `billingCycle` MONTHLY o
 * YEARLY; `billingDay` 1–31 (si el mes es más corto se usa el último día); `billingMonth` 1–12,
 * obligatorio en YEARLY; `startDate` fecha; `accountId` obligatorio (cuenta o tarjeta de cobro);
 * `categoryId` opcional de tipo EXPENSE (lo verifica el repositorio).
 */
const yearlyNeedsMonth = (v: { billingCycle: BillingCycle; billingMonth: number | null }) =>
  v.billingCycle === 'MONTHLY' || v.billingMonth !== null;

export const subscriptionInputSchema = z
  .object({
    accountId: z.string().min(1, 'Elige la cuenta de cobro.'),
    categoryId: z.string().nullable(),
    name: requiredText(100),
    icon: z.string().nullable(),
    amount: z.number().int().positive(messages.amountPositive),
    billingCycle: z.enum(billingCycles),
    billingDay: z.number().int().min(1, messages.day).max(31, messages.day),
    billingMonth: z.number().int().min(1, messages.month).max(12, messages.month).nullable(),
    startDate: isoDateField,
    status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']),
  })
  .refine(yearlyNeedsMonth, { path: ['billingMonth'], message: 'Elige el mes de cobro.' });

export const subscriptionFormSchema = z
  .object({
    name: requiredText(100),
    icon: z.string().nullable(),
    amount: amountField(),
    billingCycle: z.enum(billingCycles),
    billingDay: intField(1, 31, messages.day),
    billingMonth: optionalIntField(1, 12, messages.month),
    startDate: isoDateField,
    accountId: z
      .string()
      .nullable()
      .refine((v): v is string => !!v, 'Elige la cuenta de cobro.'),
    categoryId: z.string().nullable(),
  })
  .refine(yearlyNeedsMonth, { path: ['billingMonth'], message: 'Elige el mes de cobro.' })
  .transform((v) => ({ ...v, billingMonth: v.billingCycle === 'YEARLY' ? v.billingMonth : null }));

export type SubscriptionFormValues = z.input<typeof subscriptionFormSchema>;
export type SubscriptionFormOutput = z.output<typeof subscriptionFormSchema>;
