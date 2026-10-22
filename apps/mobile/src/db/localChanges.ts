/**
 * Bus mínimo de "hubo un cambio local": los repositorios emiten y el planificador de sync escucha,
 * sin importarse entre sí.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function emitLocalChange(): void {
  for (const listener of listeners) listener();
}

export function onLocalChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
