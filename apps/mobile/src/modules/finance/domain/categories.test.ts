import { isDuplicateCategoryName, nextSortOrder, normalizeCategoryName } from './categories';
import { makeCategory } from './testUtils';

describe('normalizeCategoryName', () => {
  it('ignora tildes, mayúsculas y espacios', () => {
    expect(normalizeCategoryName('  Mascótas ')).toBe('mascotas');
    expect(normalizeCategoryName('Otros   ingresos')).toBe('otros ingresos');
  });
});

describe('isDuplicateCategoryName', () => {
  const categories = [
    makeCategory({ id: 'a', name: 'Mascotas', kind: 'EXPENSE' }),
    makeCategory({ id: 'b', name: 'Salario', kind: 'INCOME' }),
    makeCategory({ id: 'c', name: 'Viejo', kind: 'EXPENSE', deletedAt: '2026-01-01T00:00:00.000Z' }),
  ];

  it('detecta duplicados del mismo tipo sin distinguir tildes', () => {
    expect(isDuplicateCategoryName('mascótas ', 'EXPENSE', categories)).toBe(true);
  });

  it('permite el mismo nombre en el otro tipo', () => {
    expect(isDuplicateCategoryName('Mascotas', 'INCOME', categories)).toBe(false);
  });

  it('excluye la propia categoría y las borradas', () => {
    expect(isDuplicateCategoryName('Mascotas', 'EXPENSE', categories, 'a')).toBe(false);
    expect(isDuplicateCategoryName('Viejo', 'EXPENSE', categories)).toBe(false);
  });
});

describe('nextSortOrder', () => {
  it('va al final de su tipo', () => {
    const categories = [
      makeCategory({ kind: 'EXPENSE', sortOrder: 3 }),
      makeCategory({ kind: 'EXPENSE', sortOrder: 7 }),
      makeCategory({ kind: 'INCOME', sortOrder: 9 }),
    ];
    expect(nextSortOrder('EXPENSE', categories)).toBe(8);
    expect(nextSortOrder('INCOME', [])).toBe(0);
  });
});
