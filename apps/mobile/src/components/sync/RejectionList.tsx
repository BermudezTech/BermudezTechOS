import { View } from 'react-native';

import { AppText, Button, confirm, GlassCard, ListItem } from '@/components/ui';
import { getDb } from '@/db/openLocalDb';
import { syncNow } from '@/sync';
import { countDependents, discardLocalChange } from '@/sync/discard';
import { useSyncRejections, type RejectionView } from '@/sync/hooks';
import { useTheme } from '@/theme';

async function discard(rejection: RejectionView) {
  const db = getDb();
  const row = await db.getFirstAsync<{ server_updated_at: string | null }>(
    `SELECT server_updated_at FROM ${rejection.table} WHERE id = ?`,
    [rejection.id],
  );
  const dependents = row?.server_updated_at ? 0 : await countDependents(db, rejection.table, rejection.id);
  const message = row?.server_updated_at
    ? 'Se restaurará la versión del servidor.'
    : dependents > 0
      ? `Se eliminará este registro y ${dependents} ${dependents === 1 ? 'cambio que depende' : 'cambios que dependen'} de él.`
      : 'Se eliminará este registro, que nunca llegó al servidor.';
  const ok = await confirm({ title: 'Descartar mi cambio', message, confirmLabel: 'Descartar', destructive: true });
  if (!ok) return;
  await discardLocalChange(rejection.table, rejection.id);
  void syncNow();
}

/** Registros rechazados por el servidor con su motivo y "Descartar mi cambio" (FR-015, FR-015a). */
export function RejectionList() {
  const theme = useTheme();
  const rejections = useSyncRejections();
  if (rejections.length === 0) return null;
  return (
    <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
      <AppText tone="muted" style={{ padding: theme.spacing(2) }}>
        {rejections.length === 1 ? '1 cambio no se pudo guardar' : `${rejections.length} cambios no se pudieron guardar`} en el servidor.
        Corrígelos desde su pantalla o descártalos.
      </AppText>
      {rejections.map((r) => (
        <View key={`${r.table}:${r.id}`}>
          <ListItem
            title={r.title}
            subtitle={r.reason}
            icon="alert-circle-outline"
            iconColor={theme.colors.danger}
            right={<Button label="Descartar mi cambio" variant="ghost" compact onPress={() => void discard(r)} />}
          />
        </View>
      ))}
    </GlassCard>
  );
}
