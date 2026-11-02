import type { DashboardWidget } from '../dashboard';
import { MonthFlowWidget } from './components/home/MonthFlowWidget';
import { NetWorthWidget } from './components/home/NetWorthWidget';
import { UpcomingWidget } from './components/home/UpcomingWidget';

/** Widgets de Finanzas en el tablero de Inicio (spec 010, contracts/widgets.md). */
export const financeDashboardWidgets: DashboardWidget[] = [
  { id: 'finance.net-worth', moduleId: 'finance', order: 10, span: 'full', Widget: NetWorthWidget },
  { id: 'finance.month-flow', moduleId: 'finance', order: 20, span: 'half', Widget: MonthFlowWidget },
  { id: 'finance.upcoming', moduleId: 'finance', order: 30, span: 'half', Widget: UpcomingWidget },
];
