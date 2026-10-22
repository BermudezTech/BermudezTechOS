import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText, Badge, Button, GlassCard, Icon, type BadgeTone } from '@/components/ui';
import { useSyncNow, useSyncStatus } from '@/sync/hooks';
import { formatLastSync, type SyncStatus } from '@/sync/status';
import { useTheme } from '@/theme';

const badgeTone: Record<SyncStatus, BadgeTone> = {
  syncing: 'info',
  expired: 'warning',
  offline: 'neutral',
  errors: 'danger',
  synced: 'success',
};

/** Estado de la sincronización en Ajustes (US4, FR-023/FR-024). */
export function SyncStatusCard() {
  const theme = useTheme();
  const { status, label, lastSyncedAt, pendingCount, clockAhead, offline, expired } = useSyncStatus();
  const { syncNow, running } = useSyncNow();
  // Refresca el "hace X minutos" cada minuto.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <GlassCard>
      <View style={{ gap: theme.spacing(3) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing(2) }}>
          <AppText variant="bodyStrong">Estado</AppText>
          <Badge label={label} tone={badgeTone[status]} />
        </View>
        <AppText tone="muted">Último sync: {formatLastSync(lastSyncedAt, now)}</AppText>
        <AppText tone="muted">
          {pendingCount === 0
            ? 'Sin cambios pendientes'
            : `${pendingCount} ${pendingCount === 1 ? 'cambio pendiente' : 'cambios pendientes'}`}
        </AppText>
        {clockAhead ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing(2), alignItems: 'flex-start' }} accessibilityRole="alert">
            <Icon name="time-outline" size={18} color={theme.colors.warning} />
            <AppText tone="warning" style={{ flex: 1 }}>
              La fecha de tu dispositivo está adelantada. Revisa la fecha y hora.
            </AppText>
          </View>
        ) : null}
        <Button
          label={running ? 'Sincronizando…' : 'Sincronizar ahora'}
          icon="sync"
          variant="secondary"
          disabled={running || offline || expired}
          onPress={() => void syncNow()}
        />
      </View>
    </GlassCard>
  );
}
