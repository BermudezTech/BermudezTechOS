import { cents } from '@/lib/money';

import {
  canRenew,
  cdtChain,
  cdtOrigin,
  cdtSummary,
  cdtValues,
  defaultMaturesOn,
  isMaturingSoon,
  liveSuccessor,
  previousValueFromPrincipal,
  renewalPrincipal,
  sortByMaturity,
} from './cdts';
import { cdtFormSchema, cdtRenewalFormSchema } from './schemas/cdt';
import { makeCdt } from './testUtils';

describe('cdts', () => {
  it('calcula total invertido y rendimiento ponderado solo de los activos', () => {
    const summary = cdtSummary([
      makeCdt({ principal: cents(1_000_000_000), annualRateEa: '10.0000' }),
      makeCdt({ principal: cents(500_000_000), annualRateEa: '13.0000' }),
      makeCdt({ principal: cents(900_000_000), annualRateEa: '50.0000', status: 'MATURED' }),
    ]);
    expect(summary.totalInvested).toBe(1_500_000_000);
    expect(summary.weightedRate.toNumber()).toBe(11);
  });

  it('detecta vencimientos próximos (≤ 15 días)', () => {
    expect(isMaturingSoon({ status: 'ACTIVE', maturesOn: '2026-11-01' }, '2026-10-17')).toBe(true);
    expect(isMaturingSoon({ status: 'ACTIVE', maturesOn: '2026-11-02' }, '2026-10-17')).toBe(false);
    expect(isMaturingSoon({ status: 'MATURED', maturesOn: '2026-10-20' }, '2026-10-17')).toBe(false);
  });

  it('calcula la fecha de vencimiento por defecto y ordena por vencimiento', () => {
    expect(defaultMaturesOn('2026-01-31', 30)).toBe('2026-03-03');
    expect(defaultMaturesOn('2026-01-15', 90)).toBe('2026-04-15');
    const a = makeCdt({ id: 'a', maturesOn: '2027-01-01' });
    const b = makeCdt({ id: 'b', maturesOn: '2026-11-01' });
    const c = makeCdt({ id: 'c', maturesOn: '2026-01-01', status: 'MATURED' });
    expect(sortByMaturity([a, c, b]).map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('valores: valor neto al vencimiento, liquidación y días transcurridos', () => {
    const cdt = makeCdt({ principal: cents(1_000_000_000), annualRateEa: '10', termDays: 180, openedOn: '2026-01-15' });
    const values = cdtValues(cdt, [cdt], '2026-02-14');
    expect(values.maturityValue).toBe(1_046_856_494);
    expect(values.isOverridden).toBe(false);
    expect(values.settlement.net).toBe(46_856_494);
    expect(values.daysElapsed).toBe(30);
    expect(values.chain).toEqual([cdt]);
    const adjusted = makeCdt({ ...cdt, maturityValueOverride: cents(1_047_000_000) });
    expect(cdtValues(adjusted, [adjusted], '2026-02-14')).toMatchObject({ maturityValue: 1_047_000_000, isOverridden: true });
  });
});

describe('cdtOrigin', () => {
  it('distingue transferencia, existente y renovación', () => {
    expect(cdtOrigin(makeCdt({ sourceAccountId: 'acc' }))).toBe('TRANSFER');
    expect(cdtOrigin(makeCdt({ sourceAccountId: null }))).toBe('EXISTING');
    expect(cdtOrigin(makeCdt({ sourceAccountId: null, renewedFromCdtId: 'prev' }))).toBe('RENEWAL');
  });
});

describe('renovación: sucesor, disponibilidad, cadena y capital', () => {
  const a = makeCdt({ id: 'a', status: 'RENEWED', maturesOn: '2026-06-30' });
  const b = makeCdt({ id: 'b', renewedFromCdtId: 'a', openedOn: '2026-06-30', maturesOn: '2026-12-30' });
  const c = makeCdt({ id: 'c', renewedFromCdtId: 'b', openedOn: '2026-12-30', maturesOn: '2027-06-30' });

  it('liveSuccessor ignora renovaciones borradas', () => {
    expect(liveSuccessor(a, [a, b])?.id).toBe('b');
    expect(liveSuccessor(a, [a, { ...b, deletedAt: '2026-07-01T00:00:00Z' }])).toBeNull();
  });

  it('canRenew: desde el día del vencimiento (inclusive), solo ACTIVE y sin sucesor', () => {
    expect(canRenew(b, [a, b], '2026-12-29')).toBe(false);
    expect(canRenew(b, [a, b], '2026-12-30')).toBe(true);
    expect(canRenew(b, [a, b], '2027-01-15')).toBe(true);
    expect(canRenew(b, [a, b, c], '2027-01-15')).toBe(false);
    expect(canRenew(a, [a], '2027-01-15')).toBe(false);
  });

  it('cdtChain va del periodo más antiguo al actual', () => {
    expect(cdtChain(c, { a, b, c }).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(cdtChain(a, { a, b, c }).map((x) => x.id)).toEqual(['a']);
  });

  it('renewalPrincipal y previousValueFromPrincipal son inversas', () => {
    const value = cents(10_000_000_00);
    const amount = cents(1_500_000_00);
    expect(renewalPrincipal(value, 'RENEW', amount)).toBe(value);
    expect(renewalPrincipal(value, 'ADD', amount)).toBe(11_500_000_00);
    expect(renewalPrincipal(value, 'WITHDRAW', amount)).toBe(8_500_000_00);
    for (const op of ['RENEW', 'ADD', 'WITHDRAW'] as const) {
      expect(previousValueFromPrincipal(renewalPrincipal(value, op, amount), op, amount)).toBe(value);
    }
  });
});

describe('cdtFormSchema', () => {
  const base = {
    issuer: 'Banco',
    certificateNumber: '',
    principal: '1000000',
    annualRateEa: '10,25',
    termDays: '180',
    openedOn: '2026-01-01',
    maturesOn: '2026-06-30',
    interestPayment: 'AT_MATURITY' as const,
    withholdingRate: '4',
    origin: 'TRANSFER' as const,
    sourceAccountId: 'acc',
    payoutAccountId: null,
    maturityValue: '',
    maturityValueEdited: false,
  };

  it('acepta un CDT válido y normaliza las tasas', () => {
    const r = cdtFormSchema.safeParse(base);
    expect(r.success && [r.data.annualRateEa, r.data.withholdingRate]).toEqual(['10.2500', '4.00']);
  });

  it('rechaza vencimiento anterior o igual a la apertura y tasas fuera de rango', () => {
    expect(cdtFormSchema.safeParse({ ...base, maturesOn: '2026-01-01' }).error?.issues[0]?.path).toEqual(['maturesOn']);
    expect(cdtFormSchema.safeParse({ ...base, annualRateEa: '0' }).success).toBe(false);
    expect(cdtFormSchema.safeParse({ ...base, annualRateEa: '100' }).success).toBe(false);
  });

  it('origen: exige cuenta solo con transferencia y la descarta en CDT existente', () => {
    expect(cdtFormSchema.safeParse({ ...base, sourceAccountId: null }).error?.issues[0]?.path).toEqual(['sourceAccountId']);
    const existing = cdtFormSchema.safeParse({ ...base, origin: 'EXISTING', sourceAccountId: 'acc' });
    expect(existing.success && existing.data.sourceAccountId).toBeNull();
  });

  it('valor final: sin editar no hay override; editado se guarda y no puede ser menor que el capital', () => {
    const calculated = cdtFormSchema.safeParse(base);
    expect(calculated.success && calculated.data.maturityValueOverride).toBeNull();
    const edited = cdtFormSchema.safeParse({ ...base, maturityValue: '1047000', maturityValueEdited: true });
    expect(edited.success && edited.data.maturityValueOverride).toBe(104_700_000);
    const low = cdtFormSchema.safeParse({ ...base, maturityValue: '999999', maturityValueEdited: true });
    expect(low.error?.issues[0]).toMatchObject({ path: ['maturityValue'], message: 'El valor final no puede ser menor que el capital.' });
  });
});

describe('cdtRenewalFormSchema', () => {
  const base = {
    previousPrincipal: 100_000_000,
    previousMaturityValue: '1046856,49',
    operation: 'RENEW' as const,
    amount: '',
    adjustmentAccountId: null,
    principal: '1046856,49',
    annualRateEa: '9,5',
    termDays: '90',
    withholdingRate: '4',
    openedOn: '2026-07-15',
    maturesOn: '2026-10-15',
    maturityValue: '',
    maturityValueEdited: false,
    interestPayment: 'AT_MATURITY' as const,
    payoutAccountId: null,
    certificateNumber: '',
  };

  it('solo renovar no exige monto ni cuenta', () => {
    const r = cdtRenewalFormSchema.safeParse(base);
    expect(r.success && [r.data.amount, r.data.adjustmentAccountId, r.data.principal]).toEqual([null, null, 104_685_649]);
  });

  it('agregar/retirar exigen monto y cuenta; el retiro debe dejar capital', () => {
    expect(cdtRenewalFormSchema.safeParse({ ...base, operation: 'ADD' }).error?.issues.map((i) => i.path[0])).toEqual([
      'amount',
      'adjustmentAccountId',
    ]);
    const all = cdtRenewalFormSchema.safeParse({ ...base, operation: 'WITHDRAW', amount: '1046856,49', adjustmentAccountId: 'acc' });
    expect(all.error?.issues[0]?.message).toBe('El nuevo capital debe ser mayor que cero.');
  });

  it('el valor final anterior no puede ser menor que el capital anterior', () => {
    expect(cdtRenewalFormSchema.safeParse({ ...base, previousMaturityValue: '999999' }).error?.issues[0]?.path).toEqual([
      'previousMaturityValue',
    ]);
  });
});
