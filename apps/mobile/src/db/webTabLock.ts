/** En nativo hay una sola instancia de la app: el candado siempre se concede. */
export async function acquireTabLock(): Promise<boolean> {
  return true;
}
