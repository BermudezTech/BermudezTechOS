/**
 * Plan de migración: funciones puras, sin I/O (data-model §2 y §3).
 */
import { v5 as uuidv5 } from 'uuid';

import { MigrationError } from './errors.mjs';
import { absAmountString, parseCents } from './money.mjs';

/** Cuentas destino, en el orden de `sort_order`. */
export const ACCOUNTS = [
  { key: 'cash', name: 'Efectivo', type: 'CASH', isArchived: false, sortOrder: 0 },
  { key: 'nequi', name: 'Nequi', type: 'SAVINGS', isArchived: false, sortOrder: 1 },
  { key: 'bancolombia', name: 'Bancolombia', type: 'SAVINGS', isArchived: false, sortOrder: 2 },
  { key: 'alamano', name: 'A la mano', type: 'SAVINGS', isArchived: true, sortOrder: 3 },
  { key: 'global66', name: 'Global66', type: 'SAVINGS', isArchived: true, sortOrder: 4 },
];

/** Ubicación antigua → cuenta nueva. Bolsillo (8) se fusiona con Efectivo (1). */
export const LOCATION_TO_ACCOUNT = {
  1: 'cash',
  8: 'cash',
  2: 'nequi',
  5: 'bancolombia',
  6: 'alamano',
  7: 'global66',
};

export const EXCLUDED_LOCATIONS = { 3: 'CDT', 9: 'CDT', 4: 'USD' };

// uuidv5('https://bermudeztech.os/legacy-migration/2026-10', uuidv5.URL). No cambiar: de él
// dependen los IDs deterministas que hacen la migración idempotente (research R3).
export const NAMESPACE = '0edcf06d-0509-5f4e-b47b-0f8594fa97a8';

export const accountId = (key) => uuidv5(`account:${key}`, NAMESPACE);
export const movementId = (id) => uuidv5(`movement:${id}`, NAMESPACE);
export const transferId = (outId, inId) => uuidv5(`transfer:${outId}:${inId}`, NAMESPACE);

/** Medianoche en Colombia (UTC−5, sin horario de verano) expresada en UTC (research R7). */
export function toOccurredAt(date, sourceId) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const [year, month, day] = match ? match.slice(1).map(Number) : [];
  const parsed = match ? new Date(Date.UTC(year, month - 1, day)) : null;
  if (
    !parsed ||
    year < 1900 ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new MigrationError(`Fecha inválida "${date}"`, { sourceId });
  }
  return `${date}T05:00:00.000Z`;
}

const TRANSFER_LEG = /^transferencia (a|desde)\b/i;

