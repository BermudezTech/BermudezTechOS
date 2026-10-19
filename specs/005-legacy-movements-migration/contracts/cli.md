# Contrato: CLI `migrate-legacy-movements`

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

## Invocación

```text
node migration/migrate-legacy-movements.mjs <ruta-del-dump.sql> [--apply | --offline]
```

| Argumento | Obligatorio | Descripción |
|---|---|---|
| `<ruta-del-dump.sql>` | sí | Archivo de respaldo de la base antigua. |
| *(sin bandera)* | — | **Simulación** (por defecto): conecta, ejecuta todo dentro de una transacción y hace `ROLLBACK`. |
| `--apply` | no | Ejecuta y confirma (`COMMIT`). |
| `--offline` | no | Solo parsea y planifica; no conecta a la base. Es incompatible con `--apply`. |

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `MIGRATION_DATABASE_URL` | sí, salvo `--offline` (o `DATABASE_URL`) | URL de PostgreSQL. El prefijo `postgresql+asyncpg://` se normaliza a `postgresql://`. |
| `DATABASE_URL` | alternativa | Se usa si falta `MIGRATION_DATABASE_URL`. |

Ninguna credencial va en el código ni en argumentos visibles en el historial (FR-014).

## Salida (stdout)

Resumen legible en español con las secciones, en este orden:

1. **Modo**: `SIMULACIÓN`, `APLICADO` u `OFFLINE`.
2. **Usuario**: `email (id)`. No aparece en modo offline.
3. **Origen**: leídos; incluidos; excluidos por motivo (CDT, USD, monto cero).
4. **Transferencias**: candidatas, formadas, descartadas por fusión y patas sueltas.
5. **Cuentas**: una fila por cuenta con la acción (`crear` / `reutilizar` / `reutilizar+archivar`), número de movimientos y saldo esperado (formato `1.234.567,89`).
6. **Escritura**: movimientos insertados y ya existentes. En simulación se indica "se insertarían".
7. **Verificación**: saldo calculado en la base frente al esperado, con `OK` o `ERROR` por cuenta.

## Códigos de salida

| Código | Significado |
|---|---|
| `0` | Éxito: simulación completa, aplicado y confirmado, o planificación offline. |
| `1` | Error de validación del dump, de los invariantes o de los saldos. No se escribió nada. |
| `2` | Error de entorno: argumentos inválidos, falta la URL, falla la conexión, o no hay exactamente un usuario. No se escribió nada. |

Los errores van a **stderr** con la causa y, si aplica, el id del movimiento de origen.

## Garantías

- **Atomicidad**: todo o nada (una transacción).
- **Idempotencia**: con el mismo dump, una segunda ejecución con `--apply` informa 0 insertados y deja los saldos iguales.
- **Concurrencia**: toma el lock exclusivo de sincronización del usuario (research R4) durante la transacción.
- **Sin efectos fuera de `accounts` y `transactions`** del único usuario.
