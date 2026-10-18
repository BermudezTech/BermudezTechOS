import { greetingFor } from './greeting';

const at = (h: number, m: number) => new Date(2026, 9, 17, h, m);

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
});
