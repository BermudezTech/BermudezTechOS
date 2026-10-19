/**
 * Resumen legible para el operador (contracts/cli.md §Salida).
 */
import { formatCents } from './money.mjs';
import { ACCOUNTS } from './plan.mjs';

const MODES = { dry: 'SIMULACIÓN (nada se guardó)', apply: 'APLICADO', offline: 'OFFLINE (sin base)' };
const ACTIONS = { create: 'crear', reuse: 'reutilizar', 'reuse+archive': 'reutilizar+archivar' };
const n = (value) => value.toLocaleString('es-CO');

export function formatSummary({ mode, user, summary, accountActions, write, verification }) {
  const lines = [`Modo: ${MODES[mode]}`];
  if (user) lines.push(`Usuario: ${user.email} (${user.id})`);

  const { excluded } = summary;
  lines.push(
    '',
    'Origen',
    `  Leídos: ${n(summary.read)}`,
    `  Incluidos: ${n(summary.included)}`,
    `  Excluidos: CDT ${n(excluded.CDT)} · USD ${n(excluded.USD)} · monto cero ${n(excluded.ZERO_AMOUNT)}`,
    '',
    'Transferencias',
    `  Candidatas: ${n(summary.candidates)}`,
    `  Formadas: ${n(summary.transfers)}`,
    `  Descartadas por fusión Efectivo ↔ Bolsillo: ${n(summary.discardedMergedPairs)}`,
    `  Patas sueltas (quedan como ingreso o egreso): ${n(summary.looseLegs)}`,
    '',
    `Registros a migrar: ${n(summary.records)} (${n(summary.transfers)} transferencias, ${n(summary.incomes)} ingresos, ${n(summary.expenses)} egresos)`,
    '',
    'Cuentas',
  );

  const actionByKey = new Map((accountActions ?? []).map((a) => [a.key, a.action]));
  for (const account of ACCOUNTS) {
    const { count, expectedCents } = summary.perAccount[account.key];
    const action = actionByKey.has(account.key) ? `${ACTIONS[actionByKey.get(account.key)]} · ` : '';
    const archived = account.isArchived ? ' [archivada]' : '';
    lines.push(
      `  ${account.name}${archived}: ${action}${n(count)} movimientos · saldo ${formatCents(expectedCents)}`,
    );
  }

  if (write) {
    const verb = mode === 'dry' ? 'Se insertarían' : 'Insertados';
    lines.push('', 'Escritura', `  ${verb}: ${n(write.inserted)} · ya existentes: ${n(write.existing)}`);
    if (write.inserted === 0) lines.push('  Re-ejecución: 0 movimientos nuevos');
  }

  if (verification) {
    lines.push('', 'Verificación de saldos en la base');
    const names = new Map(ACCOUNTS.map((a) => [a.key, a.name]));
    for (const { key, expectedCents, actualCents, ok } of verification) {
      const detail = ok ? '' : ` (esperado ${formatCents(expectedCents)})`;
      lines.push(`  ${ok ? 'OK   ' : 'ERROR'} ${names.get(key)}: ${formatCents(actualCents)}${detail}`);
    }
  }
  return lines.join('\n');
}
