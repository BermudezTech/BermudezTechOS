import type { TextStyle, ViewStyle } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

type TypographyStyle = Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontFamily' | 'letterSpacing'>;

export interface Theme {
  scheme: Scheme;
  colors: {
    background: string;
    backgroundGradient: [string, string, string];
    surface: string;
    surfaceStrong: string;
    /** Casi opaco: hojas y menús que se superponen a contenido (legibilidad). */
    surfaceSolid: string;
    surfacePressed: string;
    border: string;
    text: string;
    textMuted: string;
    textOnAccent: string;
    /** Relleno de botones y elementos destacados (texto blanco encima). */
    accent: string;
    /** Acento para texto sobre superficies (contraste ≥ 4.5:1). */
    accentText: string;
    accentAlt: string;
    accentSoft: string;
    income: string;
    expense: string;
    transfer: string;
    warning: string;
    danger: string;
    success: string;
    overlay: string;
    categoryPalette: string[];
  };
  radii: { sm: number; md: number; lg: number; xl: number; pill: number };
  spacing: (n: number) => number;
  typography: Record<'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'amountLarge' | 'amount', TypographyStyle>;
  glass: {
    blurIntensity: number;
    borderWidth: number;
    shadow: ViewStyle;
  };
  motion: { fast: number; normal: number; spring: { damping: number; stiffness: number } };
  layout: { wideBreakpoint: number; maxContentWidth: number; minTouchTarget: number; sideNavWidth: number };
}

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

const typography: Theme['typography'] = {
  display: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 42, letterSpacing: -0.6 },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  amountLarge: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 38, letterSpacing: -0.5 },
  amount: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
};

const shared = {
  radii: { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 },
  spacing: (n: number) => n * 4,
  typography,
  motion: { fast: 150, normal: 260, spring: { damping: 18, stiffness: 180 } },
  layout: { wideBreakpoint: 1024, maxContentWidth: 1200, minTouchTarget: 44, sideNavWidth: 248 },
};

// Paleta vibrante para categorías y gráficas; legible sobre ambos temas.
const categoryPalette = [
  '#8B5CF6',
  '#06B6D4',
  '#F97316',
  '#EC4899',
  '#10B981',
  '#3B82F6',
  '#EAB308',
  '#EF4444',
  '#14B8A6',
  '#A855F7',
  '#F43F5E',
  '#84CC16',
  '#6366F1',
];

export const lightTheme: Theme = {
  ...shared,
  scheme: 'light',
  colors: {
    background: '#EEF0FF',
    backgroundGradient: ['#E9E7FF', '#FCE9F6', '#E3F7FB'],
    surface: 'rgba(255,255,255,0.62)',
    surfaceStrong: 'rgba(255,255,255,0.86)',
    surfaceSolid: 'rgba(255,255,255,0.97)',
    surfacePressed: 'rgba(255,255,255,0.4)',
    border: 'rgba(255,255,255,0.85)',
    text: '#14152E',
    textMuted: '#4A4E6E',
    textOnAccent: '#FFFFFF',
    accent: '#047857',
    accentText: '#047857',
    accentAlt: '#0891B2',
    accentSoft: 'rgba(4,120,87,0.14)',
    income: '#15803D',
    expense: '#BE123C',
    transfer: '#1D4ED8',
    warning: '#B45309',
    danger: '#B91C1C',
    success: '#15803D',
    overlay: 'rgba(20,21,46,0.35)',
    categoryPalette,
  },
  glass: {
    blurIntensity: 60,
    borderWidth: 1,
    // boxShadow (no elevation): en Android, elevation se transparenta bajo fondos translúcidos.
    shadow: { boxShadow: '0px 8px 18px rgba(6,78,59,0.12)' },
  },
};

export const darkTheme: Theme = {
  ...shared,
  scheme: 'dark',
  colors: {
    background: '#0B0B1F',
    backgroundGradient: ['#1B1446', '#0D1638', '#062430'],
    surface: 'rgba(255,255,255,0.08)',
    surfaceStrong: 'rgba(22,22,48,0.86)',
    surfaceSolid: 'rgba(22,22,48,0.97)',
    surfacePressed: 'rgba(255,255,255,0.14)',
    border: 'rgba(255,255,255,0.14)',
    text: '#F4F5FF',
    textMuted: '#B3B7D6',
    textOnAccent: '#FFFFFF',
    accent: '#047857',
    accentText: '#6EE7B7',
    accentAlt: '#22D3EE',
    accentSoft: 'rgba(52,211,153,0.22)',
    income: '#4ADE80',
    expense: '#FB7185',
    transfer: '#7DB4FF',
    warning: '#FBBF24',
    danger: '#F87171',
    success: '#4ADE80',
    overlay: 'rgba(0,0,0,0.55)',
    categoryPalette,
  },
  glass: {
    blurIntensity: 50,
    borderWidth: 1,
    shadow: { boxShadow: '0px 10px 20px rgba(0,0,0,0.35)' },
  },
};

export const themes: Record<Scheme, Theme> = { light: lightTheme, dark: darkTheme };
