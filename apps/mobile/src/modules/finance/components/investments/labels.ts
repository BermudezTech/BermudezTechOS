import type { CdtStatus, InterestPayment } from '../../domain/types';

export const interestPaymentLabels: Record<InterestPayment, string> = {
  AT_MATURITY: 'Al vencimiento',
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

export const cdtStatusLabels: Record<CdtStatus, string> = {
  ACTIVE: 'Activo',
  MATURED: 'Vencido',
  RENEWED: 'Renovado',
  CANCELLED: 'Cancelado',
};

/** "10.2500" → "10,25 %" */
export function formatRate(rate: string): string {
  return `${String(Number(rate)).replace('.', ',')} %`;
}
