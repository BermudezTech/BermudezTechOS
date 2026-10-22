import { ApiError } from '@/api/errors';

import { restoreSession, signIn } from './sessionService';
import { useSessionStore } from './sessionStore';
import * as tokenStorage from './tokenStorage';

jest.mock('@/api/client', () => ({
  ...jest.requireActual('@/api/client'),
  api: { request: jest.fn() },
  setTokenProvider: jest.fn(),
}));
jest.mock('./tokenStorage', () => {
  let state = { session: null as unknown, profile: null as unknown };
  return {
    load: jest.fn(async () => state),
    current: jest.fn(() => state),
    saveSession: jest.fn(async (session: unknown) => {
      state = { ...state, session };
    }),
    saveProfile: jest.fn(async (profile: unknown) => {
      state = { ...state, profile };
    }),
    clear: jest.fn(async () => {
      state = { session: null, profile: null };
    }),
    __set: (next: typeof state) => {
      state = next;
    },
  };
});

jest.mock('./localData', () => ({ resetLocalData: jest.fn(async () => {}), localRowCount: jest.fn(async () => 0) }));

const { api } = jest.requireMock('@/api/client') as { api: { request: jest.Mock } };
const storage = tokenStorage as unknown as jest.Mocked<typeof tokenStorage> & { __set(s: unknown): void };

const pair = { accessToken: 'a1', refreshToken: 'r1', expiresIn: 900, refreshExpiresIn: 604_800, tokenType: 'bearer' };
const me = { id: 'u1', email: 'ana@example.com', displayName: 'Ana', createdAt: '2026-01-01T00:00:00Z' };

beforeEach(() => {
  jest.clearAllMocks();
  storage.__set({ session: null, profile: null });
  useSessionStore.setState({ status: 'signedOut', expired: false, profile: null });
});

describe('signIn', () => {
  it('login + perfil: guarda bt.session y bt.profile y pasa a signedIn', async () => {
    api.request.mockResolvedValueOnce(pair).mockResolvedValueOnce(me);
    await expect(signIn(' ana@example.com ', 'secreta123')).resolves.toEqual({ kind: 'ok' });
    expect(api.request).toHaveBeenNthCalledWith(1, 'POST', '/auth/login', {
      auth: false,
      body: { email: 'ana@example.com', password: 'secreta123' },
    });
    expect(api.request).toHaveBeenNthCalledWith(2, 'GET', '/users/me', { accessToken: 'a1' });
    expect(storage.saveSession).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'a1', refreshToken: 'r1' }));
    expect(storage.saveProfile).toHaveBeenCalledWith({ id: 'u1', email: 'ana@example.com', displayName: 'Ana' });
    expect(useSessionStore.getState()).toMatchObject({ status: 'signedIn', expired: false, profile: { id: 'u1' } });
  });

  it('INVALID_CREDENTIALS: lanza el error tipado y no guarda nada', async () => {
    api.request.mockRejectedValueOnce(new ApiError(401, 'INVALID_CREDENTIALS', 'x'));
    await expect(signIn('ana@example.com', 'mala')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(storage.saveSession).not.toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe('signedOut');
  });

  it('si /users/me falla dos veces, el login falla sin dejar sesión', async () => {
    api.request
      .mockResolvedValueOnce(pair)
      .mockRejectedValueOnce(new ApiError(503, 'SERVER_ERROR', 'x'))
      .mockRejectedValueOnce(new ApiError(503, 'SERVER_ERROR', 'x'));
    await expect(signIn('ana@example.com', 'secreta123')).rejects.toMatchObject({ code: 'SERVER_ERROR' });
    expect(api.request).toHaveBeenCalledTimes(3);
    expect(storage.current().session).toBeNull();
    expect(useSessionStore.getState().status).toBe('signedOut');
  });
});

describe('restoreSession', () => {
  it('con sesión guardada entra sin red', async () => {
    storage.__set({ session: { accessToken: 'a' }, profile: { id: 'u1', email: 'ana@example.com', displayName: null } });
    await restoreSession();
    expect(api.request).not.toHaveBeenCalled();
    expect(useSessionStore.getState()).toMatchObject({ status: 'signedIn', profile: { id: 'u1' } });
  });

  it('sin nada guardado queda signedOut', async () => {
    await restoreSession();
    expect(useSessionStore.getState().status).toBe('signedOut');
  });
});
