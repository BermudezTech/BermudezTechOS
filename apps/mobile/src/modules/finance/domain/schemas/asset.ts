import { z } from 'zod';

import { amountField, isoDateField, requiredText } from './common';

/** Reglas de data-model ("Asset"): `name` 1–100; `value` ≥ 0; `validUntil` fecha obligatoria. */
export const assetInputSchema = z.object({
  name: requiredText(100),
  value: z.number().int().min(0, 'El valor no puede ser negativo.'),
  validUntil: isoDateField,
});

export const assetFormSchema = z.object({
  name: requiredText(100),
  value: amountField({ positive: false }),
  validUntil: isoDateField,
});

export type AssetFormValues = z.input<typeof assetFormSchema>;
