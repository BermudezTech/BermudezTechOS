import {
  APP_TIME_ZONE,
  addDays,
  clampPeriod,
  clampDayToMonth,
  daysBetween,
  formatDateLocal,
  formatRelativeDay,
  isSamePeriod,
  isWithin,
  localDateTimeToUtc,
  localDayKey,
  localTimeParts,
  monthsByYear,
  periodRangeUtc,
  shiftPeriod,
  todayLocal,
  todayParts,
} from './dates';

const ZONE = APP_TIME_ZONE; // UTC−5, sin horario de verano

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

// Valores por defecto: siempre Bogotá, en cualquier zona del runner (`npm run test:tz`, FR-030).
describe('zona única America/Bogota', () => {
  afterEach(() => jest.useRealTimers());

  const at = (iso: string) => jest.useFakeTimers({ now: new Date(iso) });

  it('la zona de la app es America/Bogota', () => {
    expect(APP_TIME_ZONE).toBe('America/Bogota');
  });

  it('hoy es el día de Bogotá aunque en UTC ya sea mañana', () => {
    at('2026-10-25T04:30:00Z');
    expect(todayLocal()).toBe('2026-10-24');
    expect(todayParts()).toEqual({ year: 2026, month: 10, day: 24 });
  });

  it('a las 00:00 de Bogotá cambia el día', () => {
    at('2026-10-25T05:00:00Z');
    expect(todayLocal()).toBe('2026-10-25');
  });

  it('día y hora de un instante', () => {
    expect(localDayKey('2026-11-01T01:00:00Z')).toBe('2026-10-31');
    expect(localTimeParts('2026-10-25T04:30:00Z')).toEqual({ hours: 23, minutes: 30 });
  });

  it('cambio de año', () => {
    expect(localDayKey('2027-01-01T03:00:00Z')).toBe('2026-12-31');
  });

  it('una fecha elegida es el mismo día en Bogotá', () => {
    expect(localDateTimeToUtc('2026-03-10', 12, 0)).toBe('2026-03-10T17:00:00.000Z');
  });

  it('rangos de mes y año', () => {
    expect(periodRangeUtc({ granularity: 'MONTH', anchor: '2026-10-15' })).toEqual({
      fromUtc: '2026-10-01T05:00:00.000Z',
      toUtc: '2026-11-01T05:00:00.000Z',
    });
    expect(periodRangeUtc({ granularity: 'YEAR', anchor: '2026-06-01' })).toEqual({
      fromUtc: '2026-01-01T05:00:00.000Z',
      toUtc: '2027-01-01T05:00:00.000Z',
    });
  });

  it('muestra fecha y hora de Bogotá', () => {
    expect(formatDateLocal('2026-10-25T04:30:00Z', "d 'de' MMMM HH:mm")).toBe('24 de octubre 23:30');
    expect(formatDateLocal('2026-10-24', "d 'de' MMMM")).toBe('24 de octubre');
  });

  it('"Hoy" y "Ayer" según el día de Bogotá', () => {
    at('2026-10-25T04:30:00Z');
    expect(formatRelativeDay('2026-10-24')).toBe('Hoy');
    expect(formatRelativeDay('2026-10-23')).toBe('Ayer');
  });
});

describe('clampPeriod', () => {
  const today = '2026-10-31';
  const month = (anchor: string) => ({ granularity: 'MONTH' as const, anchor });
  const year = (anchor: string) => ({ granularity: 'YEAR' as const, anchor });

  it('deja igual un periodo dentro del rango', () => {
    expect(clampPeriod(month('2026-05-14'), '2026-01-20', today)).toEqual(month('2026-05-14'));
  });

  it('sube al mes de `min` si queda antes', () => {
    expect(clampPeriod(month('2025-03-01'), '2026-01-20', today)).toEqual(month('2026-01-01'));
  });

  it('baja al periodo en curso si queda después', () => {
    expect(clampPeriod(month('2027-02-01'), '2026-01-20', today)).toEqual(month('2026-10-01'));
    expect(clampPeriod(year('2028-01-01'), null, today)).toEqual(year('2026-01-01'));
  });

  it('sin `min` no aplica tope inferior', () => {
    expect(clampPeriod(month('2001-01-01'), null, today)).toEqual(month('2001-01-01'));
  });

  it('en modo año compara con el año de `min`', () => {
    expect(clampPeriod(year('2024-01-01'), '2025-08-03', today)).toEqual(year('2025-01-01'));
    expect(clampPeriod(year('2025-06-01'), '2025-08-03', today)).toEqual(year('2025-06-01'));
  });
});

describe('isSamePeriod', () => {
  it('compara por mes o por año, sin importar el día', () => {
    expect(isSamePeriod({ granularity: 'MONTH', anchor: '2026-10-01' }, { granularity: 'MONTH', anchor: '2026-10-31' })).toBe(true);
    expect(isSamePeriod({ granularity: 'YEAR', anchor: '2026-01-01' }, { granularity: 'YEAR', anchor: '2026-10-31' })).toBe(true);
    expect(isSamePeriod({ granularity: 'MONTH', anchor: '2026-10-01' }, { granularity: 'YEAR', anchor: '2026-10-01' })).toBe(false);
  });
});

describe('monthsByYear', () => {
  it('lista los meses del más reciente al más antiguo, agrupados por año', () => {
    expect(monthsByYear('2025-11-01', '2026-02-01')).toEqual([
      { year: 2026, months: ['2026-02-01', '2026-01-01'] },
      { year: 2025, months: ['2025-12-01', '2025-11-01'] },
    ]);
  });

  it('acepta días intermedios y un solo mes', () => {
    expect(monthsByYear('2026-10-20', '2026-10-31')).toEqual([{ year: 2026, months: ['2026-10-01'] }]);
  });

  it('devuelve vacío si `from` es posterior', () => {
    expect(monthsByYear('2026-11-01', '2026-10-01')).toEqual([]);
  });
});
