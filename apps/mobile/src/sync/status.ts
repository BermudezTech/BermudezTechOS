import { formatDistanceStrict } from 'date-fns';
import { es } from 'date-fns/locale';

import { formatDateLocal } from '@/lib/dates';
import { cents, formatCop } from '@/lib/money';

import type { SyncState } from './syncStore';
import type { SyncTable } from './tables';

export type SyncStatus = 'syncing' | 'expired' | 'offline' | 'errors' | 'synced';

export const syncStatusLabel: Record<SyncStatus, string> = {
  syncing: 'Sincronizando…',
  expired: 'Sesión vencida',
  offline: 'Sin conexión',
  errors: 'Con errores',
  synced: 'Sincronizado',
};

/** Estado mostrado en Ajustes (FR-023, data-model §6), por orden de prioridad. */
export function deriveSyncStatus(sync: SyncState, session: { expired: boolean }): SyncStatus {
  if (sync.phase !== 'idle') return 'syncing';
  if (session.expired) return 'expired';
  if (sync.connectivity === 'offline') return 'offline';
  if (sync.rejections.length > 0 || sync.lastError) return 'errors';
  return 'synced';
}

/** Motivo comprensible de un rechazo (contracts/api-usage.md). */
export function rejectionMessage(code: string, message: string): string {
  switch (code) {
    case 'VALIDATION_ERROR':
      return `Datos no válidos: ${message}`;
    case 'INVALID_REFERENCE':
      return 'Hace referencia a algo que ya no existe.';
    case 'DEPENDENCY_REJECTED':
      return 'Depende de otro cambio que no se pudo guardar.';
    case 'INCOHERENT':
      return message;
    case 'DUPLICATE':
      return 'Ya existe un registro igual.';
    case 'CLOCK_AHEAD':
      return 'La fecha de tu dispositivo está adelantada. Revisa la fecha y hora.';
    case 'LOCAL_PARSE_ERROR':
      return 'Llegó un dato del servidor con un formato inesperado.';
    default:
      return 'No se pudo guardar este registro.';
  }
}

const tableLabel: Record<SyncTable, string> = {
  categories: 'Categoría',
  reimbursement_groups: 'Grupo de reembolso',
  assets: 'Bien',
  accounts: 'Cuenta',
  subscriptions: 'Suscripción',
  recurring_incomes: 'Ingreso recurrente',
  cdts: 'CDT',
  transactions: 'Movimiento',
};

/** Etiqueta legible de un registro rechazado, p. ej. "Cuenta «Nequi»" o "Movimiento de $ 45.000 del 18 oct". */
export function describeRecord(table: SyncTable, entity: Record<string, unknown> | undefined): string {
  const label = tableLabel[table];
  if (!entity) return `${label} (ya no está en el dispositivo)`;
  if (table === 'transactions') {
    const amount = formatCop(cents(Number(entity.amount)), { hideZeroCents: true });
    return `${label} de ${amount} del ${formatDateLocal(String(entity.occurredAt), 'd MMM')}`;
  }
  if (table === 'cdts') return `${label} de «${String(entity.issuer)}»`;
  return `${label} «${String(entity.name)}»`;
}

/** "nunca", "hace un momento" o "hace 5 minutos". */
export function formatLastSync(lastSyncedAt: string | null, now = new Date()): string {
  if (!lastSyncedAt) return 'nunca';
  const then = new Date(lastSyncedAt);
  if (now.getTime() - then.getTime() < 60_000) return 'hace un momento';
  return formatDistanceStrict(then, now, { addSuffix: true, locale: es });
}
