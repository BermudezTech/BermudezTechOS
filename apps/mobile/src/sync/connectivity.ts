import * as Network from 'expo-network';

import { useSyncStore } from './syncStore';

/**
 * Conectividad con `expo-network` (research R7). "En línea" = conectado y con internet
 * (`isInternetReachable` desconocido cuenta como alcanzable). Un `NetworkError` del cliente HTTP
 * marca "sin conexión" en el estado visible, pero no la red del dispositivo: así el siguiente
 * disparador (primer plano, intervalo, manual) vuelve a intentarlo.
 */
type Listener = (online: boolean) => void;

const listeners = new Set<Listener>();
let online = true;
let subscription: { remove(): void } | null = null;

function toOnline(state: Network.NetworkState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

function update(next: boolean): void {
  const changed = next !== online;
  online = next;
  useSyncStore.setState({ connectivity: next ? 'online' : 'offline' });
  if (changed) for (const listener of listeners) listener(next);
}

/** Empieza a escuchar la red. Idempotente. */
export function startConnectivity(): void {
  if (subscription) return;
  subscription = Network.addNetworkStateListener((state) => update(toOnline(state)));
  Network.getNetworkStateAsync()
    .then((state) => update(toOnline(state)))
    .catch(() => {});
}

export function stopConnectivity(): void {
  subscription?.remove();
  subscription = null;
}

export function isOnline(): boolean {
  return online;
}

/** El servidor no respondió: se muestra "sin conexión" hasta el próximo sync que llegue a él. */
export function markOffline(): void {
  useSyncStore.setState({ connectivity: 'offline' });
}

export function markReachable(): void {
  if (online) useSyncStore.setState({ connectivity: 'online' });
}

export function onConnectivityChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
