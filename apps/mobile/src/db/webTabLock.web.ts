/**
 * Una sola pestaña activa por navegador (research R4): dos pestañas escribiendo y sincronizando
 * sobre la misma base romperían el espejo de la otra. El candado de la Web Locks API se mantiene
 * mientras la pestaña está abierta y se libera solo al cerrarla.
 */
const LOCK_NAME = 'bermudeztech-db';

let held = false;

export async function acquireTabLock(): Promise<boolean> {
  // Pide que el navegador no desaloje la base ni la sesión por falta de espacio (Edge case).
  void navigator.storage?.persist?.().catch(() => false);
  if (held) return true;
  if (!navigator.locks) return true;
  held = await new Promise<boolean>((resolve) => {
    navigator.locks
      .request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        resolve(lock !== null);
        // Sin candado termina enseguida; con candado lo retiene para siempre.
        return lock ? new Promise<never>(() => {}) : undefined;
      })
      .catch(() => resolve(true));
  });
  return held;
}
