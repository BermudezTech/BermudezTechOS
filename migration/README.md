# Migración de movimientos desde la base antigua

Script de un solo uso. Carga en la base nueva los movimientos en COP del respaldo de la base antigua (`bermudezwebapp-*.sql`) y los asigna al único usuario que existe en ella.

- **Excluye**: CDT (ubicaciones 3 y 9) y USD (4).
- **Fusiona** Bolsillo con Efectivo.
- **Cuentas**: crea o reutiliza 5. A la mano y Global66 quedan archivadas.
- **Transferencias**: empareja sus dos patas y forma un solo movimiento de transferencia.

Spec y diseño: [`specs/005-legacy-movements-migration/`](../specs/005-legacy-movements-migration/). El procedimiento completo, en desarrollo y en producción, está en su [`quickstart.md`](../specs/005-legacy-movements-migration/quickstart.md).

## Instalación y pruebas

```bash
cd migration
npm install
npm test
```

## Uso

La URL de la base va en `MIGRATION_DATABASE_URL`; si falta, se usa `DATABASE_URL`. Se acepta el prefijo `postgresql+asyncpg://` del `.env` de la API.

```bash
# Solo planifica, sin conectar a la base
node migrate-legacy-movements.mjs bermudezwebapp-17-Saturday-October-2026.sql --offline

# Simulación (por defecto): hace todo en una transacción y al final la deshace
node migrate-legacy-movements.mjs bermudezwebapp-17-Saturday-October-2026.sql

# Aplica los cambios
node migrate-legacy-movements.mjs bermudezwebapp-17-Saturday-October-2026.sql --apply
```

- **Todo o nada**: si algo falla, incluida la verificación de saldos que se hace antes de confirmar, no se guarda nada.
- **Re-ejecutar es seguro**: los IDs son deterministas, así que una segunda vez inserta 0 registros.
- **Movimientos editados después**: si se editan en la app movimientos ya migrados, una re-ejecución puede dar error de saldos. Eso es esperado, porque el script compara contra el dump.
- **Códigos de salida**: `0` éxito, `1` error de datos o de saldos, `2` error de entorno (argumentos, conexión, o no hay exactamente un usuario).

> ⚠️ **Producción**: hacer antes un `pg_dump` de la base, ejecutar primero la simulación y revisar el resumen antes de usar `--apply`.
