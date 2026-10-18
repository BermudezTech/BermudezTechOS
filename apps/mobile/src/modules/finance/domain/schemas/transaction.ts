import { z } from 'zod';

import { localDateTimeToUtc, localDayKey, localTimeParts, todayLocal, type IsoDate, type IsoDateTime } from '@/lib/dates';
import { MAX_CENTS } from '@/lib/money';

import { periodFor } from '../recurringIncomes';
import type { Category, RecurringIncomeCycle, Transaction, TransactionInput, TransactionType } from '../types';
import { amountField, isoDateField, messages, optionalText } from './common';

export const transactionTypes = ['INCOME', 'EXPENSE', 'TRANSFER'] as const satisfies readonly TransactionType[];

/**
 * Reglas de data-model ("Transaction"):
 * - `accountId`: obligatorio; cuenta no archivada al crear (lo verifica el repositorio).
 * - `counterAccountId`: obligatorio **si y solo si** `type = 'TRANSFER'`; ≠ `accountId`.
 * - `amount`: > 0; entrada con máx. 2 decimales; ≤ 99.999.999.999.999 centavos.
 * - `categoryId`: `null` en transferencias o "Sin categoría"; su `kind` debe coincidir con el tipo.
 * - `description`: ≤ 500 caracteres.
 * - `reimbursementGroupId`: no aplica a transferencias.
 */
type RuleInput = {
  type: TransactionType;
  accountId: string | null;
  counterAccountId: string | null;
  categoryId: string | null;
  reimbursementGroupId: string | null;
};

function refineTransaction(categories: Map<string, Category> | null) {
  return (value: RuleInput, ctx: z.RefinementCtx) => {
    if (!value.accountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['accountId'], message: 'Elige una cuenta.', params: { code: 'REQUIRED' } });
    }
    if (value.type === 'TRANSFER') {
      if (!value.counterAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['counterAccountId'],
          message: 'Elige la cuenta destino.',
          params: { code: 'REQUIRED' },
        });
      } else if (value.counterAccountId === value.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['counterAccountId'],
          message: 'La cuenta destino debe ser distinta de la de origen.',
          params: { code: 'SAME_ACCOUNT' },
        });
      }
      if (value.categoryId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['categoryId'],
          message: 'Las transferencias no llevan categoría.',
          params: { code: 'CATEGORY_KIND_MISMATCH' },
        });
      }
      if (value.reimbursementGroupId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reimbursementGroupId'],
          message: 'Las transferencias no se asocian a grupos.',
          params: { code: 'INVALID' },
        });
      }
    } else if (value.counterAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['counterAccountId'],
        message: 'Solo las transferencias tienen cuenta destino.',
        params: { code: 'INVALID' },
      });
    }
    if (value.categoryId && categories && value.type !== 'TRANSFER') {
      const category = categories.get(value.categoryId);
      if (!category || category.kind !== value.type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['categoryId'],
          message: value.type === 'INCOME' ? 'Elige una categoría de ingreso.' : 'Elige una categoría de egreso.',
          params: { code: 'CATEGORY_KIND_MISMATCH' },
        });
      }
    }
  };
}

/** Valida un `TransactionInput` ya convertido (lo usa el repositorio). */
export function transactionInputSchema(categories: Map<string, Category>) {
  return z
    .object({
      accountId: z.string().min(1),
      counterAccountId: z.string().nullable(),
      type: z.enum(transactionTypes),
      amount: z
        .number()
        .int()
        .refine((n) => n > 0, { message: messages.amountPositive, params: { code: 'AMOUNT_INVALID' } })
        .refine((n) => n <= MAX_CENTS, { message: messages.amountInvalid, params: { code: 'AMOUNT_INVALID' } }),
      categoryId: z.string().nullable(),
      categorySource: z.enum(['MANUAL', 'AI']),
      occurredAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), messages.date),
      description: z.string().max(500, messages.tooLong(500)).nullable(),
      reimbursementGroupId: z.string().nullable(),
      subscriptionId: z.string().nullable(),
      subscriptionPeriod: z.string().nullable(),
      cdtId: z.string().nullable(),
      recurringIncomeId: z.string().nullable(),
      recurringIncomePeriod: z.string().nullable(),
    })
    .superRefine(refineTransaction(categories));
}

/** Formulario: monto como texto y fecha local. */
export function transactionFormSchema(categories: Map<string, Category>) {
  return z
    .object({
      type: z.enum(transactionTypes),
      amount: amountField(),
      accountId: z.string().nullable(),
      counterAccountId: z.string().nullable(),
      categoryId: z.string().nullable(),
      date: isoDateField,
      description: optionalText(500),
      reimbursementGroupId: z.string().nullable(),
      recurringIncomeId: z
        .string()
        .nullish()
        .transform((v) => v ?? null),
    })
    .superRefine(refineTransaction(categories));
}

export type TransactionFormValues = z.input<ReturnType<typeof transactionFormSchema>>;
export type TransactionFormOutput = z.output<ReturnType<typeof transactionFormSchema>>;

/**
 * Fecha del formulario → instante UTC. Si no cambió la fecha, conserva la hora original;
 * si es hoy, usa la hora actual; en otro caso, mediodía local.
 */
export function dateToOccurredAt(date: IsoDate, original?: IsoDateTime, now = new Date()): IsoDateTime {
  if (original && localDayKey(original) === date) return original;
  if (date === todayLocal()) {
    const { hours, minutes } = localTimeParts(now.toISOString());
    return localDateTimeToUtc(date, hours, minutes);
  }
  return localDateTimeToUtc(date, 12, 0);
}

/**
 * `cycleOf` da la periodicidad de la plantilla vinculada; el periodo se recalcula desde la fecha
 * local (research R4). Si la plantilla ya no existe, se infiere del periodo original.
 */
export function toTransactionInput(
  values: TransactionFormOutput,
  original?: Transaction,
  cycleOf?: (recurringIncomeId: string) => RecurringIncomeCycle | undefined,
): TransactionInput {
  const isTransfer = values.type === 'TRANSFER';
  const recurringIncomeId = values.type === 'INCOME' ? values.recurringIncomeId : null;
  const cycle = recurringIncomeId
    ? (cycleOf?.(recurringIncomeId) ?? (original?.recurringIncomePeriod?.length === 4 ? 'YEARLY' : 'MONTHLY'))
    : null;
  const categoryChanged = original ? original.categoryId !== values.categoryId : true;
  return {
    type: values.type,
    amount: values.amount,
    accountId: values.accountId!,
    counterAccountId: isTransfer ? values.counterAccountId : null,
    categoryId: isTransfer ? null : values.categoryId,
    categorySource: original && !categoryChanged ? original.categorySource : 'MANUAL',
    occurredAt: dateToOccurredAt(values.date, original?.occurredAt),
    description: values.description,
    reimbursementGroupId: isTransfer ? null : values.reimbursementGroupId,
    subscriptionId: original?.subscriptionId ?? null,
    subscriptionPeriod: original?.subscriptionPeriod ?? null,
    cdtId: original?.cdtId ?? null,
    recurringIncomeId,
    recurringIncomePeriod: recurringIncomeId && cycle ? periodFor(cycle, values.date) : null,
  };
}
