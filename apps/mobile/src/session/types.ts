import type { IsoDateTime } from '@/lib/dates';

/** `bt.session` (data-model §5). Vive en almacenamiento seguro, nunca en SQLite ni en logs. */
export interface StoredSession {
  accessToken: string;
  /** UTC = recibido + `expiresIn`. */
  accessExpiresAt: IsoDateTime;
  refreshToken: string;
  /** UTC = recibido + `refreshExpiresIn` (informativo). */
  refreshExpiresAt: IsoDateTime;
}

/** `bt.profile`: el `id` identifica al dueño de los datos locales (research R12). */
export interface StoredProfile {
  id: string;
  email: string;
  displayName: string | null;
}
