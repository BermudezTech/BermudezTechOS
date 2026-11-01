import type { SqlDatabase } from '@/db/types';

import { makeCategory } from '../../domain/testUtils';
import { ValidationError } from '../FinanceRepository';
import { createCategory, updateCategory } from './categoriesRepo';
import { useFinanceStore } from './store';
import { putCategory, setupLocalDb } from './testing';

type Row = Record<string, string | number | null>;

let db: SqlDatabase;

beforeEach(async () => {
  db = await setupLocalDb();
});

const row = (id: string) => db.getFirstAsync<Row>('SELECT * FROM categories WHERE id = ?', [id]);
const input = { name: 'Mascotas', kind: 'EXPENSE' as const, icon: 'paw-outline', color: '#8B5CF6' };

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (e) {
    return e instanceof ValidationError ? `${e.code}:${e.field ?? ''}` : String(e);
  }
}

describe('createCategory', () => {
  it('guarda en local pendiente de subir, al final de su tipo', async () => {
    putCategory(makeCategory({ id: 'existing', name: 'Transporte', kind: 'EXPENSE', sortOrder: 4 }));
    const category = await createCategory({ ...input, name: '  Mascotas ' });
    expect(category).toMatchObject({ name: 'Mascotas', kind: 'EXPENSE', icon: 'paw-outline', color: '#8B5CF6', sortOrder: 5 });
    expect(category.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await row(category.id)).toMatchObject({ is_dirty: 1, name: 'Mascotas' });
    expect(useFinanceStore.getState().categories[category.id]).toBeDefined();
  });

  it('rechaza nombres duplicados del mismo tipo sin distinguir tildes', async () => {
    await createCategory(input);
    expect(await codeOf(createCategory({ ...input, name: 'mascótas' }))).toBe('DUPLICATE_NAME:name');
    await expect(createCategory({ ...input, kind: 'INCOME' })).resolves.toMatchObject({ kind: 'INCOME' });
  });

  it('exige nombre de 1 a 50 caracteres, ícono del catálogo y color de la paleta', async () => {
    expect(await codeOf(createCategory({ ...input, name: '   ' }))).toBe('INVALID:name');
    expect(await codeOf(createCategory({ ...input, name: 'x'.repeat(51) }))).toBe('INVALID:name');
    expect(await codeOf(createCategory({ ...input, icon: 'no-existe' }))).toBe('INVALID:icon');
    expect(await codeOf(createCategory({ ...input, color: '#123456' }))).toBe('INVALID:color');
  });
});

describe('updateCategory', () => {
  it('edita nombre, ícono y color sin cambiar el tipo', async () => {
    const category = await createCategory(input);
    await db.runAsync('UPDATE categories SET is_dirty = 0');
    const updated = await updateCategory(category.id, {
      name: 'Perros',
      icon: 'heart-circle-outline',
      color: '#10B981',
      kind: 'INCOME',
    } as never);
    expect(updated).toMatchObject({ name: 'Perros', kind: 'EXPENSE', icon: 'heart-circle-outline', color: '#10B981' });
    expect(await row(category.id)).toMatchObject({ is_dirty: 1, kind: 'EXPENSE' });
  });

  it('conserva un ícono o color heredado fuera del catálogo, pero no acepta uno nuevo', async () => {
    putCategory(makeCategory({ id: 'legacy', name: 'Antigua', icon: 'cart', color: '#123456' }));
    await expect(updateCategory('legacy', { name: 'Renombrada' })).resolves.toMatchObject({ icon: 'cart', color: '#123456' });
    expect(await codeOf(updateCategory('legacy', { color: '#654321' }))).toBe('INVALID:color');
  });

  it('permite conservar su propio nombre y rechaza el de otra', async () => {
    const a = await createCategory(input);
    await createCategory({ ...input, name: 'Gimnasio' });
    await expect(updateCategory(a.id, { name: 'MASCOTAS' })).resolves.toMatchObject({ name: 'MASCOTAS' });
    expect(await codeOf(updateCategory(a.id, { name: 'gimnasio' }))).toBe('DUPLICATE_NAME:name');
  });

  it('falla si la categoría no existe', async () => {
    expect(await codeOf(updateCategory('missing', { name: 'X' }))).toBe('NOT_FOUND:id');
  });
});
