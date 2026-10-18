import {
  addDays,
  clampDayToMonth,
  daysBetween,
  formatRelativeDay,
  isWithin,
  localDateTimeToUtc,
  localDayKey,
  periodRangeUtc,
  shiftPeriod,
} from './dates';

const ZONE = 'America/Bogota'; // UTC−5, sin horario de verano

describe('periodRangeUtc', () => {
  it('calcula el rango de un mes en la zona local', () => {
    expect(periodRangeUtc({ granularity: 'MONTH', anchor: '2026-10-17' }, ZONE)).toEqual({
      fromUtc: '2026-10-01T05:00:00.000Z',
      toUtc: '2026-11-01T05:00:00.000Z',
    });
  });

  it('calcula el rango de un año', () => {
    expect(periodRangeUtc({ granularity: 'YEAR', anchor: '2026-06-01' }, ZONE)).toEqual({
      fromUtc: '2026-01-01T05:00:00.000Z',
      toUtc: '2027-01-01T05:00:00.000Z',
    });
  });

  it('un movimiento a las 23:30 local pertenece al día local, no al UTC', () => {
    const occurredAt = localDateTimeToUtc('2026-10-31', 23, 30, ZONE);
    expect(occurredAt).toBe('2026-11-01T04:30:00.000Z');
    expect(localDayKey(occurredAt, ZONE)).toBe('2026-10-31');
    expect(isWithin(occurredAt, periodRangeUtc({ granularity: 'MONTH', anchor: '2026-10-01' }, ZONE))).toBe(true);
  });
});

describe('fechas puras', () => {
  it('ajusta el día al último del mes', () => {
    expect(clampDayToMonth(2026, 2, 31)).toBe(28);
    expect(clampDayToMonth(2028, 2, 31)).toBe(29);
    expect(clampDayToMonth(2026, 4, 31)).toBe(30);
    expect(clampDayToMonth(2026, 1, 15)).toBe(15);
  });

  it('suma días y calcula diferencias', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-01-01', '2026-07-01')).toBe(181);
  });

  it('desplaza periodos', () => {
    expect(shiftPeriod({ granularity: 'MONTH', anchor: '2026-01-15' }, -1)).toEqual({
      granularity: 'MONTH',
      anchor: '2025-12-01',
    });
    expect(shiftPeriod({ granularity: 'YEAR', anchor: '2026-05-01' }, 1).anchor).toBe('2027-01-01');
  });

  it('nombra días relativos', () => {
    expect(formatRelativeDay('2026-10-17', '2026-10-17')).toBe('Hoy');
    expect(formatRelativeDay('2026-10-16', '2026-10-17')).toBe('Ayer');
    expect(formatRelativeDay('2026-10-12', '2026-10-17')).toBe('Lunes 12 de octubre');
  });
});
