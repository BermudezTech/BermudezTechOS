import { View } from 'react-native';

import type { IsoDate } from '@/lib/dates';
import { useTheme } from '@/theme';

import { useInputBoxStyle } from './FormField';

type Props = { value: IsoDate | null; onChange: (value: IsoDate) => void; hasError?: boolean; accessibilityLabel?: string };

/** Selector de fecha nativo del navegador. */
export function DateInput({ value, onChange, hasError, accessibilityLabel }: Props) {
  const theme = useTheme();
  const box = useInputBoxStyle(hasError);
  return (
    <View style={box}>
      <input
        type="date"
        aria-label={accessibilityLabel}
        value={value ?? ''}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: theme.colors.text,
          fontFamily: theme.typography.body.fontFamily,
          fontSize: theme.typography.body.fontSize,
          colorScheme: theme.scheme,
          minHeight: 40,
        }}
      />
    </View>
  );
}
