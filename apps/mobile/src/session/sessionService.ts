import { api, sessionFromTokenPair, setTokenProvider, type TokenPair } from '@/api/client';
import { getDb, isLocalDbOpen } from '@/db/openLocalDb';
import { stopSync, syncNow } from '@/sync';
import { isOnline } from '@/sync/connectivity';
import { refreshCounters, useSyncStore } from '@/sync/syncStore';

import { localRowCount, resetLocalData } from './localData';
import { useSessionStore } from './sessionStore';
import * as tokenStorage from './tokenStorage';
import type { StoredProfile, StoredSession } from './types';

export type SignInResult =
  | { kind: 'ok' }
  /** Los datos locales son de otra cuenta (o de una desconocida): `confirm()` los borra y entra. */
  | { kind: 'ownerMismatch'; pendingCount: number; confirm(): Promise<void> };

export type SignOutResult = { kind: 'done' } | { kind: 'pendingWouldBeLost'; pendingCount: number };

interface UserProfileResponse {
  id: string;
  email: string;
  displayName: string | null;
}

/** Al arrancar: lee `bt.session`/`bt.profile` sin tocar la red (FR-029) y registra el `TokenProvider`. */
export async function restoreSession(): Promise<void> {
  const { session, profile } = await tokenStorage.load();
  setTokenProvider({
    get: () => tokenStorage.current().session,
    save: tokenStorage.saveSession,
    onRefreshRejected: () => useSessionStore.setState({ expired: true }),
  });
  useSessionStore.setState(
    session ? { status: 'signedIn', expired: false, profile } : { status: 'signedOut', expired: false, profile: null },
  );
}

/** `GET /users/me` con un token aún no guardado; se reintenta una vez (contracts/api-usage.md). */
async function fetchProfile(accessToken: string): Promise<StoredProfile> {
  const get = () => api.request<UserProfileResponse>('GET', '/users/me', { accessToken });
  let me: UserProfileResponse;
  try {
    me = await get();
  } catch {
    me = await get();
  }
  return { id: me.id, email: me.email, displayName: me.displayName };
}

async function commit(session: StoredSession, profile: StoredProfile): Promise<void> {
  await tokenStorage.saveSession(session);
  await tokenStorage.saveProfile(profile);
  useSessionStore.setState({ status: 'signedIn', expired: false, profile });
}

/**
 * ¿Los datos locales son de otra cuenta? Se compara con el perfil guardado; sin perfil, una base con
 * datos tiene dueño desconocido y se trata igual (FR-032).
 */
async function belongsToOtherOwner(profile: StoredProfile): Promise<boolean> {
  const owner = tokenStorage.current().profile;
  if (owner) return owner.id !== profile.id;
  return (await localRowCount()) > 0;
}

/**
 * Inicia sesión: `POST /auth/login`, luego el perfil. No guarda nada hasta tener ambos, así un
 * fallo del perfil deja la app sin sesión. Lanza `ApiError`/`NetworkError` (ver `loginErrorMessage`).
 * Si los datos locales son de otra cuenta, no toca nada hasta que el usuario confirme.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const pair = await api.request<TokenPair>('POST', '/auth/login', { auth: false, body: { email: email.trim(), password } });
  const session = sessionFromTokenPair(pair, Date.now());
  const profile = await fetchProfile(session.accessToken);
  if (await belongsToOtherOwner(profile)) {
    return {
      kind: 'ownerMismatch',
      pendingCount: await pendingCount(),
      confirm: async () => {
        stopSync();
        await resetLocalData();
        await commit(session, profile);
      },
    };
  }
  // Con la misma cuenta se conservan los datos; si estaba vencida, el planificador sincroniza al reanudarse.
  await commit(session, profile);
  return { kind: 'ok' };
}

async function pendingCount(): Promise<number> {
  if (!isLocalDbOpen()) return 0;
  await refreshCounters(getDb());
  return useSyncStore.getState().pendingCount;
}

/**
 * Cierra sesión (FR-033, research R13): intenta subir lo pendiente; si algo no se puede subir y no
 * se fuerza, devuelve cuántos cambios se perderían sin tocar nada. Después revoca la sesión en el
 * servidor si hay red (sin importar el resultado) y borra la base local, el espejo y las credenciales.
 */
export async function signOut({ force = false }: { force?: boolean } = {}): Promise<SignOutResult> {
  if (isOnline() && (await pendingCount()) > 0) await syncNow();
  const remaining = await pendingCount();
  if (remaining > 0 && !force) return { kind: 'pendingWouldBeLost', pendingCount: remaining };

  stopSync();
  const refreshToken = tokenStorage.current().session?.refreshToken;
  if (isOnline() && refreshToken) {
    await api.request('POST', '/auth/logout', { body: { refreshToken } }).catch(() => {});
  }
  await resetLocalData();
  await tokenStorage.clear();
  useSessionStore.setState({ status: 'signedOut', expired: false, profile: null });
  return { kind: 'done' };
}
