import { View } from 'react-native';

import { RejectionList } from '@/components/sync/RejectionList';
import { SyncStatusCard } from '@/components/sync/SyncStatusCard';
import { AppText, Badge, GlassCard, IconBadge, ListItem, Screen, SectionHeader, SegmentedControl } from '@/components/ui';
import { appModules } from '@/modules/registry';
import { SignOutButton } from '@/session/components/SignOutButton';
import { useSession } from '@/session/hooks';
import { useTheme, useThemeMode, type ThemeMode } from '@/theme';

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();
  const { profile } = useSession();

  return (
    <Screen title="Ajustes">
      <GlassCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) }}>
          <IconBadge name="person" size={48} />
          <View style={{ flex: 1 }}>
            <AppText variant="heading" numberOfLines={1}>
              {profile?.displayName || profile?.email}
            </AppText>
            {profile?.displayName ? (
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {profile.email}
              </AppText>
            ) : null}
          </View>
        </View>
      </GlassCard>

      <SectionHeader title="Sincronización" />
      <SyncStatusCard />
      <RejectionList />

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

      <SignOutButton />
    </Screen>
  );
}
