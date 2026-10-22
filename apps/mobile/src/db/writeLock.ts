import type { SqlDatabase } from './types';

/**
 * Mutex de la base local (research R3). `withTransactionAsync` no es exclusiva y
 * `withExclusiveTransactionAsync` no existe en web, así que todas las escrituras (repositorios,
 * sync, borrado) se serializan aquí, en orden FIFO.
 *
 * Reglas: el lock **nunca** se mantiene durante una petición HTTP, y no se anidan llamadas
 * (una tarea dentro del lock que vuelva a pedirlo se bloquearía para siempre).
 */
export interface DbLock {
  /** Ejecuta `task` con el lock y dentro de una transacción: o se guarda todo o nada (FR-011). */
  withWriteLock<T>(task: (db: SqlDatabase) => Promise<T>): Promise<T>;
  /** Lectura con el lock, sin transacción: un snapshot coherente frente a las escrituras. */
  withReadLock<T>(task: (db: SqlDatabase) => Promise<T>): Promise<T>;
}

/** Un lock por base. `getDb` se resuelve en cada uso, así la app puede registrar la base después. */
export function createDbLock(getDb: () => SqlDatabase): DbLock {
  let tail: Promise<void> = Promise.resolve();

  function acquire(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => (release = resolve));
    const ready = tail.then(() => release);
    tail = tail.then(() => next);
    return ready;
  }

  return {
    async withWriteLock(task) {
      const release = await acquire();
      try {
        const db = getDb();
        let result!: Awaited<ReturnType<typeof task>>;
        await db.withTransactionAsync(async () => {
          result = await task(db);
        });
        return result;
      } finally {
        release();
      }
    },
    async withReadLock(task) {
      const release = await acquire();
      try {
        return await task(getDb());
      } finally {
        release();
      }
    },
  };
}

let lockedDb: SqlDatabase | null = null;

export function setLockedDb(db: SqlDatabase | null): void {
  lockedDb = db;
}

/** Lock de la base de la app. */
export const appDbLock = createDbLock(() => {
  if (!lockedDb) throw new Error('La base local no está abierta.');
  return lockedDb;
});

export const withWriteLock = appDbLock.withWriteLock;
export const withReadLock = appDbLock.withReadLock;
