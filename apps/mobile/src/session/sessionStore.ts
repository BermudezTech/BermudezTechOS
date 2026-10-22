import { create } from 'zustand';

import type { StoredProfile } from './types';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

/** Estado de sesión en memoria (data-model §6). La guarda usa `status === 'signedIn'`, vigente o vencida. */
export interface SessionState {
  status: SessionStatus;
  /** `signedIn` con la renovación rechazada (FR-031): la app sigue usable y la sync se pausa. */
  expired: boolean;
  profile: StoredProfile | null;
}

export const useSessionStore = create<SessionState>(() => ({ status: 'loading', expired: false, profile: null }));
