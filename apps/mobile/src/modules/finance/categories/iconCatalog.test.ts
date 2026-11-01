import { isIconName } from '@/components/ui/iconGlyphs';

import { ICON_CATALOG, ICON_GROUPS } from './iconCatalog';
import { searchIcons } from './searchIcons';

/** Íconos de las categorías por defecto del servidor (apps/api/app/modules/categories/defaults.py). */
const SERVER_DEFAULT_ICONS = [
  'car-outline',
  'restaurant-outline',
  'film-outline',
  'repeat-outline',
  'flash-outline',
  'cart-outline',
  'speedometer-outline',
  'location-outline',
  'medkit-outline',
  'barbell-outline',
  'airplane-outline',
  'shirt-outline',
  'briefcase-outline',
  'trending-up-outline',
  'cash-outline',
];

describe('catálogo de íconos', () => {
  it('solo usa nombres que existen en Ionicons', () => {
    expect(ICON_CATALOG.filter((i) => !isIconName(i.name)).map((i) => i.name)).toEqual([]);
  });

  it('no repite íconos', () => {
    const names = ICON_CATALOG.map((i) => i.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it('tiene al menos 80 íconos y al menos 4 por grupo', () => {
    expect(ICON_CATALOG.length).toBeGreaterThanOrEqual(80);
    for (const group of ICON_GROUPS) expect(ICON_CATALOG.filter((i) => i.group === group.id).length).toBeGreaterThanOrEqual(4);
  });

  it('incluye los íconos de las categorías por defecto', () => {
    const names = new Set<string>(ICON_CATALOG.map((i) => i.name));
    expect(SERVER_DEFAULT_ICONS.filter((n) => !names.has(n))).toEqual([]);
  });

  it('las palabras clave están en minúsculas y sin tildes', () => {
    for (const entry of ICON_CATALOG) for (const k of entry.keywords) expect(k).toBe(k.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
  });
});

describe('searchIcons', () => {
  it.each(['mercado', 'gasolina', 'salario', 'arriendo', 'mascota', 'médico', 'colegio', 'regalo', 'café', 'bus'])(
    'encuentra resultados para "%s"',
    (query) => {
      expect(searchIcons(query).length).toBeGreaterThan(0);
    },
  );

  it('no distingue tildes ni mayúsculas', () => {
    expect(searchIcons('Médico')).toEqual(searchIcons('medico'));
    expect(searchIcons('  CAFÉ ')).toEqual(searchIcons('cafe'));
  });

  it('sin consulta devuelve todo el catálogo', () => {
    expect(searchIcons('')).toHaveLength(ICON_CATALOG.length);
  });

  it('sin coincidencias devuelve vacío', () => {
    expect(searchIcons('zzzz')).toEqual([]);
  });
});
