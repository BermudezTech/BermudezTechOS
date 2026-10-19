# Implementation Plan: Migración de movimientos desde la base antigua

**Branch**: `005-legacy-movements-migration` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-legacy-movements-migration/spec.md`

## Summary

Script de un solo uso en **JavaScript (Node.js 24, ESM)** en `migration/`. Lee el dump MySQL de la base antigua como texto y carga en el PostgreSQL de la API los movimientos en COP del **único usuario** existente.

- **Qué migra**: excluye CDT (ubicaciones 3 y 9) y USD (4), y fusiona Bolsillo (8) en Efectivo (1).
- **Cuentas**: crea o reutiliza 5. A la mano y Global66 quedan archivadas.
- **Transferencias**: empareja sus patas a partir de los propios movimientos y forma un `TRANSFER` por par. Descarta los pares que la fusión convierte en movimientos de una cuenta a sí misma y deja el resto como `INCOME` o `EXPENSE` según el signo.

La lógica se divide en dos partes:
- **Funciones puras**, probadas con `node:test`: parseo, mapeo, emparejamiento, invariantes y totales en centavos `BigInt`.
- **Una capa de base de datos** que trabaja en una sola transacción:
  1. toma el lock exclusivo de sincronización del usuario;
  2. resuelve las cuentas;
  3. inserta todos los movimientos con un `INSERT … SELECT FROM unnest(…) ON CONFLICT (id) DO NOTHING`;
  4. verifica los saldos en SQL;
  5. confirma solo con `--apply`. Por defecto hace simulación con `ROLLBACK`.

Los IDs son UUIDv5 deterministas, así que re-ejecutar no duplica nada. No hay cambios de esquema ni en `apps/api` ni en `apps/mobile`: los dispositivos reciben los datos por el PULL normal.

## Technical Context

**Language/Version**: JavaScript, Node.js 24 LTS (instalado: v24.14.0), módulos ES (`.mjs`).

**Primary Dependencies**:
- `pg` 8.x: cliente PostgreSQL. Devuelve `NUMERIC` como string.
- `uuid` 11.x: genera UUIDv5.

Sin transpilación ni framework de pruebas (research R10).

**Storage**: lee el dump SQL (texto, solo lectura) y escribe en PostgreSQL 17. Se usan las tablas `accounts` y `transactions` existentes, sin migraciones.

**Testing**: `node:test` + `node:assert/strict`.
- Las pruebas unitarias usan un fixture SQL pequeño versionado.
- Una prueba con las cifras esperadas usa el dump real; se omite si el dump no está, porque git lo ignora.
- La validación de punta a punta contra la base de desarrollo se describe en [quickstart.md](./quickstart.md).

**Target Platform**: la máquina del operador (desarrollo) o un contenedor `node:24-alpine` efímero en la red del compose de Coolify (producción, research R12).

**Project Type**: CLI de un solo uso (herramienta de migración de datos).

**Performance Goals**: menos de 1 minuto de punta a punta (SC-004). Son unos 1.922 registros en una sentencia `unnest` y el parseo de 400 KB.

**Constraints**:
- Atómica y idempotente (FR-009, FR-010).
- Montos exactos, nunca `Number` (Principio IV).
- Credenciales solo por variables de entorno (FR-014).
- Debe respetar el lock de sincronización por usuario (research R4).

**Scale/Scope**: 2.149 filas de origen, 1.922 registros y 5 cuentas para un único usuario.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
|---|---|---|
| **I. Offline-first** | No afecta al cliente. Los datos migrados llegan a la base local por el PULL y la UI sigue leyendo de SQLite. Los registros tienen UUID, `created_at`, `updated_at` y `deleted_at` (`is_dirty` es solo del cliente). | ✅ |
| **II. Sincronización incremental y determinista** | `server_updated_at` lo asigna la base (`clock_timestamp()`), así que los registros entran en el cursor del PULL. Los IDs son UUIDv5 deterministas, el script es idempotente y toma el lock exclusivo del usuario, tal como exige `sync/core/lock.py`. | ✅ |
| **III. Aislamiento multiusuario y seguridad** | `user_id` se asigna en el servidor al único usuario (no viene de ningún cliente). Las FKs compuestas garantizan que las cuentas son del mismo usuario. La URL de la base va en una variable de entorno. El dump queda fuera de git (`migration/.gitignore`). | ✅ |
| **IV. Precisión monetaria y temporal** | Los montos van como string hasta `NUMERIC(14,2)` y los totales en centavos `BigInt`. Todo en COP. Las fechas se guardan en UTC (medianoche de Colombia). `opening_balance = 0` y los saldos se derivan de los movimientos. | ✅ |
| **V. Modularidad y alcance controlado** | Solo finanzas, sin cambios en `apps/`. La herramienta vive fuera de `apps/` (ver Complexity Tracking). Es la solución más simple: un script y dos dependencias. | ✅ (justificado) |
| **VI. Multiplataforma liquid glass** | Sin UI. | N/A |
| **Calidad: pruebas de montos y saldos** | Hay pruebas automáticas del cálculo de saldos, el emparejamiento y los invariantes, además de la verificación de saldos en SQL antes del `COMMIT`. | ✅ |

**Re-check post-diseño (Phase 1)**: sin cambios; el diseño de [data-model.md](./data-model.md) y [contracts/cli.md](./contracts/cli.md) mantiene todos los puntos.

## Project Structure

### Documentation (this feature)

```text
specs/005-legacy-movements-migration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── cli.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migration/
├── .gitignore                      # *.sql (el dump) y node_modules/
├── package.json                    # type: module; deps pg, uuid; scripts test/migrate
├── package-lock.json
├── README.md                       # uso breve; remite a quickstart.md
├── migrate-legacy-movements.mjs    # CLI: argumentos, entorno, orquesta y resume (contracts/cli.md)
├── lib/
│   ├── parse-dump.mjs              # dump → LegacyMovement[] (R1)
│   ├── money.mjs                   # string ⇄ centavos BigInt, formato es-CO (R9)
│   ├── plan.mjs                    # mapa de ubicaciones, filtros, emparejamiento, invariantes, IDs (R2, R3)
│   └── apply.mjs                   # transacción: usuario único, lock, cuentas, unnest, verificación (R4–R6, R11)
└── test/
    ├── fixtures/sample-dump.sql    # dump mínimo: casos de cada regla y caso límite
    ├── parse-dump.test.mjs
    ├── money.test.mjs
    ├── plan.test.mjs
    └── real-dump.test.mjs          # cifras esperadas; se omite si falta el dump
```

**Structure Decision**: la herramienta va en el directorio `migration/`, que ya existe y tiene el dump y su `.gitignore`. Queda separada de `apps/`, porque no es parte de la app ni del backend desplegado. La lógica pura (`parse-dump`, `money`, `plan`) se separa de la de base de datos (`apply`) para poder probarla sin PostgreSQL.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Código fuera de `apps/mobile` y `apps/api`, en JavaScript (Principio V: monorepo con dos apps) | El usuario pidió explícitamente un script sencillo en JavaScript. Es una herramienta de un solo uso que no se despliega. | Ponerlo en `apps/api` obliga a usar Python (la pila del backend) y lo mezcla con el código desplegado. Ponerlo en `apps/mobile` lo mete en el bundle de la app. |
