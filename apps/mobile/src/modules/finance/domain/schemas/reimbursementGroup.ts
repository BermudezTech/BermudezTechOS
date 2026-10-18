import { z } from 'zod';

import type { ReimbursementKind } from '../types';
import { optionalText, requiredText } from './common';

export const reimbursementKinds = ['REIMBURSEMENT', 'ADVANCE'] as const satisfies readonly ReimbursementKind[];

/** Reglas de data-model ("ReimbursementGroup"): `name` 1–100; `payer` y `notes` opcionales; `kind`. */
export const reimbursementGroupFormSchema = z.object({
  name: requiredText(100),
  payer: optionalText(100),
  kind: z.enum(reimbursementKinds),
  notes: optionalText(1000),
});

export const reimbursementGroupInputSchema = z.object({
  name: requiredText(100),
  payer: z.string().max(100).nullable(),
  kind: z.enum(reimbursementKinds),
  status: z.enum(['OPEN', 'SUBMITTED', 'SETTLED']),
  notes: z.string().max(1000).nullable(),
});

export type ReimbursementGroupFormValues = z.input<typeof reimbursementGroupFormSchema>;
