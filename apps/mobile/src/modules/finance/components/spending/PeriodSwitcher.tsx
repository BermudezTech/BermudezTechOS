import { View } from 'react-native';

import { AppText, IconButton, SegmentedControl } from '@/components/ui';
import { clampPeriod, isSamePeriod, periodLabel, shiftPeriod, todayLocal, type Granularity, type IsoDate, type Period } from '@/lib/dates';
import { useTheme } from '@/theme';

type Props = {
  period: Period;
  onChange: (period: Period) => void;
  /** Primer mes con datos; no se puede retroceder antes de su periodo. */
  min?: IsoDate | null;
};

export function PeriodSwitcher({ period, onChange, min = null }: Props) {
  const theme = useTheme();
  const today = todayLocal();
  const isCurrent = isSamePeriod(period, { ...period, anchor: today });
  const isFirst = min !== null && isSamePeriod(period, { ...period, anchor: min });
  const label = periodLabel(period);
  const change = (next: Period) => onChange(clampPeriod(next, min, today));
  return (
    <View style={{ gap: theme.spacing(3) }}>
      <SegmentedControl<Granularity>
        options={[
          { value: 'MONTH', label: 'Mes' },
          { value: 'YEAR', label: 'Año' },
        ]}
        value={period.granularity}
        onChange={(granularity) => change({ granularity, anchor: period.anchor })}
        accessibilityLabel="Periodo"
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel="Periodo anterior"
          disabled={isFirst}
          onPress={() => change(shiftPeriod(period, -1))}
        />
        <AppText variant="heading" accessibilityLiveRegion="polite">
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </AppText>
        <IconButton
          icon="chevron-forward"
          accessibilityLabel="Periodo siguiente"
          disabled={isCurrent}
          onPress={() => change(shiftPeriod(period, 1))}
        />
      </View>
    </View>
  );
}
