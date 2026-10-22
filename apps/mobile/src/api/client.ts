import { apiBaseUrl } from '@/config/env';
import type { StoredSession } from '@/session/types';

import { ApiError, NetworkError, parseErrorResponse } from './errors';

/** Acceso a la sesión guardada; lo registra `@/session` al arrancar. */
export interface TokenProvider {
  /** Síncrono: el almacenamiento mantiene una copia en memoria. */
  get(): StoredSession | null;
  save(session: StoredSession): Promise<void>;
  /** La renovación fue rechazada: la sesión pasa a "vencida" (FR-031). */
  onRefreshRejected(): void;
}

export type HttpMethod = 'GET' | 'POST';

export interface RequestOptions {
  body?: unknown;
  /** Rutas protegidas (por defecto). `false` para login, refresh y recuperación de contraseña. */
  auth?: boolean;
  /** Token de acceso a usar en lugar del guardado, sin renovar (perfil tras un login aún no guardado). */
  accessToken?: string;
}

export interface ApiClient {
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T>;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

/** `bt.session` a partir de la respuesta de login o refresh, con vencimientos absolutos en UTC. */
export function sessionFromTokenPair(pair: TokenPair, at: number): StoredSession {
  return {
    accessToken: pair.accessToken,
    accessExpiresAt: new Date(at + pair.expiresIn * 1000).toISOString(),
    refreshToken: pair.refreshToken,
    refreshExpiresAt: new Date(at + pair.refreshExpiresIn * 1000).toISOString(),
  };
}

interface ClientDeps {
  baseUrl: string;
  fetch: typeof fetch;
  tokens: TokenProvider;
  now?: () => number;
  timeoutMs?: number;
}

/** Margen para renovar antes de que venza el acceso. */
const REFRESH_MARGIN_MS = 30_000;

/**
 * Cliente HTTP sobre `fetch` (research R6): JSON, timeout, `Authorization: Bearer`, renovación
 * anticipada y tras `401 UNAUTHENTICATED`, con una sola renovación compartida (FR-030).
 */
export function createApiClient({ baseUrl, fetch: doFetch, tokens, now = Date.now, timeoutMs = 20_000 }: ClientDeps): ApiClient {
  let refreshing: Promise<void> | null = null;

  async function send(method: HttpMethod, path: string, body: unknown, accessToken: string | null): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    try {
      return await doFetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new NetworkError();
    } finally {
      clearTimeout(timer);
    }
  }

  function sessionOrThrow(): StoredSession {
    const session = tokens.get();
    if (!session) throw new ApiError(401, 'SIGNED_OUT', 'No hay sesión iniciada.');
    return session;
  }

  async function doRefresh(): Promise<void> {
    const session = sessionOrThrow();
    const res = await send('POST', '/auth/refresh', { refreshToken: session.refreshToken }, null);
    if (!res.ok) {
      const error = await parseErrorResponse(res);
      if (error.status === 401) {
        tokens.onRefreshRejected();
        throw new ApiError(401, 'SESSION_EXPIRED', 'Tu sesión venció. Inicia sesión para sincronizar.');
      }
      throw error;
    }
    await tokens.save(sessionFromTokenPair((await res.json()) as TokenPair, now()));
  }

  function refresh(): Promise<void> {
    refreshing ??= doRefresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function freshAccessToken(): Promise<string> {
    if (refreshing) await refreshing;
    let session = sessionOrThrow();
    if (Date.parse(session.accessExpiresAt) - now() < REFRESH_MARGIN_MS) {
      await refresh();
      session = sessionOrThrow();
    }
    return session.accessToken;
  }

  return {
    async request<T>(method: HttpMethod, path: string, { body, auth = true, accessToken }: RequestOptions = {}): Promise<T> {
      if (accessToken) {
        const res = await send(method, path, body, accessToken);
        if (!res.ok) throw await parseErrorResponse(res);
        return (await res.json()) as T;
      }
      let res = await send(method, path, body, auth ? await freshAccessToken() : null);
      if (auth && res.status === 401) {
        const error = await parseErrorResponse(res);
        if (error.code !== 'UNAUTHENTICATED') throw error;
        await refresh();
        res = await send(method, path, body, sessionOrThrow().accessToken);
      }
      if (!res.ok) throw await parseErrorResponse(res);
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    },
  };
}

let provider: TokenProvider | null = null;

export function setTokenProvider(tokens: TokenProvider | null): void {
  provider = tokens;
}

/** Cliente de la app; `@/session` registra el `TokenProvider` con `setTokenProvider()`. */
export const api: ApiClient = createApiClient({
  baseUrl: apiBaseUrl,
  fetch: (...args) => globalThis.fetch(...args),
  tokens: {
    get: () => provider?.get() ?? null,
    save: async (session) => provider?.save(session),
    onRefreshRejected: () => provider?.onRefreshRejected(),
  },
});
