import { cents } from '@/lib/money';

import { cdtSummary, cdtValues, defaultMaturesOn, isMaturingSoon, sortByMaturity } from './cdts';
import { cdtFormSchema } from './schemas/cdt';
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
    expect(defaultMaturesOn('2026-01-31', 30)).toBe('2026-03-02');
    const a = makeCdt({ id: 'a', maturesOn: '2027-01-01' });
    const b = makeCdt({ id: 'b', maturesOn: '2026-11-01' });
    const c = makeCdt({ id: 'c', maturesOn: '2026-01-01', status: 'MATURED' });
    expect(sortByMaturity([a, c, b]).map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('valores de un CDT vencido: valor actual 0', () => {
    expect(cdtValues(makeCdt({ status: 'MATURED' }), [], '2026-10-17').currentValue).toBe(0);
  });
});

describe('cdtFormSchema', () => {
  const base = {
    issuer: 'Banco',
    certificateNumber: '',
    principal: '1000000',
    annualRateEa: '10,25',
    annualRateNominal: '9,8',
    termDays: '180',
    openedOn: '2026-01-01',
    maturesOn: '2026-06-30',
    interestPayment: 'AT_MATURITY' as const,
    withholdingRate: '4',
    sourceAccountId: 'acc',
    payoutAccountId: null,
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
});
