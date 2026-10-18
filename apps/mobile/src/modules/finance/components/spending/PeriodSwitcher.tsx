import { View } from 'react-native';

import { AppText, IconButton, SegmentedControl } from '@/components/ui';
import { periodLabel, shiftPeriod, todayLocal, type Granularity, type Period } from '@/lib/dates';
import { useTheme } from '@/theme';

type Props = { period: Period; onChange: (period: Period) => void };

export function PeriodSwitcher({ period, onChange }: Props) {
  const theme = useTheme();
  const isCurrent = periodLabel(period) === periodLabel({ ...period, anchor: todayLocal() });
  const label = periodLabel(period);
  return (
    <View style={{ gap: theme.spacing(3) }}>
      <SegmentedControl<Granularity>
        options={[
          { value: 'MONTH', label: 'Mes' },
          { value: 'YEAR', label: 'Año' },
        ]}
        value={period.granularity}
        onChange={(granularity) => onChange({ granularity, anchor: period.anchor })}
        accessibilityLabel="Periodo"
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" accessibilityLabel="Periodo anterior" onPress={() => onChange(shiftPeriod(period, -1))} />
        <AppText variant="heading" accessibilityLiveRegion="polite">
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </AppText>
        <View style={{ opacity: isCurrent ? 0.35 : 1 }} pointerEvents={isCurrent ? 'none' : 'auto'}>
          <IconButton icon="chevron-forward" accessibilityLabel="Periodo siguiente" onPress={() => onChange(shiftPeriod(period, 1))} />
        </View>
      </View>
    </View>
  );
}
