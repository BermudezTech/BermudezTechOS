import type { Href } from 'expo-router';

import type { IconName } from '@/components/ui/Icon';

/**
 * Registro de módulos de la app (contracts/navigation.md). El menú y Ajustes se generan
 * desde aquí: añadir un módulo = añadir su entrada y su grupo de rutas (FR-005, SC-007).
 */
export interface AppModule {
  id: string;
  label: string;
  icon: IconName;
  /** null si status = 'coming_soon'. */
  route: Href | null;
  status: 'active' | 'coming_soon';
  /** footer = Ajustes. */
  placement: 'main' | 'footer';
}

export const appModules: AppModule[] = [
  { id: 'home', label: 'Inicio', icon: 'home-outline', route: '/', status: 'active', placement: 'main' },
  { id: 'finance', label: 'Finanzas', icon: 'wallet-outline', route: '/finance', status: 'active', placement: 'main' },
  { id: 'routines', label: 'Rutinas', icon: 'repeat-outline', route: null, status: 'coming_soon', placement: 'main' },
  { id: 'calendar', label: 'Calendario', icon: 'calendar-outline', route: null, status: 'coming_soon', placement: 'main' },
  { id: 'todo', label: 'To-do', icon: 'checkbox-outline', route: null, status: 'coming_soon', placement: 'main' },
  { id: 'habits', label: 'Hábitos', icon: 'leaf-outline', route: null, status: 'coming_soon', placement: 'main' },
  { id: 'settings', label: 'Ajustes', icon: 'settings-outline', route: '/settings', status: 'active', placement: 'footer' },
];

export const activeModules = appModules.filter((m) => m.status === 'active');
export const comingSoonModules = appModules.filter((m) => m.status === 'coming_soon');
