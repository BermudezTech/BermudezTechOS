import type { TokenProvider } from '@/api/client';

import { restoreSession, signIn } from './sessionService';
import { useSessionStore } from './sessionStore';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), api: { request: jest.fn() }, setTokenProvider: jest.fn() }));
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
jest.mock('@/db/openLocalDb', () => ({ isLocalDbOpen: () => true, getDb: () => ({}) }));
jest.mock('@/sync', () => ({ syncNow: jest.fn(async () => ({ kind: 'ok' })), stopSync: jest.fn() }));
jest.mock('@/sync/connectivity', () => ({ isOnline: () => true }));
jest.mock('@/sync/syncStore', () => ({ ...jest.requireActual('@/sync/syncStore'), refreshCounters: jest.fn(async () => {}) }));

const { api, setTokenProvider } = jest.requireMock('@/api/client') as { api: { request: jest.Mock }; setTokenProvider: jest.Mock };
const storage = jest.requireMock('./tokenStorage') as { __set(s: unknown): void; current(): { session: unknown; profile: unknown } };
const localData = jest.requireMock('./localData') as { resetLocalData: jest.Mock; localRowCount: jest.Mock };
const { useSyncStore } = jest.requireActual('@/sync/syncStore') as typeof import('@/sync/syncStore');

const pair = { accessToken: 'a2', refreshToken: 'r2', expiresIn: 900, refreshExpiresIn: 604_800, tokenType: 'bearer' };
const ana = { id: 'u1', email: 'ana@example.com', displayName: 'Ana' };
const otro = { id: 'u2', email: 'otro@example.com', displayName: null };

beforeEach(async () => {
  jest.clearAllMocks();
  localData.localRowCount.mockResolvedValue(0);
  storage.__set({ session: { accessToken: 'a1', refreshToken: 'r1' }, profile: ana });
  useSyncStore.setState({ pendingCount: 2 });
  await restoreSession();
});

describe('sesión vencida (US6)', () => {
  it('onRefreshRejected marca vencida y conserva sesión, perfil y datos', () => {
    const provider = setTokenProvider.mock.calls[0]![0] as TokenProvider;
    provider.onRefreshRejected();
    expect(useSessionStore.getState()).toMatchObject({ status: 'signedIn', expired: true, profile: { id: 'u1' } });
    expect(storage.current().session).not.toBeNull();
    expect(localData.resetLocalData).not.toHaveBeenCalled();
  });

  it('reautenticarse con la misma cuenta quita el vencimiento y conserva la base', async () => {
    useSessionStore.setState({ expired: true });
    api.request.mockResolvedValueOnce(pair).mockResolvedValueOnce(ana);
    await expect(signIn('ana@example.com', 'secreta123')).resolves.toEqual({ kind: 'ok' });
    expect(useSessionStore.getState()).toMatchObject({ status: 'signedIn', expired: false });
    expect(localData.resetLocalData).not.toHaveBeenCalled();
    expect(storage.current().session).toMatchObject({ accessToken: 'a2' });
  });

  it('con otra cuenta pide confirmación y no cambia nada hasta confirmar (FR-032)', async () => {
    useSessionStore.setState({ expired: true });
    api.request.mockResolvedValueOnce(pair).mockResolvedValueOnce(otro);
    const result = await signIn('otro@example.com', 'secreta123');
    expect(result).toMatchObject({ kind: 'ownerMismatch', pendingCount: 2 });
    expect(storage.current()).toMatchObject({ session: { accessToken: 'a1' }, profile: { id: 'u1' } });
    expect(useSessionStore.getState().expired).toBe(true);
    expect(localData.resetLocalData).not.toHaveBeenCalled();

    if (result.kind !== 'ownerMismatch') throw new Error('se esperaba ownerMismatch');
    await result.confirm();
    expect(localData.resetLocalData).toHaveBeenCalled();
    expect(storage.current()).toMatchObject({ session: { accessToken: 'a2' }, profile: { id: 'u2' } });
    expect(useSessionStore.getState()).toMatchObject({ status: 'signedIn', expired: false, profile: { id: 'u2' } });
  });

  it('sin perfil guardado y con datos locales, la base no tiene dueño conocido: pide confirmación', async () => {
    storage.__set({ session: null, profile: null });
    localData.localRowCount.mockResolvedValue(5);
    api.request.mockResolvedValueOnce(pair).mockResolvedValueOnce(ana);
    expect(await signIn('ana@example.com', 'secreta123')).toMatchObject({ kind: 'ownerMismatch' });
  });

  it('sin perfil guardado y con la base vacía entra normalmente', async () => {
    storage.__set({ session: null, profile: null });
    api.request.mockResolvedValueOnce(pair).mockResolvedValueOnce(ana);
    expect(await signIn('ana@example.com', 'secreta123')).toEqual({ kind: 'ok' });
  });
});
