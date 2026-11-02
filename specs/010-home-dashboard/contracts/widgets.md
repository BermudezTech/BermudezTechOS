# Contract: registro de widgets y pantalla de Inicio

## `src/modules/dashboard.ts` (nuevo)

```ts
export interface DashboardWidget {
  id: string;
  moduleId: string;
  order: number;
  span: 'full' | 'half';
  Widget: ComponentType;
}

/** Widgets de los módulos activos, ordenados por `order` y luego `id`. */
export const dashboardWidgets: DashboardWidget[];
```

- Las fuentes se declaran en un arreglo `[...financeDashboardWidgets]`; un módulo futuro agrega su arreglo aquí y no toca `index.tsx` (SC-005).
- Se filtran por `activeModules.some(m => m.id === w.moduleId)`.
- Prueba: el orden y el filtro de módulos inactivos (`dashboard.test.ts`).

## `src/modules/finance/dashboard.ts` (nuevo)

```ts
export const financeDashboardWidgets: DashboardWidget[] = [
  { id: 'finance.net-worth', moduleId: 'finance', order: 10, span: 'full', Widget: NetWorthWidget },
  { id: 'finance.month-flow', moduleId: 'finance', order: 20, span: 'half', Widget: MonthFlowWidget },
  { id: 'finance.upcoming', moduleId: 'finance', order: 30, span: 'half', Widget: UpcomingWidget },
];
```

## Pantalla `src/app/(app)/(tabs)/index.tsx`

Estructura (de arriba abajo):

1. Encabezado compacto: saludo (`greetingFor(now)`) + nombre en tono acento; a la derecha, el `IconButton` de ojo (`setAll`) con etiqueta "Mostrar/Ocultar todos los valores".
2. Aviso de descarga inicial (existente, sin cambios).
3. Cuadrícula: `flexDirection: 'row'`, `flexWrap: 'wrap'`, `gap` del tema; cada widget va a `width: '100%'`, o a `flexBasis: '48%', flexGrow: 1` si `wide && span === 'half'`.
4. `Fab` ("Registrar movimiento") → abre `QuickActionSheet`.

## Componentes nuevos (`src/modules/finance/components/home/`)

| Componente | Contenido | Accesibilidad |
|---|---|---|
| `NetWorthWidget` | `GlassCard` presionable: ícono, "Patrimonio neto", monto grande (o máscara), variación vs. mes anterior (flecha + monto con signo, color income/expense), `NetWorthChart height={120}` (oculto con los montos). Estado vacío: `EmptyState` compacto con "Crear cuenta". | `accessibilityRole="button"`, etiqueta "Patrimonio neto, ver detalle". |
| `MonthFlowWidget` | "Este mes · <mes año>", filas Ingresos y Gastos con barra proporcional (colores `income` / `expense`) y monto; separador; "Balance" con `Amount variant="auto"`. | Etiqueta resumida: "Este mes: ingresos X, gastos Y, balance Z" (o "ocultos"). |
| `UpcomingWidget` | Título "Próximos vencimientos" + `Badge` con el conteo; hasta 5 `UpcomingRow`; botón "Ver todos (N)" / "Ver menos"; estado vacío de una línea "Nada por vencer en los próximos 15 días". | Cada fila es un botón con etiqueta "<nombre>, <días>, <monto>". |
| `UpcomingRow` | `IconBadge` por tipo (tarjeta `card-outline`, CDT `trending-up-outline`, suscripción `repeat-outline`), nombre, fecha corta (`d MMM`), `daysUntilLabel` (tono `danger`/acento si es urgente), monto. | Área táctil ≥ `theme.layout.minTouchTarget`. |
| `QuickActionSheet` | `Sheet` "Registrar movimiento" con 3 `ListItem`: Gasto, Ingreso, Transferencia. | Cierra con fondo, botón cerrar y botón atrás de Android. |

Todos usan tokens de `useTheme()`; sin `BlurView` adicional fuera de `GlassCard`/`Sheet`.
