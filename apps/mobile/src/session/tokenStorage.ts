import * as SecureStore from 'expo-secure-store';

import type { StoredProfile, StoredSession } from './types';

/**
 * Sesión y perfil en `expo-secure-store` (Android, cifrado con Keystore; research R5). Mantiene
 * una copia en memoria para que `TokenProvider.get()` sea síncrono. Nunca en SQLite ni en logs.
 */
const SESSION_KEY = 'bt.session';
const PROFILE_KEY = 'bt.profile';

export interface StoredAuth {
  session: StoredSession | null;
  profile: StoredProfile | null;
}

let cache: StoredAuth = { session: null, profile: null };

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function load(): Promise<StoredAuth> {
  const [session, profile] = await Promise.all([SecureStore.getItemAsync(SESSION_KEY), SecureStore.getItemAsync(PROFILE_KEY)]);
  cache = { session: parse<StoredSession>(session), profile: parse<StoredProfile>(profile) };
  return cache;
}

export function current(): StoredAuth {
  return cache;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  cache = { ...cache, session };
}

export async function saveProfile(profile: StoredProfile): Promise<void> {
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile));
  cache = { ...cache, profile };
}

export async function clear(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(SESSION_KEY), SecureStore.deleteItemAsync(PROFILE_KEY)]);
  cache = { session: null, profile: null };
}
