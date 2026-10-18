import { FormField, Select, type IconName } from '@/components/ui';
import { formatCop } from '@/lib/money';

import type { RecurringIncome } from '../../domain/types';

type Props = {
  value: string | null;
  options: RecurringIncome[];
  onChange: (id: string | null) => void;
};

/** Selector de plantilla en el formulario de ingreso (contracts/ui.md). */
export function RecurringIncomePicker({ value, options, onChange }: Props) {
  return (
    <FormField label="Ingreso recurrente (opcional)">
      <Select
        title="Ingreso recurrente"
        value={value}
        clearLabel="Ninguno"
        options={options.map((r) => ({
          value: r.id,
          label: r.name,
          description: `Valor esperado: ${formatCop(r.expectedAmount, { hideZeroCents: true })}`,
          icon: (r.icon as IconName | null) ?? 'cash-outline',
        }))}
        onChange={onChange}
      />
    </FormField>
  );
}
