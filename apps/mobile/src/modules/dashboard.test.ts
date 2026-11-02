import type { AppModule } from './registry';
import { buildDashboardWidgets, type DashboardWidget } from './dashboard';

const Noop = () => null;

const modules: AppModule[] = [
  { id: 'finance', label: 'Finanzas', icon: 'wallet-outline', route: '/finance', status: 'active', placement: 'main' },
  { id: 'routines', label: 'Rutinas', icon: 'repeat-outline', route: null, status: 'coming_soon', placement: 'main' },
];

const widget = (over: Partial<DashboardWidget>): DashboardWidget => ({
  id: 'w',
  moduleId: 'finance',
  order: 0,
  span: 'full',
  Widget: Noop,
  ...over,
});

describe('buildDashboardWidgets', () => {
  it('ordena por order y desempata por id', () => {
    const result = buildDashboardWidgets(
      [[widget({ id: 'c', order: 20 }), widget({ id: 'b', order: 10 })], [widget({ id: 'a', order: 20 })]],
      modules,
    );
    expect(result.map((w) => w.id)).toEqual(['b', 'a', 'c']);
  });

  it('descarta los widgets de módulos que no están activos', () => {
    const result = buildDashboardWidgets([[widget({ id: 'fin' }), widget({ id: 'rut', moduleId: 'routines' })]], modules);
    expect(result.map((w) => w.id)).toEqual(['fin']);
  });

  it('descarta los widgets de módulos desconocidos', () => {
    expect(buildDashboardWidgets([[widget({ id: 'x', moduleId: 'nope' })]], modules)).toEqual([]);
  });

  it('falla si hay ids repetidos', () => {
    expect(() => buildDashboardWidgets([[widget({ id: 'dup' })], [widget({ id: 'dup' })]], modules)).toThrow(/dup/);
  });
});
