import type { ComponentType } from 'react';

import { financeDashboardWidgets } from './finance/dashboard';
import { appModules, type AppModule } from './registry';

/**
 * Widget que un módulo aporta al tablero de Inicio (spec 010, contracts/widgets.md). Inicio
 * solo recorre `dashboardWidgets`: añadir un widget = añadir su entrada en el módulo dueño.
 * Vive aparte de `registry.ts` para que el menú no arrastre componentes de los módulos.
 */
export interface DashboardWidget {
  id: string;
  /** `AppModule.id` dueño; solo se muestran los de módulos activos. */
  moduleId: string;
  order: number;
  /** En pantallas anchas, `half` ocupa media columna; en móvil todo va a ancho completo. */
  span: 'full' | 'half';
  Widget: ComponentType;
}

export function buildDashboardWidgets(sources: DashboardWidget[][], modules: AppModule[]): DashboardWidget[] {
  const active = new Set(modules.filter((m) => m.status === 'active').map((m) => m.id));
  const all = sources.flat();
  const seen = new Set<string>();
  for (const w of all) {
    if (seen.has(w.id)) throw new Error(`Widget de Inicio duplicado: ${w.id}`);
    seen.add(w.id);
  }
  return all.filter((w) => active.has(w.moduleId)).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export const dashboardWidgets = buildDashboardWidgets([financeDashboardWidgets], appModules);
