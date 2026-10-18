# Contract — Tema y tokens de diseño

Toda la UI obtiene colores, radios, espaciados, tipografía, efectos y movimiento de `useTheme()`.
Ningún componente escribe valores de color o tamaño sueltos (FR-036).

```ts
type ThemeMode = 'system' | 'light' | 'dark';

interface Theme {
  scheme: 'light' | 'dark';
  colors: {
    background: string; backgroundGradient: [string, string, string];
    surface: string;          // glass: rgba con alfa
    surfaceStrong: string;    // glass más opaco (modales, nav)
    border: string;           // borde claro semitransparente
    text: string; textMuted: string; textOnAccent: string;
    accent: string;       // relleno (botones, FAB); texto blanco encima ≥ 4.5:1
    accentText: string;   // acento para texto sobre superficies ≥ 4.5:1
    accentAlt: string;
    income: string; expense: string; transfer: string;
    warning: string; danger: string; success: string;
    categoryPalette: string[]; // colores de categorías/gráficas, válidos en ambos temas
  };
  radii: { sm: number; md: number; lg: number; xl: number; pill: number };
  spacing: (n: number) => number;          // escala de 4
  typography: { display; title; heading; body; caption; amountLarge; amount }; // fontSize, lineHeight, fontWeight
  glass: {
    blurIntensity: number;                  // usado solo por GlassSurface nivel "blur"
    surfaceOpacity: number;
    borderWidth: number;
    shadow: object;
  };
  motion: { fast: number; normal: number; spring: { damping: number; stiffness: number } };
  layout: { wideBreakpoint: 1024; maxContentWidth: number; minTouchTarget: 44 };
}
```

## Componentes base que consumen los tokens

| Componente | Responsabilidad |
|---|---|
| `GlassSurface` | `variant: 'blur' \| 'tinted'`. `blur` solo para nav, modales y FAB (R7). |
| `GlassCard` | Tarjeta con `GlassSurface tinted`, padding y radio estándar; opcionalmente presionable. |
| `ScreenBackground` | Degradado vibrante del tema detrás de cada pantalla. |
| `Amount` | Muestra `Cents` con el formateador COP, color por signo **y** signo/etiqueta textual. |
| `AppNavBar` | Menú adaptable (ver navigation.md). |
| `Fab` | Botón de acción rápida. |
| `EmptyState`, `NotFound` | Estados vacíos y de ruta inválida. |
| `SegmentedControl`, `ListItem`, `Badge`, `ProgressBar`, `FormField`, `AmountInput`, `DateInput`, `Select` | Controles comunes. |

## Reglas de accesibilidad

- Contraste de texto ≥ 4.5:1 sobre `surface` en ambos temas, incluidos los colores de montos y
  `accentText` (lo valida `src/theme/contrast.test.ts`).
- Área táctil ≥ `layout.minTouchTarget`.
- Ningún significado depende solo del color (montos negativos llevan `−` o etiqueta).
- `prefers-reduced-motion` / "reducir movimiento" desactiva animaciones no esenciales.
