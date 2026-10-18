import { z } from 'zod';

import type { AccountInput, AccountNature, AccountType } from '../types';
import { amountField, messages, optionalAmountField, optionalIntField, requiredText } from './common';

export const accountTypes = [
  'CHECKING',
  'SAVINGS',
  'CASH',
  'CREDIT_CARD',
  'POCKET',
  'INVESTMENT',
] as const satisfies readonly AccountType[];

/** `CREDIT_CARD` ⇒ `LIABILITY`; resto ⇒ `ASSET`. No editable. */
export function natureFor(type: AccountType): AccountNature {
  return type === 'CREDIT_CARD' ? 'LIABILITY' : 'ASSET';
}

/**
 * Reglas de data-model ("Account"):
 * - `name`: 1–100 caracteres, obligatorio.
 * - `POCKET` ⇔ `parentAccountId` no nulo (un solo nivel; el padre lo valida el repositorio).
 * - `openingBalance`: ≥ 0.
 * - `creditLimit`: obligatorio y > 0 solo en `CREDIT_CARD`.
 * - `statementDay` / `paymentDueDay`: 1–31, solo `CREDIT_CARD`.
 */
function refineAccount(
  value: {
    type: AccountType;
    parentAccountId: string | null;
    creditLimit: number | null;
    statementDay: number | null;
    paymentDueDay: number | null;
  },
  ctx: z.RefinementCtx,
) {
  if (value.type === 'POCKET' && !value.parentAccountId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parentAccountId'], message: 'Elige la cuenta principal de la cajita.' });
  }
  if (value.type !== 'POCKET' && value.parentAccountId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parentAccountId'], message: 'Solo las cajitas tienen cuenta principal.' });
  }
  if (value.type === 'CREDIT_CARD') {
    if (value.creditLimit === null || value.creditLimit <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['creditLimit'], message: 'El cupo es obligatorio y debe ser mayor que cero.' });
    }
  } else {
    for (const field of ['creditLimit', 'statementDay', 'paymentDueDay'] as const) {
      if (value[field] !== null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'Solo aplica a tarjetas de crédito.' });
      }
    }
  }
}

const day = (v: number | null) => v === null || (Number.isInteger(v) && v >= 1 && v <= 31);

/** Valida un `AccountInput` ya convertido (lo usa el repositorio). */
export const accountInputSchema = z
  .object({
    parentAccountId: z.string().nullable(),
    name: requiredText(100),
    type: z.enum(accountTypes),
    icon: z.string().nullable(),
    color: z.string().nullable(),
    openingBalance: z.number().int().min(0, 'El saldo inicial no puede ser negativo.'),
    creditLimit: z.number().int().nullable(),
    statementDay: z.number().nullable().refine(day, messages.day),
    paymentDueDay: z.number().nullable().refine(day, messages.day),
    isExcludedFromNetWorth: z.boolean(),
    isArchived: z.boolean(),
    sortOrder: z.number().int(),
  })
  .superRefine(refineAccount);

/** Valores del formulario (texto) → AccountInput. */
export const accountFormSchema = z
  .object({
    type: z.enum(accountTypes),
    name: requiredText(100),
    parentAccountId: z.string().nullable(),
    openingBalance: amountField({ positive: false }),
    creditLimit: optionalAmountField(),
    statementDay: optionalIntField(1, 31, messages.day),
    paymentDueDay: optionalIntField(1, 31, messages.day),
    icon: z.string().nullable(),
    color: z.string().nullable(),
    isExcludedFromNetWorth: z.boolean(),
  })
  .superRefine(refineAccount);

export type AccountFormValues = z.input<typeof accountFormSchema>;

export function toAccountInput(
  values: z.output<typeof accountFormSchema>,
  base?: Pick<AccountInput, 'isArchived' | 'sortOrder'>,
): AccountInput {
  return {
    ...values,
    parentAccountId: values.type === 'POCKET' ? values.parentAccountId : null,
    isArchived: base?.isArchived ?? false,
    sortOrder: base?.sortOrder ?? 0,
  };
}
