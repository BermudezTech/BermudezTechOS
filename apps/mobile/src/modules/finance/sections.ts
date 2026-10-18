import type { Href } from 'expo-router';
import type { ComponentType } from 'react';

import type { IconName } from '@/components/ui/Icon';

import { MonthBalanceCard } from './components/summary/MonthBalanceCard';
import { MonthIncomeCard } from './components/summary/MonthIncomeCard';
import { MonthSpendingCard } from './components/summary/MonthSpendingCard';
import { NetWorthCard } from './components/summary/NetWorthCard';
import { RecentTransactionsCard } from './components/summary/RecentTransactionsCard';

/**
 * Secciones de Finanzas que muestra el hub (Finanzas → Resumen). Cada historia añade su
 * entrada; `summaryCards` es opcional y aparece arriba del hub.
 */
export interface FinanceSection {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  route: Href;
  /** Tarjetas de resumen; `order` < 10 son estadísticas (media columna en pantallas anchas). */
  summaryCards?: { id: string; Card: ComponentType; order: number }[];
}

export const financeSections: FinanceSection[] = [
  {
    id: 'accounts',
    label: 'Cuentas',
    description: 'Saldos, cajitas y tarjetas',
    icon: 'wallet-outline',
    route: '/finance/accounts',
  },
  {
    id: 'transactions',
    label: 'Movimientos',
    description: 'Ingresos, egresos y transferencias',
    icon: 'receipt-outline',
    route: '/finance/transactions',
    summaryCards: [
      { id: 'month-income', Card: MonthIncomeCard, order: 1 },
      { id: 'month-balance', Card: MonthBalanceCard, order: 3 },
      { id: 'recent', Card: RecentTransactionsCard, order: 10 },
    ],
  },
  {
    id: 'spending',
    label: 'Gastos por categoría',
    description: 'Mensual y anual, con evolución',
    icon: 'pie-chart-outline',
    route: '/finance/spending',
    summaryCards: [{ id: 'month-spending', Card: MonthSpendingCard, order: 2 }],
  },
  {
    id: 'net-worth',
    label: 'Patrimonio',
    description: 'Activos, pasivos y evolución',
    icon: 'analytics-outline',
    route: '/finance/net-worth',
    summaryCards: [{ id: 'net-worth', Card: NetWorthCard, order: 4 }],
  },
  {
    id: 'investments',
    label: 'Inversiones',
    description: 'CDTs, rendimientos y vencimientos',
    icon: 'trending-up-outline',
    route: '/finance/investments',
  },
  {
    id: 'subscriptions',
    label: 'Suscripciones',
    description: 'Gastos fijos y próximos cobros',
    icon: 'repeat-outline',
    route: '/finance/subscriptions',
  },
  {
    id: 'recurring-income',
    label: 'Ingresos recurrentes',
    description: 'Salario y otros ingresos fijos',
    icon: 'cash-outline',
    route: '/finance/recurring-income',
  },
  {
    id: 'reimbursements',
    label: 'Reembolsos',
    description: 'Viáticos, adelantos y dinero de terceros',
    icon: 'briefcase-outline',
    route: '/finance/reimbursements',
  },
];
