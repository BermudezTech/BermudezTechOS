import type { SqlRow } from '@/db/types';
import { cents, fromMoneyString, toMoneyString } from '@/lib/money';

import { allColumns, type ColumnDef, type SyncTable } from './tables';

/** Registro del PULL que no se puede convertir exactamente; se omite y se informa (Edge case). */
export class ParseError extends Error {
  constructor(
    readonly table: SyncTable,
    readonly id: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export type WireRecord = Record<string, unknown>;

const RATE = /^\d{1,3}(\.\d{1,4})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Fila local → JSON del PUSH (research R15). Omite `server_updated_at` e `is_dirty`. */
export function toWire(table: SyncTable, row: SqlRow): WireRecord {
  const wire: WireRecord = {};
  for (const c of allColumns(table)) {
    const value = row[c.column] ?? null;
    if (value === null) wire[c.field] = null;
    else if (c.kind === 'money') wire[c.field] = toMoneyString(cents(Number(value)));
    else if (c.kind === 'bool') wire[c.field] = value === 1;
    else wire[c.field] = value;
  }
  return wire;
}

function convert(table: SyncTable, id: string | null, c: ColumnDef, value: unknown): string | number | null {
  const fail = (why: string) => new ParseError(table, id, `${table}.${c.field}: ${why}`);
  if (value === null || value === undefined) {
    if (c.nullable) return null;
    throw fail('falta el valor');
  }
  switch (c.kind) {
    case 'money':
      if (typeof value !== 'string') throw fail('el monto debe ser texto');
      try {
        return fromMoneyString(value);
      } catch {
        throw fail(`monto inválido ${JSON.stringify(value)}`);
      }
    case 'bool':
      if (typeof value !== 'boolean') throw fail('se esperaba un booleano');
      return value ? 1 : 0;
    case 'int':
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw fail('se esperaba un entero');
      return value;
    case 'rate':
      if (typeof value !== 'string' || !RATE.test(value)) throw fail(`tasa inválida ${JSON.stringify(value)}`);
      return value;
    case 'date':
      if (typeof value !== 'string' || !DATE.test(value)) throw fail('fecha inválida');
      return value;
    case 'datetime': {
      // El servidor puede omitir los milisegundos; se normaliza al formato del cliente para
      // comparar `updatedAt` y reenviar el mismo instante.
      const time = typeof value === 'string' ? Date.parse(value) : NaN;
      if (Number.isNaN(time)) throw fail('fecha y hora inválida');
      return new Date(time).toISOString();
    }
    case 'text':
      if (typeof value !== 'string') throw fail('se esperaba texto');
      return value;
  }
}

/** JSON del PULL → fila local limpia (`is_dirty = 0`) con la marca del servidor. Lanza `ParseError`. */
export function fromWire(table: SyncTable, json: unknown): SqlRow {
  if (typeof json !== 'object' || json === null) throw new ParseError(table, null, `${table}: registro inválido`);
  const record = json as WireRecord;
  const id = typeof record.id === 'string' ? record.id : null;
  const row: SqlRow = {};
  for (const c of allColumns(table)) row[c.column] = convert(table, id, c, record[c.field]);
  row.server_updated_at = typeof record.serverUpdatedAt === 'string' ? record.serverUpdatedAt : null;
  row.is_dirty = 0;
  return row;
}
