import { addCommercialDays, addDays } from './dates';

// Oráculo: función del usuario copiada TAL CUAL (spec 009, FR-001); solo se añadieron tipos `any` y el `;` final.
// prettier-ignore
const helpComercialDays = (fechaInicial: any, dias: any) => {
    // fechaInicial en formato "yyyy-mm-dd" debe ser convertida a yyyy,mm,dd
    let fecha = fechaInicial.split("-");
    let fechaYear = parseInt(fecha[0]);
    let fechaMonth = parseInt(fecha[1]);
    let fechaDay = parseInt(fecha[2]);
    // declaración de función que trae los días de un mes
    let diasEnUnMes = (month: any, year: any) => new Date(year, month, 0).getDate();
    // variable días adicionales (contiene la diferencia entre 30 y los días del mes)
    let diasAdicionales: any[] = [];
    for(let i = 1; i <= 24; i++){
        diasAdicionales.push((diasEnUnMes(i, fechaYear)-30));
    }
    // calcular el número de meses
    let meses = dias / 30;
    let adicional = 0;

    for(let i = (fechaMonth - 1); i <= ((meses + fechaMonth - 2)); i++){
        adicional = adicional + diasAdicionales[i];
    }

    //suma de la fecha actual + dias + adicionales
    let fechaSum = new Date(fechaYear, (fechaMonth - 1), fechaDay);
    fechaSum.setDate(fechaSum.getDate() + parseInt(parseInt(dias) + parseInt(adicional as any) as any));

    // separa la fecha para volverla al formato especificado
    // agrega el 0 cuando el número es menor a 10
    let fecha2Day = fechaSum.getDate() < 10 ? `0${fechaSum.getDate()}`: fechaSum.getDate();
    let fecha2Month = (fechaSum.getMonth() + 1) < 10 ? `0${fechaSum.getMonth() + 1}`:fechaSum.getMonth() + 1;
    let fecha2Year = fechaSum.getFullYear();
    return `${fecha2Year}-${fecha2Month}-${fecha2Day}`;
};

describe('addCommercialDays', () => {
  it.each([
    ['2026-01-15', 90, '2026-04-15'],
    ['2026-11-01', 180, '2027-05-01'],
    ['2026-02-10', 360, '2027-02-10'],
    ['2026-01-15', 45, '2026-03-02'],
    ['2026-12-15', 30, '2027-01-15'],
    ['2028-01-15', 60, '2028-03-15'],
    ['2026-01-31', 30, '2026-03-03'],
    ['2026-03-31', 30, '2026-05-01'],
  ])('%s + %i días → %s (tabla de FR-001)', (openedOn, days, expected) => {
    expect(addCommercialDays(openedOn, days)).toBe(expected);
  });

  it('coincide con helpComercialDays en 2024–2030 (todas las aperturas × plazos típicos)', () => {
    const mismatches: string[] = [];
    for (let day = '2024-01-01'; day <= '2030-12-31'; day = addDays(day, 1)) {
      for (const term of [1, 15, 29, 30, 31, 45, 59, 60, 61, 90, 91, 120, 180, 270, 360]) {
        const expected = helpComercialDays(day, term);
        const actual = addCommercialDays(day, term);
        if (actual !== expected) mismatches.push(`${day}+${term}: ${actual} ≠ ${expected}`);
      }
    }
    expect(mismatches.slice(0, 10)).toEqual([]);
  });

  it('coincide con helpComercialDays para todo plazo de 1 a 360 días en aperturas de inicio, mitad y fin de mes', () => {
    const mismatches: string[] = [];
    for (let day = '2024-01-01'; day <= '2030-12-31'; day = addDays(day, 1)) {
      if (!['01', '15', '28', '29', '30', '31'].includes(day.slice(8))) continue;
      for (let term = 1; term <= 360; term++) {
        const expected = helpComercialDays(day, term);
        const actual = addCommercialDays(day, term);
        if (actual !== expected) mismatches.push(`${day}+${term}: ${actual} ≠ ${expected}`);
      }
    }
    expect(mismatches.slice(0, 10)).toEqual([]);
  });

  it('plazos múltiplos de 30 hasta 3650 días caen el mismo día m meses después', () => {
    for (const openedOn of ['2026-01-15', '2027-06-28', '2028-02-10', '2029-11-05']) {
      const [y, m, d] = openedOn.split('-').map(Number) as [number, number, number];
      for (let months = 1; months <= 121; months++) {
        const total = m - 1 + months;
        const expected = `${y + Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        expect(addCommercialDays(openedOn, months * 30)).toBe(expected);
      }
    }
  });

  it('suma días calendario si el plazo es menor de 30', () => {
    expect(addCommercialDays('2026-02-20', 15)).toBe('2026-03-07');
  });
});
