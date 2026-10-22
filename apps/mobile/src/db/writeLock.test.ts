import { migrate } from './schema';
import { createTestDb } from './testing/betterSqlite';
import { setLockedDb, withReadLock, withWriteLock } from './writeLock';

const tick = () => new Promise((r) => setTimeout(r, 1));

describe('withWriteLock', () => {
  beforeEach(async () => {
    const db = createTestDb();
    await migrate(db);
    setLockedDb(db);
  });

  it('ejecuta las tareas concurrentes una tras otra, en orden FIFO', async () => {
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`${name}:start`);
      await tick();
      log.push(`${name}:end`);
    };
    await Promise.all([withWriteLock(task('a')), withReadLock(task('b')), withWriteLock(task('c'))]);
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  });

  it('revierte las escrituras de una tarea que falla y libera el lock', async () => {
    await expect(
      withWriteLock(async (db) => {
        await db.runAsync("UPDATE sync_metadata SET pull_cursor = 'x'");
        throw new Error('falla');
      }),
    ).rejects.toThrow('falla');
    const rows = await withReadLock((db) => db.getAllAsync<{ pull_cursor: string | null }>('SELECT pull_cursor FROM sync_metadata'));
    expect(rows.every((r) => r.pull_cursor === null)).toBe(true);
  });

  it('devuelve el resultado de la tarea', async () => {
    expect(await withWriteLock(async () => 42)).toBe(42);
  });
});
