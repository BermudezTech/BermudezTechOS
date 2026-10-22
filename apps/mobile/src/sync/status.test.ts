import { describeRecord, deriveSyncStatus, formatLastSync, rejectionMessage } from './status';
import type { SyncState } from './syncStore';

const base: SyncState = {
  phase: 'idle',
  connectivity: 'online',
  lastSyncedAt: null,
  initialSyncComplete: true,
  pendingCount: 0,
  rejections: [],
  lastError: null,
  clockAhead: false,
  loaded: true,
};
const rejection = { tableName: 'accounts' as const, recordId: 'a', code: 'DUPLICATE', message: '', sentUpdatedAt: null, rejectedAt: '' };

describe('deriveSyncStatus', () => {
  it('prioridad: sincronizando › sesión vencida › sin conexión › con errores › sincronizado', () => {
    const all = { ...base, phase: 'pushing' as const, connectivity: 'offline' as const, rejections: [rejection] };
    expect(deriveSyncStatus(all, { expired: true })).toBe('syncing');
    expect(deriveSyncStatus({ ...all, phase: 'idle' }, { expired: true })).toBe('expired');
    expect(deriveSyncStatus({ ...all, phase: 'idle' }, { expired: false })).toBe('offline');
    expect(deriveSyncStatus({ ...all, phase: 'idle', connectivity: 'online' }, { expired: false })).toBe('errors');
    expect(deriveSyncStatus({ ...base, lastError: { kind: 'server', message: 'x' } }, { expired: false })).toBe('errors');
    expect(deriveSyncStatus(base, { expired: false })).toBe('synced');
  });
});

describe('rejectionMessage', () => {
  it.each([
    ['VALIDATION_ERROR', 'monto', 'Datos no válidos: monto'],
    ['INVALID_REFERENCE', '', 'Hace referencia a algo que ya no existe.'],
    ['DEPENDENCY_REJECTED', '', 'Depende de otro cambio que no se pudo guardar.'],
    ['INCOHERENT', 'Un gasto solo puede usar una categoría de gasto.', 'Un gasto solo puede usar una categoría de gasto.'],
    ['DUPLICATE', '', 'Ya existe un registro igual.'],
    ['ID_CONFLICT', '', 'No se pudo guardar este registro.'],
    ['CLOCK_AHEAD', '', 'La fecha de tu dispositivo está adelantada. Revisa la fecha y hora.'],
    ['LOCAL_PARSE_ERROR', '', 'Llegó un dato del servidor con un formato inesperado.'],
  ])('%s', (code, message, expected) => {
    expect(rejectionMessage(code, message)).toBe(expected);
  });
});

describe('describeRecord', () => {
  it('nombra cada tipo de registro', () => {
    expect(describeRecord('accounts', { name: 'Nequi' })).toBe('Cuenta «Nequi»');
    expect(describeRecord('categories', { name: 'Ropa' })).toBe('Categoría «Ropa»');
    expect(describeRecord('transactions', { amount: 4_500_000, occurredAt: '2026-10-18T17:00:00.000Z' })).toBe(
      'Movimiento de $ 45.000 del 18 oct',
    );
    expect(describeRecord('cdts', { issuer: 'Bancolombia' })).toBe('CDT de «Bancolombia»');
    expect(describeRecord('assets', undefined)).toBe('Bien (ya no está en el dispositivo)');
  });
});

it('formatLastSync', () => {
  const now = new Date('2026-10-20T12:00:00.000Z');
  expect(formatLastSync(null, now)).toBe('nunca');
  expect(formatLastSync('2026-10-20T11:59:30.000Z', now)).toBe('hace un momento');
  expect(formatLastSync('2026-10-20T11:55:00.000Z', now)).toBe('hace 5 minutos');
});
