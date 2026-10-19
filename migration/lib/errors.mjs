/** Error esperado de la migración. `exitCode`: 1 = datos o invariantes, 2 = entorno (contracts/cli.md). */
export class MigrationError extends Error {
  constructor(message, { exitCode = 1, sourceId } = {}) {
    super(message);
    this.name = 'MigrationError';
    this.exitCode = exitCode;
    this.sourceId = sourceId;
  }
}
