import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from '../AppText';

type Props = { label: string; error?: string; hint?: string; children: ReactNode };

export function FormField({ label, error, hint, children }: Props) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing(1.5) }}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      {children}
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** Estilo compartido de las cajas de entrada. */
export function useInputBoxStyle(hasError?: boolean) {
  const theme = useTheme();
  return {
    minHeight: theme.layout.minTouchTarget + 4,
    paddingHorizontal: theme.spacing(3.5),
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: hasError ? theme.colors.danger : theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing(2),
  };
}
