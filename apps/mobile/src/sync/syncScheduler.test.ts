import { createSyncScheduler, type SchedulerDeps } from './syncScheduler';

function setup(online = true) {
  let appListener: ((state: 'active' | 'background') => void) | null = null;
  let netListener: ((online: boolean) => void) | null = null;
  let localListener: (() => void) | null = null;
  let resumeListener: (() => void) | null = null;
  const state = { online };
  const run = jest.fn(async () => {});
  const deps: SchedulerDeps = {
    run,
    appState: {
      currentState: 'active',
      addEventListener: (_type, listener) => {
        appListener = listener;
        return { remove: () => (appListener = null) };
      },
    },
    isOnline: () => state.online,
    onConnectivityChange: (listener) => {
      netListener = listener;
      return () => (netListener = null);
    },
    onLocalChange: (listener) => {
      localListener = listener;
      return () => (localListener = null);
    },
    onSessionResumed: (listener) => {
      resumeListener = listener;
      return () => (resumeListener = null);
    },
  };
  const scheduler = createSyncScheduler(deps);
  return {
    scheduler,
    run,
    state,
    app: (s: 'active' | 'background') => appListener?.(s),
    net: (o: boolean) => {
      state.online = o;
      netListener?.(o);
    },
    local: () => localListener?.(),
    resume: () => resumeListener?.(),
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('syncScheduler', () => {
  it('sincroniza al arrancar', () => {
    const t = setup();
    t.scheduler.start();
    expect(t.run).toHaveBeenCalledTimes(1);
  });

  it('agrupa varios cambios locales en un solo ciclo 5 s después del último', () => {
    const t = setup();
    t.scheduler.start();
    t.run.mockClear();
    t.local();
    jest.advanceTimersByTime(3_000);
    t.local();
    jest.advanceTimersByTime(3_000);
    t.local();
    jest.advanceTimersByTime(4_999);
    expect(t.run).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(t.run).toHaveBeenCalledTimes(1);
  });

  it('cada 5 min solo con la app en primer plano', () => {
    const t = setup();
    t.scheduler.start();
    t.run.mockClear();
    jest.advanceTimersByTime(300_000);
    expect(t.run).toHaveBeenCalledTimes(1);
    t.app('background');
    jest.advanceTimersByTime(900_000);
    expect(t.run).toHaveBeenCalledTimes(1);
    t.app('active');
    expect(t.run).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(300_000);
    expect(t.run).toHaveBeenCalledTimes(3);
  });

  it('pasar a segundo plano cancela el cambio local pendiente', () => {
    const t = setup();
    t.scheduler.start();
    t.run.mockClear();
    t.local();
    t.app('background');
    jest.advanceTimersByTime(10_000);
    expect(t.run).not.toHaveBeenCalled();
  });

  it('recuperar la red sincroniza; sin red los disparadores no hacen nada (FR-022)', () => {
    const t = setup(false);
    t.scheduler.start();
    t.local();
    jest.advanceTimersByTime(300_000);
    t.app('active');
    expect(t.run).not.toHaveBeenCalled();
    t.net(true);
    expect(t.run).toHaveBeenCalledTimes(1);
  });

  it('al reanudarse la sesión sincroniza enseguida', () => {
    const t = setup();
    t.scheduler.start();
    t.run.mockClear();
    t.resume();
    expect(t.run).toHaveBeenCalledTimes(1);
  });

  it('stop quita las suscripciones y los timers', () => {
    const t = setup();
    t.scheduler.start();
    t.run.mockClear();
    t.local();
    t.scheduler.stop();
    jest.advanceTimersByTime(600_000);
    t.local();
    t.net(true);
    expect(t.run).not.toHaveBeenCalled();
  });
});
