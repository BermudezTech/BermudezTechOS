import { useShallow } from 'zustand/react/shallow';

import { useSessionStore } from './sessionStore';

export function useSession() {
  return useSessionStore(useShallow((s) => ({ status: s.status, expired: s.expired, profile: s.profile })));
}

/** Nombre del perfil, o su correo si no tiene nombre (US1 escenario 3). */
export function useDisplayName(): string {
  return useSessionStore((s) => s.profile?.displayName || s.profile?.email || '');
}
