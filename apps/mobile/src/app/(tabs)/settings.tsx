import { View } from 'react-native';

import { AppText, Badge, Button, confirm, GlassCard, IconBadge, ListItem, Screen, SectionHeader, SegmentedControl } from '@/components/ui';
import { resetMockData, useSeedMode } from '@/modules/finance/hooks/useMockData';
import { appModules } from '@/modules/registry';
import { mockUser } from '@/session/mockUser';
import { useTheme, useThemeMode, type ThemeMode } from '@/theme';

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();
  const seedMode = useSeedMode();

  const reset = async (target: 'full' | 'empty') => {
    const ok = await confirm({
      title: target === 'full' ? 'Restablecer datos de prueba' : 'Vaciar datos de prueba',
      message:
        target === 'full'
          ? 'Se perderán los cambios de esta sesión y se cargarán los datos de prueba completos.'
          : 'Se borrarán todos los datos de prueba para revisar los estados vacíos. Las categorías se conservan.',
      confirmLabel: target === 'full' ? 'Restablecer' : 'Vaciar',
      destructive: true,
    });
    if (ok) resetMockData(target);
  };

  return (
    <Screen title="Ajustes">
      <GlassCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) }}>
          <IconBadge name="person" size={48} />
          <View style={{ flex: 1 }}>
            <AppText variant="heading">{mockUser.displayName}</AppText>
            <AppText variant="caption" tone="muted">
              Usuario de prueba · sin inicio de sesión en esta versión
            </AppText>
          </View>
        </View>
      </GlassCard>

      <SectionHeader title="Apariencia" />
      <GlassCard>
        <View style={{ gap: theme.spacing(2) }}>
          <AppText tone="muted">Tema</AppText>
          <SegmentedControl options={themeOptions} value={mode} onChange={setMode} accessibilityLabel="Tema" />
        </View>
      </GlassCard>

      <SectionHeader title="Módulos" />
      <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
        {appModules
          .filter((m) => m.placement === 'main')
          .map((m) => (
            <ListItem
              key={m.id}
              title={m.label}
              icon={m.icon}
              muted={m.status === 'coming_soon'}
              right={
                <Badge label={m.status === 'active' ? 'Activo' : 'Próximamente'} tone={m.status === 'active' ? 'success' : 'neutral'} />
              }
            />
          ))}
      </GlassCard>

      <SectionHeader title="Datos de prueba" />
      <GlassCard>
        <View style={{ gap: theme.spacing(3) }}>
          <AppText tone="muted">
            Los datos viven solo en memoria: se reinician al recargar la app. Conjunto actual:{' '}
            {seedMode === 'full' ? 'datos completos' : 'sin datos'}.
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
            <Button label="Restablecer datos completos" icon="refresh" variant="secondary" onPress={() => reset('full')} />
            <Button label="Usar sin datos" icon="trash-outline" variant="danger" onPress={() => reset('empty')} />
          </View>
        </View>
      </GlassCard>
    </Screen>
  );
}
