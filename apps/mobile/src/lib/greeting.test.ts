import { greetingFor } from './greeting';

// Instante UTC de esa hora en Bogotá (UTC−5): el resultado no depende de la zona del runner.
const at = (h: number, m: number) => new Date(Date.UTC(2026, 9, 17, h + 5, m));

describe('greetingFor', () => {
  it.each([
    [4, 59, 'Buenas noches'],
    [5, 0, 'Buenos días'],
    [11, 59, 'Buenos días'],
    [12, 0, 'Buenas tardes'],
    [18, 59, 'Buenas tardes'],
    [19, 0, 'Buenas noches'],
  ])('%i:%i → %s', (h, m, expected) => {
    expect(greetingFor(at(h, m))).toBe(expected);
  });

  it('usa la hora de Bogotá, no la UTC', () => {
    // 23:30Z = 18:30 en Bogotá.
    expect(greetingFor(new Date('2026-10-24T23:30:00Z'))).toBe('Buenas tardes');
  });
});
