/** El navegador no permite guardar datos (p. ej. modo privado o almacenamiento bloqueado). */
export class StorageUnavailableError extends Error {
  constructor() {
    super('Este navegador no permite guardar datos.');
    this.name = 'StorageUnavailableError';
  }
}
