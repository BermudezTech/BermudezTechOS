# Quickstart: Migración de movimientos desde la base antigua

**Feature**: [spec.md](./spec.md) | **Contrato**: [contracts/cli.md](./contracts/cli.md) | **Modelo**: [data-model.md](./data-model.md)

## Requisitos

- Node.js 24 y npm.
- El dump en `migration/bermudezwebapp-17-Saturday-October-2026.sql`. Está ignorado por git (`migration/.gitignore`).
- Una base PostgreSQL con el esquema aplicado y **exactamente un usuario**, creado por la seed del primer despliegue.
- Antes de migrar, sincronizar los dispositivos y no usar la app durante la migración.

```bash
cd migration && npm install
```

## 1. Pruebas automáticas

```bash
cd migration && npm test
```

**Esperado**: pasan las pruebas del parser, el mapa, el emparejamiento y los invariantes con el fixture. Si el dump real está presente, también pasa la prueba de las cifras esperadas: 2.137 incluidos, 201 transferencias, 7 descartados, 1.922 registros y los saldos de [data-model.md §3](./data-model.md#3-entidades-intermedias-plan-de-migración-en-memoria).

## 2. Planificación sin base

```bash
node migration/migrate-legacy-movements.mjs migration/bermudezwebapp-17-Saturday-October-2026.sql --offline
```

**Esperado**: el resumen muestra 2.149 leídos y 12 excluidos por CDT. En cuentas, Efectivo 344.800,00, Nequi 6,91, Bancolombia 200.000,79, A la mano 0,00 y Global66 0,00. Termina con código 0.

## 3. Ensayo en desarrollo

```bash
docker compose up -d                     # db publicada en localhost:5433 (override)
export MIGRATION_DATABASE_URL=postgresql://bt:<clave>@localhost:5433/bermudeztech
node migration/migrate-legacy-movements.mjs migration/bermudezwebapp-17-Saturday-October-2026.sql          # simulación
node migration/migrate-legacy-movements.mjs migration/bermudezwebapp-17-Saturday-October-2026.sql --apply  # aplica
node migration/migrate-legacy-movements.mjs migration/bermudezwebapp-17-Saturday-October-2026.sql --apply  # re-ejecución
```

**Esperado**:
- **Simulación**: "se insertarían 1.922" y todos los saldos `OK`. Después, `SELECT count(*) FROM transactions` sigue igual.
- **Primer `--apply`**: 5 cuentas creadas y 1.922 insertados.
- **Segundo `--apply`**: 0 insertados, 1.922 ya existentes y saldos `OK` (SC-003).

**Comprobaciones SQL**:

```sql
SELECT name, type, is_archived FROM accounts ORDER BY sort_order;   -- 5 filas, 2 archivadas, ninguna "Bolsillo"
SELECT type, count(*) FROM transactions GROUP BY type;              -- TRANSFER 201; INCOME + EXPENSE 1721
SELECT count(*) FROM transactions WHERE amount <= 0;                -- 0
```

**Casos de error**:
- Con un segundo usuario en `users`, la ejecución termina con código 2 y no escribe nada.
- Si se fuerza un fallo (p. ej. se renombra una cuenta para duplicar el nombre), no queda ningún cambio de esa ejecución.

## 4. App

Iniciar sesión en la app (web o Android) y sincronizar. **Esperado**:
- 3 cuentas activas y 2 archivadas, con los saldos de arriba (SC-002, SC-005).
- Las transferencias aparecen como tales y no cuentan como gasto ni ingreso personal (SC-006).

## 5. Producción (Coolify)

1. Hacer un respaldo `pg_dump` de la base de producción.
2. Ejecutar el script en un contenedor efímero dentro de la red del compose. La base no publica puertos.

   ```bash
   docker run --rm -it --network <red-del-compose> \
     -v "$PWD/migration:/work" -w /work \
     -e MIGRATION_DATABASE_URL=postgresql://<usuario>:<clave>@db:5432/<base> \
     node:24-alpine sh -c "npm ci && node migrate-legacy-movements.mjs bermudezwebapp-17-Saturday-October-2026.sql"
   ```

3. Revisar el resumen de la simulación. Si es correcto, repetir con `--apply`.
4. Sincronizar la app y validar como en el paso 4.

**Alternativa**: un túnel SSH al puerto del contenedor `db`.