/** Clasifica, empareja transferencias y calcula el resumen (research R2, R8). */
export function buildPlan(movements) {
  const excluded = { CDT: 0, USD: 0, ZERO_AMOUNT: 0 };
  const included = [];

  for (const movement of [...movements].sort((a, b) => a.id - b.id)) {
    const cents = parseCents(movement.amount);
    const reason =
      movement.cdt !== null ? 'CDT' : (EXCLUDED_LOCATIONS[movement.location] ?? null);
    if (reason) {
      excluded[reason] += 1;
      continue;
    }
    const accountKey = LOCATION_TO_ACCOUNT[movement.location];
    if (!accountKey) {
      throw new MigrationError(`Ubicación desconocida ${movement.location}`, {
        sourceId: movement.id,
      });
    }
    if (cents === 0n) {
      excluded.ZERO_AMOUNT += 1;
      continue;
    }
    included.push({
      ...movement,
      cents,
      accountKey,
      occurredAt: toOccurredAt(movement.date, movement.id),
    });
  }

  // Entradas libres por (fecha, valor absoluto), en orden de id.
  const candidates = included.filter((m) => TRANSFER_LEG.test(m.description));
  const incoming = new Map();
  for (const leg of candidates) {
    if (leg.cents <= 0n) continue;
    const key = `${leg.date}|${leg.cents}`;
    if (!incoming.has(key)) incoming.set(key, []);
    incoming.get(key).push(leg);
  }

  const paired = new Set();
  const transactions = [];
  let transfers = 0;
  let discardedMergedPairs = 0;

  for (const out of candidates) {
    if (out.cents >= 0n) continue;
    const pool = incoming.get(`${out.date}|${-out.cents}`) ?? [];
    const index = pool.findIndex((leg) => leg.location !== out.location);
    if (index === -1) continue;
    const [into] = pool.splice(index, 1);
    paired.add(out.id).add(into.id);
    if (out.accountKey === into.accountKey) {
      discardedMergedPairs += 1;
      continue;
    }
    transfers += 1;
    transactions.push({
      id: transferId(out.id, into.id),
      type: 'TRANSFER',
      accountKey: out.accountKey,
      counterAccountKey: into.accountKey,
      amount: absAmountString(out.amount),
      occurredAt: out.occurredAt,
      description: out.description,
      sourceIds: [out.id, into.id],
    });
  }

  let incomes = 0;
  let expenses = 0;
  for (const movement of included) {
    if (paired.has(movement.id)) continue;
    const type = movement.cents > 0n ? 'INCOME' : 'EXPENSE';
    if (type === 'INCOME') incomes += 1;
    else expenses += 1;
    transactions.push({
      id: movementId(movement.id),
      type,
      accountKey: movement.accountKey,
      counterAccountKey: null,
      amount: absAmountString(movement.amount),
      occurredAt: movement.occurredAt,
      description: movement.description,
      sourceIds: [movement.id],
    });
  }
  transactions.sort((a, b) => a.sourceIds[0] - b.sourceIds[0]);

  const perAccount = Object.fromEntries(
    ACCOUNTS.map(({ key }) => [key, { count: 0, expectedCents: 0n }]),
  );
  for (const movement of included) perAccount[movement.accountKey].expectedCents += movement.cents;
  for (const t of transactions) {
    perAccount[t.accountKey].count += 1;
    if (t.counterAccountKey) perAccount[t.counterAccountKey].count += 1;
  }

  const summary = {
    read: movements.length,
    included: included.length,
    excluded,
    candidates: candidates.length,
    transfers,
    discardedMergedPairs,
    looseLegs: candidates.filter((m) => !paired.has(m.id)).length,
    incomes,
    expenses,
    records: transactions.length,
    perAccount,
  };
  assertInvariants(summary);
  return { transactions, summary };
}

function assertInvariants(s) {
  const excludedTotal = s.excluded.CDT + s.excluded.USD + s.excluded.ZERO_AMOUNT;
  const unpaired = s.incomes + s.expenses;
  const checks = [
    [s.read === s.included + excludedTotal, 'leídos = incluidos + excluidos'],
    [
      s.included === 2 * s.transfers + 2 * s.discardedMergedPairs + unpaired,
      'incluidos = 2·transferencias + 2·descartados + sueltos',
    ],
    [s.records === s.transfers + unpaired, 'registros = transferencias + sueltos'],
  ];
  for (const [ok, rule] of checks) {
    if (!ok) throw new MigrationError(`Invariante incumplido: ${rule}`);
  }
}

const normalizeName = (name) => name.trim().toLocaleLowerCase('es');

/**
 * Decide por cada cuenta si se crea o se reutiliza una existente del usuario (no borrada) con el
 * mismo nombre, y si hay que archivarla (research R6). Nunca desarchiva.
 */
export function resolveAccountActions(existingRows, accounts) {
  return accounts.map((account) => {
    const matches = existingRows.filter(
      (row) => normalizeName(row.name) === normalizeName(account.name),
    );
    if (matches.length === 0) {
      return { key: account.key, id: accountId(account.key), action: 'create' };
    }
    if (matches.length > 1) {
      throw new MigrationError(
        `Cuenta ambigua: hay ${matches.length} cuentas llamadas "${account.name}"`,
      );
    }
    const [match] = matches;
    if (match.currency !== 'COP') {
      throw new MigrationError(
        `La cuenta existente "${match.name}" está en ${match.currency}, no en COP`,
      );
    }
    const action = account.isArchived && !match.is_archived ? 'reuse+archive' : 'reuse';
    return { key: account.key, id: match.id, action };
  });
}
