import { create } from 'zustand';

import type { SqlDatabase } from '@/db/types';
import type { IsoDateTime } from '@/lib/dates';

import { SYNC_TABLES, type SyncTable } from './tables';

export interface SyncRejection {
  tableName: SyncTable;
  recordId: string;
  code: string;
  message: string;
  sentUpdatedAt: IsoDateTime | null;
  rejectedAt: IsoDateTime;
}

export type SyncErrorKind = 'network' | 'server' | 'session';

/** Estado de la sincronización (data-model §6). */
export interface SyncState {
  phase: 'idle' | 'pushing' | 'pulling';
  connectivity: 'online' | 'offline';
  /** Máximo de `sync_metadata.last_synced_at`. */
  lastSyncedAt: IsoDateTime | null;
  /** Las 8 tablas completaron al menos un PULL. */
  initialSyncComplete: boolean;
  pendingCount: number;
  rejections: SyncRejection[];
  lastError: { kind: SyncErrorKind; message: string } | null;
  clockAhead: boolean;
  /** Los contadores ya se leyeron de la base (evita mostrar "Descargando…" por un instante). */
  loaded: boolean;
}

const initialState: SyncState = {
  phase: 'idle',
  connectivity: 'online',
  lastSyncedAt: null,
  initialSyncComplete: false,
  pendingCount: 0,
  rejections: [],
  lastError: null,
  clockAhead: false,
  loaded: false,
};

export const useSyncStore = create<SyncState>(() => initialState);

export function resetSyncStore(): void {
  useSyncStore.setState(initialState, true);
}

interface RejectionRow {
  table_name: SyncTable;
  record_id: string;
  code: string;
  message: string;
  sent_updated_at: string | null;
  rejected_at: string;
}

/** Recalcula pendientes, rechazos y fechas desde la base. */
export async function refreshCounters(db: SqlDatabase): Promise<void> {
  const union = SYNC_TABLES.map((t) => `SELECT COUNT(*) AS n FROM ${t} WHERE is_dirty = 1`).join(' UNION ALL ');
  const pending = await db.getFirstAsync<{ n: number }>(`SELECT SUM(n) AS n FROM (${union})`);
  const rows = await db.getAllAsync<RejectionRow>('SELECT * FROM sync_rejections ORDER BY rejected_at DESC');
  const meta = await db.getFirstAsync<{ last: string | null; done: number }>(
    'SELECT MAX(last_synced_at) AS last, SUM(last_synced_at IS NOT NULL) AS done FROM sync_metadata',
  );
  const rejections = rows.map((r) => ({
    tableName: r.table_name,
    recordId: r.record_id,
    code: r.code,
    message: r.message,
    sentUpdatedAt: r.sent_updated_at,
    rejectedAt: r.rejected_at,
  }));
  useSyncStore.setState({
    pendingCount: pending?.n ?? 0,
    rejections,
    lastSyncedAt: meta?.last ?? null,
    initialSyncComplete: (meta?.done ?? 0) === SYNC_TABLES.length,
    clockAhead: rejections.some((r) => r.code === 'CLOCK_AHEAD'),
    loaded: true,
  });
}
