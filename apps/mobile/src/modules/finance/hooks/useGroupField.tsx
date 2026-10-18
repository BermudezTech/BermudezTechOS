import { useCallback, type ReactNode } from 'react';

import { FormField, Select } from '@/components/ui';

import { useActiveGroups } from './useFinanceData';

type GroupFieldProps = { value: string | null; onChange: (id: string | null) => void };

/**
 * Selector opcional de grupo de reembolso para el formulario de movimiento (FR-016). Solo
 * ofrece grupos OPEN o SUBMITTED; si no hay ninguno (y el movimiento no tiene grupo), no se muestra.
 */
export function useGroupField(): ((props: GroupFieldProps) => ReactNode) | undefined {
  const groups = useActiveGroups();
  const render = useCallback(
    ({ value, onChange }: GroupFieldProps) => {
      const options = groups
        .filter((g) => g.status !== 'SETTLED' || g.id === value)
        .map((g) => ({
          value: g.id,
          label: g.name,
          description: g.kind === 'ADVANCE' ? 'Adelanto' : 'Reembolso',
          icon: 'briefcase-outline' as const,
        }));
      if (options.length === 0) return null;
      return (
        <FormField label="Grupo de reembolso (opcional)" hint="Dinero de terceros: no cuenta como gasto ni ingreso personal.">
          <Select title="Grupo de reembolso" value={value} options={options} clearLabel="Ninguno (gasto personal)" onChange={onChange} />
        </FormField>
      );
    },
    [groups],
  );
  return render;
}
