import { z } from 'zod';

import { categoryPalette } from '@/theme/tokens';

import { ICON_CATALOG } from '../../categories/iconCatalog';
import { requiredText } from './common';

const catalogIcons = new Set<string>(ICON_CATALOG.map((i) => i.name));
const paletteColors = new Set(categoryPalette);

/**
 * Reglas de data-model ("Category"): nombre 1–50; ícono del catálogo y color de la paleta. Al editar
 * se acepta el ícono o color guardado aunque esté fuera de ellos, si no cambia (research R9).
 */
export function categoryInputSchema(current?: { icon: string | null; color: string | null }) {
  return z.object({
    name: requiredText(50),
    kind: z.enum(['INCOME', 'EXPENSE']),
    icon: z.string().refine((v) => catalogIcons.has(v) || v === current?.icon, 'Elige un ícono.'),
    color: z.string().refine((v) => paletteColors.has(v) || v === current?.color, 'Elige un color.'),
  });
}

export type CategoryFormValues = z.input<ReturnType<typeof categoryInputSchema>>;
