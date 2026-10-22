import { StorageUnavailableError } from './storageErrors';
import type { StoredProfile, StoredSession } from './types';

/**
 * Sesión y perfil en `localStorage` (web): persisten al cerrar el navegador (Clarificación
 * 2026-10-20). Permitido por la constitución (Principio III v1.1.0) con CSP estricta y sin
 * scripts de terceros. Misma API que `tokenStorage.ts`.
 */
const SESSION_KEY = 'bt.session';
const PROFILE_KEY = 'bt.profile';

export interface StoredAuth {
  session: StoredSession | null;
  profile: StoredProfile | null;
}

let cache: StoredAuth = { session: null, profile: null };

function storage(): Storage {
  try {
    const probe = 'bt.probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    throw new StorageUnavailableError();
  }
}

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    storage().setItem(key, value);
  } catch {
    throw new StorageUnavailableError();
  }
}

export async function load(): Promise<StoredAuth> {
  const store = storage();
  cache = { session: parse<StoredSession>(store.getItem(SESSION_KEY)), profile: parse<StoredProfile>(store.getItem(PROFILE_KEY)) };
  return cache;
}

export function current(): StoredAuth {
  return cache;
}

export async function saveSession(session: StoredSession): Promise<void> {
  write(SESSION_KEY, JSON.stringify(session));
  cache = { ...cache, session };
}

export async function saveProfile(profile: StoredProfile): Promise<void> {
  write(PROFILE_KEY, JSON.stringify(profile));
  cache = { ...cache, profile };
}

export async function clear(): Promise<void> {
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    // Si el almacenamiento no está disponible no hay nada que borrar.
  }
  cache = { session: null, profile: null };
}
