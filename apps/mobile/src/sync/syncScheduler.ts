/** Estados de `AppState` que usa el planificador. */
type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

export interface SchedulerDeps {
  run: () => Promise<unknown>;
  appState: {
    currentState: AppStateStatus | string | null | undefined;
    addEventListener(type: 'change', listener: (state: AppStateStatus) => void): { remove(): void };
  };
  isOnline: () => boolean;
  onConnectivityChange: (listener: (online: boolean) => void) => () => void;
  onLocalChange: (listener: () => void) => () => void;
  /** La sesión vencida volvió a ser válida (re-autenticación): sincronizar enseguida. */
  onSessionResumed?: (listener: () => void) => () => void;
  debounceMs?: number;
  intervalMs?: number;
}

export interface SyncScheduler {
  start(): void;
  stop(): void;
  syncNow(): Promise<unknown>;
}

/**
 * Disparadores de la sincronización (research R14, FR-021): al montar, al volver a primer plano,
 * al recuperar la red, 5 s después del último cambio local y cada 5 min con la app en primer plano.
 * Sin red los disparadores se ignoran sin error (FR-022). Con la app en segundo plano no hay timers.
 */
export function createSyncScheduler({
  run,
  appState,
  isOnline,
  onConnectivityChange,
  onLocalChange,
  onSessionResumed,
  debounceMs = 5_000,
  intervalMs = 300_000,
}: SchedulerDeps): SyncScheduler {
  let debounce: ReturnType<typeof setTimeout> | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  let cleanups: (() => void)[] = [];

  const trigger = () => {
    if (!isOnline()) return;
    run().catch(() => {});
  };

  const clearTimers = () => {
    if (debounce) clearTimeout(debounce);
    if (interval) clearInterval(interval);
    debounce = null;
    interval = null;
  };

  const startInterval = () => {
    if (!interval) interval = setInterval(trigger, intervalMs);
  };

  return {
    start() {
      if (cleanups.length > 0) return;
      const appSub = appState.addEventListener('change', (state) => {
        if (state === 'active') {
          startInterval();
          trigger();
        } else if (state === 'background') {
          clearTimers();
        }
      });
      cleanups = [
        () => appSub.remove(),
        onConnectivityChange((online) => {
          if (online) trigger();
        }),
        onLocalChange(() => {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => {
            debounce = null;
            trigger();
          }, debounceMs);
        }),
        ...(onSessionResumed ? [onSessionResumed(trigger)] : []),
      ];
      if (appState.currentState === 'active') startInterval();
      trigger();
    },
    stop() {
      cleanups.forEach((cleanup) => cleanup());
      cleanups = [];
      clearTimers();
    },
    syncNow: () => run(),
  };
}
