import { Pressable, Switch, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from '../AppText';

type Props = { label: string; description?: string; value: boolean; onChange: (value: boolean) => void };

export function SwitchField({ label, description, value, onChange }: Props) {
  const theme = useTheme();
  return (
    // Toda la fila es el objetivo táctil (≥ 44 px), no solo el interruptor.
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), minHeight: theme.layout.minTouchTarget }}>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="caption" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityElementsHidden
        importantForAccessibility="no"
        trackColor={{ true: theme.colors.accent, false: theme.colors.surfacePressed }}
        thumbColor="#FFFFFF"
      />
    </Pressable>
  );
}
