import type { z } from 'zod';

import { ValidationError, type ErrorCode } from '../FinanceRepository';

/** Valida con un esquema zod y lanza ValidationError con el primer problema. */
export function validate<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const code = ((issue && 'params' in issue && (issue.params as { code?: ErrorCode } | undefined)?.code) || 'INVALID') as ErrorCode;
  throw new ValidationError(code, issue?.path.join('.'), issue?.message);
}
