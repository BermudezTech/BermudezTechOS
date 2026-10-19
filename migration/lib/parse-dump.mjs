/**
 * Lee las filas de `movements` del dump MySQL como texto, sin ejecutar SQL (research R1).
 * Cada fila ocupa una línea; ninguna descripción del dump trae comillas escapadas.
 */
import { MigrationError } from './errors.mjs';

const PREFIX = 'INSERT INTO movements ';
const ROW =
  /^INSERT INTO movements \(.*?\) VALUES \('(\d+)', '(.*)', '(-?\d+\.\d{2})', '([0-9-]{10})', '(\d+)', (NULL|\d+)\);\s*$/;

export function parseMovements(sqlText) {
  const movements = [];
  sqlText.split(/\r?\n/).forEach((line, index) => {
    if (!line.startsWith(PREFIX)) return;
    const match = ROW.exec(line);
    if (!match) {
      throw new MigrationError(`Fila de movements con formato inesperado en la línea ${index + 1}`);
    }
    const [, id, description, amount, date, location, cdt] = match;
    movements.push({
      id: Number(id),
      description,
      amount,
      date,
      location: Number(location),
      cdt: cdt === 'NULL' ? null : Number(cdt),
    });
  });
  return movements;
}
