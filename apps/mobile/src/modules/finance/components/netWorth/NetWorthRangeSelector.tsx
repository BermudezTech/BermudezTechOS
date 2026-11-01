import { SegmentedControl } from '@/components/ui';

import type { NetWorthRange } from '../../domain/netWorth';

const OPTIONS: { value: NetWorthRange; label: string }[] = [
  { value: '6M', label: '6M' },
  { value: '12M', label: '12M' },
  { value: '24M', label: '24M' },
  { value: 'ALL', label: 'Todo' },
];

export function NetWorthRangeSelector({ value, onChange }: { value: NetWorthRange; onChange: (range: NetWorthRange) => void }) {
  return <SegmentedControl<NetWorthRange> options={OPTIONS} value={value} onChange={onChange} accessibilityLabel="Rango de la gráfica" />;
}
