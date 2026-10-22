import type { StoredSession } from '@/session/types';

import { createApiClient, type TokenProvider } from './client';
import { ApiError, NetworkError } from './errors';

const NOW = Date.parse('2026-10-20T12:00:00.000Z');

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function setup(session: Partial<StoredSession> = {}) {
  let stored: StoredSession | null = {
    accessToken: 'old-access',
    accessExpiresAt: new Date(NOW + 10 * 60_000).toISOString(),
    refreshToken: 'old-refresh',
    refreshExpiresAt: new Date(NOW + 7 * 86_400_000).toISOString(),
    ...session,
  };
  const tokens: TokenProvider & { rejected: number } = {
    rejected: 0,
    get: () => stored,
    save: async (s) => {
      stored = s;
    },
    onRefreshRejected() {
      this.rejected += 1;
    },
  };
  const calls: { path: string; auth: string | null }[] = [];
  const handlers: ((path: string, init: RequestInit) => Response | Promise<Response>)[] = [];
  const fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url).replace('http://api.test', '');
    calls.push({ path, auth: (init?.headers as Record<string, string>)?.Authorization ?? null });
    const handler = handlers.shift();
    if (!handler) throw new Error(`Petición inesperada: ${path}`);
    return handler(path, init!);
  }) as unknown as typeof globalThis.fetch;
  const client = createApiClient({ baseUrl: 'http://api.test', fetch, tokens, now: () => NOW, timeoutMs: 50 });
  return { client, tokens, calls, handlers, getStored: () => stored };
}

const pair = { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900, refreshExpiresIn: 604_800, tokenType: 'bearer' };

describe('apiClient', () => {
  it('con el acceso vencido, 3 peticiones simultáneas comparten una sola renovación', async () => {
    const { client, calls, handlers, getStored } = setup({ accessExpiresAt: new Date(NOW - 1000).toISOString() });
    handlers.push(
      () => json(200, pair),
      () => json(200, { ok: 1 }),
      () => json(200, { ok: 2 }),
      () => json(200, { ok: 3 }),
    );
    await Promise.all([client.request('GET', '/users/me'), client.request('GET', '/users/me'), client.request('GET', '/users/me')]);
    expect(calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1);
    expect(calls.filter((c) => c.path === '/users/me').every((c) => c.auth === 'Bearer new-access')).toBe(true);
    expect(getStored()).toEqual({
      accessToken: 'new-access',
      accessExpiresAt: new Date(NOW + 900_000).toISOString(),
      refreshToken: 'new-refresh',
      refreshExpiresAt: new Date(NOW + 604_800_000).toISOString(),
    });
  });

  it('401 UNAUTHENTICATED → renueva y reintenta una vez', async () => {
    const { client, calls, handlers } = setup();
    handlers.push(
      () => json(401, { error: { code: 'UNAUTHENTICATED', message: 'x' } }),
      () => json(200, pair),
      () => json(200, { id: 'u1' }),
    );
    await expect(client.request('GET', '/users/me')).resolves.toEqual({ id: 'u1' });
    expect(calls.map((c) => c.path)).toEqual(['/users/me', '/auth/refresh', '/users/me']);
  });

  it('renovación rechazada → onRefreshRejected una vez y SESSION_EXPIRED', async () => {
    const { client, tokens, handlers } = setup({ accessExpiresAt: new Date(NOW).toISOString() });
    handlers.push(() => json(401, { error: { code: 'INVALID_REFRESH_TOKEN', message: 'x' } }));
    const error = await client.request('GET', '/users/me').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('SESSION_EXPIRED');
    expect(tokens.rejected).toBe(1);
  });

  it('un error de red al renovar no vence la sesión', async () => {
    const { client, tokens, handlers } = setup({ accessExpiresAt: new Date(NOW).toISOString() });
    handlers.push(() => {
      throw new TypeError('Network request failed');
    });
    await expect(client.request('GET', '/users/me')).rejects.toBeInstanceOf(NetworkError);
    expect(tokens.rejected).toBe(0);
  });

  it('429 expone retryAfter', async () => {
    const { client, handlers } = setup();
    handlers.push(() => json(429, { error: { code: 'TOO_MANY_ATTEMPTS', message: 'x' } }, { 'Retry-After': '600' }));
    const error = (await client.request('POST', '/auth/login', { auth: false, body: {} }).catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('TOO_MANY_ATTEMPTS');
    expect(error.retryAfter).toBe(600);
  });

  it('5xx o cuerpo no JSON → SERVER_ERROR; 204 → undefined', async () => {
    const { client, handlers } = setup();
    handlers.push(
      () => new Response('<html>', { status: 502 }),
      () => new Response(null, { status: 204 }),
    );
    await expect(client.request('GET', '/x')).rejects.toMatchObject({ code: 'SERVER_ERROR', status: 502 });
    await expect(client.request('POST', '/auth/logout')).resolves.toBeUndefined();
  });

  it('un timeout lanza NetworkError', async () => {
    const { client, handlers } = setup();
    handlers.push(
      (_path, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    await expect(client.request('GET', '/slow')).rejects.toBeInstanceOf(NetworkError);
  });
});
