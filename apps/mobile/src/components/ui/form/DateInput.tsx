import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable } from 'react-native';

import { formatDateLocal, isoDate, parseIsoDate, todayParts, type IsoDate } from '@/lib/dates';
import { useTheme } from '@/theme';

import { AppText } from '../AppText';
import { Icon } from '../Icon';
import { useInputBoxStyle } from './FormField';

type Props = { value: IsoDate | null; onChange: (value: IsoDate) => void; hasError?: boolean; accessibilityLabel?: string };

/** Selector de fecha (Android). La versión web está en DateInput.web.tsx. */
export function DateInput({ value, onChange, hasError, accessibilityLabel }: Props) {
  const theme = useTheme();
  const box = useInputBoxStyle(hasError);

  const open = () => {
    // Sin valor, abre en hoy de Bogotá (spec 007, FR-028).
    const current = value ? parseIsoDate(value) : todayParts();
    DateTimePickerAndroid.open({
      // El selector trabaja en el calendario del dispositivo: la ida y vuelta por getFullYear/
      // getMonth/getDate conserva el día elegido en cualquier zona.
      value: new Date(current.year, current.month - 1, current.day),
      mode: 'date',
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          onChange(isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate()));
        }
      },
    });
  };

  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={box}>
      <Icon name="calendar-outline" size={18} color={theme.colors.textMuted} />
      <AppText style={{ flex: 1 }} tone={value ? 'default' : 'muted'}>
        {value ? formatDateLocal(value, "d 'de' MMMM 'de' yyyy") : 'Seleccionar fecha'}
      </AppText>
    </Pressable>
  );
}
