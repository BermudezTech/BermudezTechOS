import { z } from 'zod';

import { isoDate, parseIsoDate } from '@/lib/dates';
import { parseAmount, type Cents } from '@/lib/money';

/** Mensajes de validación en español, compartidos por los formularios. */
export const messages = {
  required: 'Este campo es obligatorio.',
  amountInvalid: 'Ingresa un monto válido (máximo 2 decimales).',
  amountPositive: 'El monto debe ser mayor que cero.',
  day: 'Ingresa un día entre 1 y 31.',
  month: 'Ingresa un mes entre 1 y 12.',
  date: 'Ingresa una fecha válida.',
  tooLong: (max: number) => `Máximo ${max} caracteres.`,
};

/** Campo de texto con longitud 1–max (se recorta). */
export const requiredText = (max: number) => z.string().trim().min(1, messages.required).max(max, messages.tooLong(max));

/** Texto opcional: cadena vacía → null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, messages.tooLong(max))
    .transform((v) => (v === '' ? null : v));

/** Monto escrito por el usuario → Cents. `positive` exige > 0 (por defecto). */
export const amountField = ({ positive = true }: { positive?: boolean } = {}) =>
  z.string().transform((value, ctx): Cents => {
    if (value.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.required, params: { code: 'REQUIRED' } });
      return z.NEVER;
    }
    const parsed = parseAmount(value);
    if (!parsed.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.amountInvalid, params: { code: 'AMOUNT_INVALID' } });
      return z.NEVER;
    }
    if (positive && parsed.value <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.amountPositive, params: { code: 'AMOUNT_INVALID' } });
      return z.NEVER;
    }
    return parsed.value;
  });

/** Monto opcional: vacío → null. */
export const optionalAmountField = () =>
  z.string().transform((value, ctx): Cents | null => {
    if (value.trim() === '') return null;
    const parsed = parseAmount(value);
    if (!parsed.ok || parsed.value <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.amountInvalid, params: { code: 'AMOUNT_INVALID' } });
      return z.NEVER;
    }
    return parsed.value;
  });

/** Entero en [min, max] escrito como texto; vacío → null. */
export const optionalIntField = (min: number, max: number, message: string) =>
  z.string().transform((value, ctx): number | null => {
    if (value.trim() === '') return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      return z.NEVER;
    }
    return n;
  });

export const intField = (min: number, max: number, message: string) =>
  optionalIntField(min, max, message).refine((v): v is number => v !== null, messages.required);

/** Fecha "YYYY-MM-DD" válida. */
export const isoDateField = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month, day } = parseIsoDate(value);
  const d = new Date(Date.UTC(year, month - 1, day));
  return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) === value;
}, messages.date);

/** Porcentaje decimal como texto con coma o punto, en (0, 100). Devuelve "10.2500". */
export const rateField = (decimals = 4, { allowZero = false } = {}) =>
  z.string().transform((value, ctx): string => {
    const normalized = value.trim().replace(',', '.');
    if (!/^\d{1,2}(\.\d{1,4})?$/.test(normalized)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ingresa un porcentaje válido (p. ej. 10,25).' });
      return z.NEVER;
    }
    const n = Number(normalized);
    if ((allowZero ? n < 0 : n <= 0) || n >= 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La tasa debe estar entre 0 y 100.' });
      return z.NEVER;
    }
    return n.toFixed(decimals);
  });

/** Primer mensaje de error por campo, para mostrar en la UI. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
