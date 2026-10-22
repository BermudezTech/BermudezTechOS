import { useShallow } from 'zustand/react/shallow';

import { useFinanceStore } from '@/modules/finance/data/local/store';
import { useSessionStore } from '@/session/sessionStore';

import { syncNow } from './index';
import { describeRecord, deriveSyncStatus, rejectionMessage, syncStatusLabel } from './status';
import { useSyncStore } from './syncStore';
import { tableToEntity, type SyncTable } from './tables';

/** Primer sync del dispositivo (FR-025): `downloading` hasta que las 8 tablas terminan su primer PULL. */
export function useInitialSync() {
  return useSyncStore(
    useShallow((s) => ({
      downloading: s.loaded && !s.initialSyncComplete,
      failed: s.loaded && !s.initialSyncComplete && s.lastError !== null && s.phase === 'idle',
    })),
  );
}

/** Estado de Ajustes (FR-023). */
export function useSyncStatus() {
  const expired = useSessionStore((s) => s.expired);
  const sync = useSyncStore();
  const status = deriveSyncStatus(sync, { expired });
  return {
    status,
    label: syncStatusLabel[status],
    lastSyncedAt: sync.lastSyncedAt,
    pendingCount: sync.pendingCount,
    clockAhead: sync.clockAhead,
    offline: sync.connectivity === 'offline',
    expired,
  };
}

export interface RejectionView {
  table: SyncTable;
  id: string;
  title: string;
  reason: string;
}

/** Rechazos con su registro legible y su motivo. */
export function useSyncRejections(): RejectionView[] {
  const rejections = useSyncStore((s) => s.rejections);
  const data = useFinanceStore();
  return rejections.map((r) => {
    const entity = (data[tableToEntity[r.tableName]] as unknown as Record<string, Record<string, unknown>>)[r.recordId];
    return { table: r.tableName, id: r.recordId, title: describeRecord(r.tableName, entity), reason: rejectionMessage(r.code, r.message) };
  });
}

export function useSyncNow() {
  const running = useSyncStore((s) => s.phase !== 'idle');
  return { syncNow, running };
}
