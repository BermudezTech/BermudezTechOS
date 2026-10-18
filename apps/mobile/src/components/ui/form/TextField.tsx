import { Platform, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from '../AppText';
import { useInputBoxStyle } from './FormField';

type Props = Omit<TextInputProps, 'style'> & { hasError?: boolean; prefix?: string; large?: boolean };

export function TextField({ hasError, prefix, large, ...rest }: Props) {
  const theme = useTheme();
  const box = useInputBoxStyle(hasError);
  const typo = large ? theme.typography.amountLarge : theme.typography.body;
  return (
    <View style={box}>
      {prefix ? (
        <AppText variant={large ? 'amountLarge' : 'body'} tone="muted">
          {prefix}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        {...rest}
        style={[
          typo,
          { flex: 1, color: theme.colors.text, paddingVertical: theme.spacing(2.5), minWidth: 0 },
          // En web el foco ya lo indica el borde de la caja.
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
        ]}
      />
    </View>
  );
}
