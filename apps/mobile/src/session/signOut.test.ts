import { ApiError } from '@/api/errors';
import { useSyncStore } from '@/sync/syncStore';

import { signOut } from './sessionService';
import { useSessionStore } from './sessionStore';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: { request: jest.fn() }, setTokenProvider: jest.fn() }));
jest.mock('./tokenStorage', () => ({
  current: () => ({ session: { refreshToken: 'r1' }, profile: { id: 'u1' } }),
  clear: jest.fn(async () => {}),
}));
jest.mock('./localData', () => ({ resetLocalData: jest.fn(async () => {}) }));
jest.mock('@/db/openLocalDb', () => ({ isLocalDbOpen: () => true, getDb: () => ({}) }));
jest.mock('@/sync', () => ({ syncNow: jest.fn(async () => ({ kind: 'ok' })), stopSync: jest.fn() }));
jest.mock('@/sync/connectivity', () => ({ isOnline: jest.fn(() => true) }));
jest.mock('@/sync/syncStore', () => {
  const actual = jest.requireActual('@/sync/syncStore');
  return { ...actual, refreshCounters: jest.fn(async () => {}) };
});

const { api } = jest.requireMock('@/api/client') as { api: { request: jest.Mock } };
const { resetLocalData } = jest.requireMock('./localData') as { resetLocalData: jest.Mock };
const tokenStorage = jest.requireMock('./tokenStorage') as { clear: jest.Mock };
const sync = jest.requireMock('@/sync') as { syncNow: jest.Mock; stopSync: jest.Mock };
const connectivity = jest.requireMock('@/sync/connectivity') as { isOnline: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  connectivity.isOnline.mockReturnValue(true);
  api.request.mockResolvedValue(undefined);
  useSyncStore.setState({ pendingCount: 0 });
  useSessionStore.setState({ status: 'signedIn', expired: false, profile: { id: 'u1', email: 'a@b.co', displayName: null } });
});

describe('signOut', () => {
  it('sin pendientes: cierra en el servidor, borra todo y queda signedOut', async () => {
    await expect(signOut()).resolves.toEqual({ kind: 'done' });
    expect(sync.syncNow).not.toHaveBeenCalled();
    expect(sync.stopSync).toHaveBeenCalled();
    expect(api.request).toHaveBeenCalledWith('POST', '/auth/logout', { body: { refreshToken: 'r1' } });
    expect(resetLocalData).toHaveBeenCalled();
    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(useSessionStore.getState()).toMatchObject({ status: 'signedOut', profile: null });
  });

  it('con pendientes sincroniza primero y, si se subieron, cierra sesión', async () => {
    useSyncStore.setState({ pendingCount: 2 });
    sync.syncNow.mockImplementationOnce(async () => {
      useSyncStore.setState({ pendingCount: 0 });
      return { kind: 'ok' };
    });
    await expect(signOut()).resolves.toEqual({ kind: 'done' });
    expect(sync.syncNow).toHaveBeenCalledTimes(1);
  });

  it('si quedan pendientes sin subir, avisa y no borra nada', async () => {
    useSyncStore.setState({ pendingCount: 3 });
    await expect(signOut()).resolves.toEqual({ kind: 'pendingWouldBeLost', pendingCount: 3 });
    expect(resetLocalData).not.toHaveBeenCalled();
    expect(tokenStorage.clear).not.toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe('signedIn');
  });

  it('force: borra igualmente', async () => {
    useSyncStore.setState({ pendingCount: 3 });
    await expect(signOut({ force: true })).resolves.toEqual({ kind: 'done' });
    expect(resetLocalData).toHaveBeenCalled();
  });

  it('sin red: no llama al servidor y borra igualmente (FR-033)', async () => {
    connectivity.isOnline.mockReturnValue(false);
    useSyncStore.setState({ pendingCount: 1 });
    await expect(signOut({ force: true })).resolves.toEqual({ kind: 'done' });
    expect(sync.syncNow).not.toHaveBeenCalled();
    expect(api.request).not.toHaveBeenCalled();
    expect(resetLocalData).toHaveBeenCalled();
  });

  it('un error del logout en el servidor se ignora', async () => {
    api.request.mockRejectedValueOnce(new ApiError(500, 'SERVER_ERROR', 'x'));
    await expect(signOut()).resolves.toEqual({ kind: 'done' });
    expect(useSessionStore.getState().status).toBe('signedOut');
  });
});
