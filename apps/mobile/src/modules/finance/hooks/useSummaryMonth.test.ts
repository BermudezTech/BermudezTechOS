import { resolveSummaryMonth, toSelection, useSummaryMonthStore } from './useSummaryMonth';

describe('resolveSummaryMonth', () => {
  it('sin selección muestra el mes en curso y no deja avanzar', () => {
    expect(resolveSummaryMonth(null, '2026-10-31', '2026-03-12')).toMatchObject({
      month: '2026-10-01',
      isCurrent: true,
      canNext: false,
      canPrev: true,
      minMonth: '2026-03-01',
    });
  });

  it('con un mes anterior permite avanzar y retroceder hasta el primer mes con datos', () => {
    expect(resolveSummaryMonth('2026-05-01', '2026-10-31', '2026-03-12')).toMatchObject({
      month: '2026-05-01',
      isCurrent: false,
      canPrev: true,
      canNext: true,
    });
    expect(resolveSummaryMonth('2026-03-01', '2026-10-31', '2026-03-12')).toMatchObject({ canPrev: false, canNext: true });
  });

  it('sin movimientos no deja moverse en ninguna dirección', () => {
    expect(resolveSummaryMonth(null, '2026-10-31', null)).toMatchObject({ canPrev: false, canNext: false });
  });

  it('acota una selección fuera de rango', () => {
    expect(resolveSummaryMonth('2025-01-01', '2026-10-31', '2026-03-12').month).toBe('2026-03-01');
    expect(resolveSummaryMonth('2027-01-01', '2026-10-31', '2026-03-12').month).toBe('2026-10-01');
  });

  it('al cambiar de mes, sin selección pasa al nuevo mes y con selección la conserva', () => {
    expect(resolveSummaryMonth(null, '2026-11-01', '2026-03-12').month).toBe('2026-11-01');
    expect(resolveSummaryMonth('2026-05-01', '2026-11-01', '2026-03-12').month).toBe('2026-05-01');
  });
});

describe('toSelection', () => {
  it('guarda el mes en curso como null y normaliza al primer día', () => {
    expect(toSelection('2026-10-15', '2026-10-31')).toBeNull();
    expect(toSelection('2026-09-15', '2026-10-31')).toBe('2026-09-01');
  });
});

describe('useSummaryMonthStore', () => {
  it('arranca sin selección (no persistido)', () => {
    expect(useSummaryMonthStore.getState().selected).toBeNull();
    useSummaryMonthStore.getState().setSelected('2026-09-01');
    expect(useSummaryMonthStore.getState().selected).toBe('2026-09-01');
    useSummaryMonthStore.getState().setSelected(null);
  });
});
