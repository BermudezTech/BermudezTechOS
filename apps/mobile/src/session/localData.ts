import { isLocalDbOpen, openLocalDb } from '@/db/openLocalDb';
import { wipeLocalData } from '@/db/wipe';
import { clearMirror, hydrate, isHydrated } from '@/modules/finance/data/local/store';
import { resetSyncStore } from '@/sync/syncStore';
import { SYNC_TABLES } from '@/sync/tables';

/**
 * Abre la base local y carga el espejo si aún no está cargado. Idempotente: lo llaman el
 * arranque (sesión guardada) y el layout privado (justo después de iniciar sesión).
 */
export async function ensureLocalData(): Promise<void> {
  const db = await openLocalDb();
  if (!isHydrated()) await hydrate(db);
}

/** Borra los datos locales de la cuenta (cerrar sesión o entrar con otra cuenta). */
export async function resetLocalData(): Promise<void> {
  if (isLocalDbOpen()) await wipeLocalData();
  else {
    await openLocalDb();
    await wipeLocalData();
  }
  clearMirror();
  resetSyncStore();
}

/** Filas en las 8 tablas: decide si la base local tiene dueño que proteger (FR-032). */
export async function localRowCount(): Promise<number> {
  const db = await openLocalDb();
  const union = SYNC_TABLES.map((t) => `SELECT COUNT(*) AS n FROM ${t}`).join(' UNION ALL ');
  return (await db.getFirstAsync<{ n: number }>(`SELECT SUM(n) AS n FROM (${union})`))?.n ?? 0;
}
