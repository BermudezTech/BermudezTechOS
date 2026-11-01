import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Icon, IconButton } from '@/components/ui';
import { monthsByYear, periodLabel } from '@/lib/dates';
import { useTheme } from '@/theme';

import { useSummaryMonth } from '../../hooks/useSummaryMonth';
import { MonthPickerSheet } from './MonthPickerSheet';

/** Mes de las estadísticas del Resumen: flechas, nombre pulsable (abre la lista) y vuelta al mes actual. */
export function MonthSelector() {
  const theme = useTheme();
  const summary = useSummaryMonth();
  const [open, setOpen] = useState(false);
  const raw = periodLabel({ granularity: 'MONTH', anchor: summary.month });
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  const { minMonth } = summary;
  const canPick = minMonth !== null && minMonth < summary.currentMonth;

  return (
    <View style={{ gap: theme.spacing(1) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) }}>
        <IconButton icon="chevron-back" accessibilityLabel="Mes anterior" disabled={!summary.canPrev} onPress={summary.prev} />
        <Pressable
          onPress={() => setOpen(true)}
          disabled={!canPick}
          accessibilityRole="button"
          accessibilityLabel={`Elegir mes, ${raw}`}
          accessibilityState={{ disabled: !canPick }}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing(1),
            minHeight: theme.layout.minTouchTarget,
            borderRadius: theme.radii.pill,
            backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
          })}>
          <AppText variant="heading" accessibilityLiveRegion="polite">
            {label}
          </AppText>
          {canPick ? <Icon name="chevron-down" size={18} color={theme.colors.textMuted} /> : null}
        </Pressable>
        <IconButton icon="chevron-forward" accessibilityLabel="Mes siguiente" disabled={!summary.canNext} onPress={summary.next} />
      </View>
      {summary.isCurrent ? null : (
        <Pressable
          onPress={summary.reset}
          accessibilityRole="button"
          hitSlop={8}
          style={{ alignSelf: 'center', minHeight: theme.layout.minTouchTarget, justifyContent: 'center' }}>
          <AppText variant="bodyStrong" tone="accent">
            Volver al mes actual
          </AppText>
        </Pressable>
      )}
      {canPick && minMonth ? (
        <MonthPickerSheet
          visible={open}
          months={monthsByYear(minMonth, summary.currentMonth)}
          selected={summary.month}
          onSelect={summary.select}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </View>
  );
}
