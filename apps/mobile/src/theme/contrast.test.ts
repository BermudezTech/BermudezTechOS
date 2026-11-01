import { paletteColorLabels } from '@/modules/finance/categories/paletteLabels';

import { categoryPalette, darkTheme, lightTheme, type Theme } from './tokens';

type RGBA = [number, number, number, number];

function parse(color: string): RGBA {
  const rgba = color.match(/rgba?\(([^)]+)\)/);
  if (rgba) {
    const [r, g, b, a = '1'] = rgba[1]!.split(',').map((s) => s.trim());
    return [Number(r), Number(g), Number(b), Number(a)];
  }
  const hex = color.replace('#', '');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 1];
}

/** Superpone `top` (con alfa) sobre `bottom` opaco. */
function composite(top: RGBA, bottom: RGBA): RGBA {
  const a = top[3];
  return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
}

function luminance([r, g, b]: RGBA): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: RGBA, b: RGBA): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

describe.each([
  ['claro', lightTheme],
  ['oscuro', darkTheme],
] as [string, Theme][])('contraste del tema %s', (_, theme) => {
  // Peor caso: la superficie translúcida sobre cada color del degradado de fondo.
  const backgrounds = [theme.colors.background, ...theme.colors.backgroundGradient].map(parse);
  const surfaces = backgrounds.map((bg) => composite(parse(theme.colors.surface), bg));

  it.each(['text', 'textMuted'] as const)('%s sobre superficies ≥ 4.5:1', (key) => {
    for (const surface of surfaces) expect(contrast(parse(theme.colors[key]), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('texto blanco sobre el relleno de acento ≥ 4.5:1', () => {
    expect(contrast(parse(theme.colors.textOnAccent), parse(theme.colors.accent))).toBeGreaterThanOrEqual(4.5);
  });

  // Montos y etiquetas usan estos colores en texto normal.
  it.each(['income', 'expense', 'transfer', 'accentText', 'warning', 'danger'] as const)('%s sobre superficies ≥ 4.5:1', (key) => {
    for (const surface of surfaces) expect(contrast(parse(theme.colors[key]), surface)).toBeGreaterThanOrEqual(4.5);
  });
});

/** Colores de las categorías por defecto del servidor (apps/api/app/modules/categories/defaults.py). */
const SERVER_DEFAULT_COLORS = [
  '#06B6D4',
  '#0EA5E9',
  '#10B981',
  '#14B8A6',
  '#22C55E',
  '#6366F1',
  '#64748B',
  '#84CC16',
  '#A855F7',
  '#D946EF',
  '#EAB308',
  '#EC4899',
  '#EF4444',
  '#F59E0B',
  '#F97316',
];

describe('paleta de categorías', () => {
  it('tiene 20 colores hexadecimales únicos, todos con nombre', () => {
    expect(categoryPalette).toHaveLength(20);
    expect(new Set(categoryPalette).size).toBe(20);
    for (const color of categoryPalette) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
      expect(paletteColorLabels[color]).toBeTruthy();
    }
  });

  it('incluye los colores de las categorías por defecto', () => {
    expect(SERVER_DEFAULT_COLORS.filter((c) => !categoryPalette.includes(c))).toEqual([]);
  });

  // El color es decorativo (siempre va con el nombre); el piso evita colores casi invisibles (research R8).
  it.each([
    ['claro', lightTheme, 1.8],
    ['oscuro', darkTheme, 3],
  ] as [string, Theme, number][])('cada color sobre la superficie del tema %s ≥ %s:1', (_, theme, floor) => {
    const solid = composite(parse(theme.colors.surfaceSolid), parse(theme.colors.background));
    for (const color of categoryPalette) expect(contrast(parse(color), solid)).toBeGreaterThanOrEqual(floor);
  });
});
