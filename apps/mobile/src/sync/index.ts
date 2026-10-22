import { AppState } from 'react-native';

import { api } from '@/api/client';
import { onLocalChange } from '@/db/localChanges';
import { getDb } from '@/db/openLocalDb';
import { appDbLock } from '@/db/writeLock';
import { applyRows } from '@/modules/finance/data/local/store';
import { useSessionStore } from '@/session/sessionStore';

import { isOnline, markOffline, markReachable, onConnectivityChange, startConnectivity, stopConnectivity } from './connectivity';
import { createSyncEngine, type SyncEngine, type SyncOutcome } from './syncEngine';
import { createSyncScheduler, type SyncScheduler } from './syncScheduler';
import { refreshCounters } from './syncStore';

/** Motor y planificador de la app sobre la base local, la API y el espejo de finanzas. */
let engine: SyncEngine | null = null;
let scheduler: SyncScheduler | null = null;

/** La sesión vencida vuelve a ser válida (re-autenticación con la misma cuenta). */
function onSessionResumed(listener: () => void): () => void {
  return useSessionStore.subscribe((state, previous) => {
    if (previous.expired && !state.expired && state.status === 'signedIn') listener();
  });
}

function ensureEngine(): SyncEngine {
  engine ??= createSyncEngine({
    db: getDb(),
    lock: appDbLock,
    api,
    isOnline,
    getSession: () => useSessionStore.getState(),
    applyToMirror: applyRows,
    onNetworkError: markOffline,
    onReachable: markReachable,
  });
  return engine;
}

/** Arranca los disparadores (requiere la base abierta). Idempotente. */
export function startSync(): void {
  const run = ensureEngine().run;
  startConnectivity();
  void refreshCounters(getDb()).catch(() => {});
  scheduler ??= createSyncScheduler({ run, appState: AppState, isOnline, onConnectivityChange, onLocalChange, onSessionResumed });
  scheduler.start();
}

export function stopSync(): void {
  scheduler?.stop();
  stopConnectivity();
}

/** "Sincronizar ahora" y cierre de sesión. */
export function syncNow(): Promise<SyncOutcome> {
  return ensureEngine().run();
}
