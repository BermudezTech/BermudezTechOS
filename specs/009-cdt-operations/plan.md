# Implementation Plan: Operaciones de CDT

**Branch**: `009-cdt-operations` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-cdt-operations/spec.md`

## Summary

La feature completa el ciclo de vida del CDT: calcular el vencimiento en días comerciales, registrar CDTs existentes sin movimiento, dejar editable el valor final (con la tasa nominal derivada), borrar en cascada y renovar (solo renovar, agregar capital o retirar capital).

El enfoque técnico:
- Funciones puras nuevas en el cliente: `addCommercialDays` y la valoración con base 360.
- Dos operaciones atómicas nuevas en el repositorio local: `renewCdt` y `deleteCdt`. Usan IDs deterministas UUIDv5 para resolver conflictos offline.
- Cuatro columnas nuevas en `cdts`, todas montos nullable: el override del valor final y la liquidación bruto/retención/neto.
- `source_account_id` pasa a ser nullable.
- Se elimina la unicidad cuenta↔CDT, para que la cadena de renovaciones comparta la cuenta INVESTMENT.

En el servidor solo cambian el esquema, una migración y una regla de coherencia del sync.

## Technical Context

**Language/Version**: TypeScript estricto (~6.0), React Native 0.88, Expo SDK 58 (cliente) · Python 3.14, FastAPI, SQLAlchemy 2 async, Alembic (API)

**Primary Dependencies**: Expo Router, Zustand, Zod + react-hook-form, decimal.js (cliente); Pydantic v2 (API). **No se añaden dependencias.** El SHA-1 de UUIDv5 se escribe en TS puro (R6).

**Storage**:
- Cliente: Expo SQLite, migración local 2 (reconstrucción de `cdts`).
- Servidor: PostgreSQL, migración Alembic `0002_cdt_operations`.

**Testing**: Jest (`jest-expo`) para dominio, repositorio local y migración, más `npm run test:tz`. pytest para el esquema y la coherencia del sync de `cdts` y la migración.

**Target Platform**: Android (principal) y web (Expo for Web); API en Docker/Coolify.

**Project Type**: mobile-app + web-service (monorepo `apps/mobile` + `apps/api`).

**Performance Goals**: renovar y borrar son una sola transacción local, sin espera de red. Formularios con recálculo en vivo y sin retraso perceptible en Android de gama media (SC-002, SC-004 < 1 min por tarea).

**Constraints**:
- Offline-first.
- Montos en centavos enteros, con Decimal para potencias.
- Base 360.
- Fechas de calendario sin `Date` local.
- "Hoy" en America/Bogota.
- Compatibilidad con clientes viejos durante el despliegue (API primero).

**Scale/Scope**: decenas de CDTs por usuario y cadenas de pocas renovaciones. Pantallas: 2 nuevas (editar, renovar) y 3 modificadas (nuevo, detalle, lista).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-first | Crear, editar, renovar y borrar escriben solo en SQLite local con `batch` atómico. Los IDs nuevos se generan en el cliente (v4 o v5) y los registros nuevos llevan las columnas de sync. | ✅ |
| II. Sync incremental y determinista | Sin cambios al protocolo. Los registros de renovación usan **UUIDv5 determinista** (R6), así que renovar dos veces offline converge por LWW sin duplicar. Los borrados son lógicos. | ✅ |
| III. Multiusuario y seguridad | Las columnas nuevas heredan `user_id` y el filtrado por JWT. No se añaden endpoints. La coherencia de la renovación se valida con referencias del mismo usuario (`fetch_refs`). | ✅ |
| IV. Precisión monetaria y temporal | Columnas nuevas `NUMERIC(14,2)` / centavos. Cálculos en Decimal con redondeo solo al final. La liquidación cumple `bruto − retención = neto` exacto. Los saldos se derivan de transacciones y del saldo inicial de cuenta. Fechas sin dependencia del dispositivo, comprobado con `test:tz`. | ✅ |
| V. Modularidad y alcance | Solo el módulo de finanzas. No hay tabla nueva: la liquidación son columnas del periodo, la opción más simple (R9). La liquidación del CDT y los pagos periódicos quedan fuera. | ✅ |
| VI. Liquid glass multiplataforma | Se reutilizan los componentes y tokens existentes, sin capas de blur nuevas. La misma funcionalidad en Android y web. Textos en español. | ✅ |
| Flujo y calidad | La spec está clarificada (7 decisiones). Las pruebas automatizadas de cálculo y migración son obligatorias (quickstart). | ✅ |

**Post-diseño (Phase 1)**: se mantiene ✅. Hay una desviación menor que **no** viola la constitución: se elimina `uq_cdts_account_id`. Queda reemplazada por la regla de coherencia R7.

## Project Structure

### Documentation (this feature)

```text
specs/009-cdt-operations/
├── plan.md              # Este archivo
├── research.md          # Phase 0 (R1–R12)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── domain.md        # funciones de dominio y repositorio
│   ├── sync.md          # registro cdts y migraciones
│   └── ui.md            # pantallas y formularios
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/mobile/src/
├── lib/
│   ├── dates.ts                       # + addCommercialDays (R1)
│   ├── dates.commercial.test.ts       # nuevo: oráculo helpComercialDays
│   ├── ids.ts                         # + uuidV5, CDT_ID_NAMESPACE (R6)
│   └── ids.test.ts
├── db/
│   ├── schema.ts                      # + migración 2: reconstrucción de cdts (R9)
│   └── schema.test.ts
├── sync/tables.ts                     # cdts: source_account_id nullable + 4 columnas money
├── modules/finance/
│   ├── domain/
│   │   ├── types.ts                   # Cdt: campos nuevos; CdtRenewalInput; RenewalOperation
│   │   ├── cdtValuation.ts(.test)     # reescrito: base 360, nominal, settlement (R2)
│   │   ├── cdts.ts(.test)             # canRenew, cdtChain, origin, renewalPrincipal (R4, R10)
│   │   ├── netWorth.ts(.test)         # CDT vale principal (R11)
│   │   └── schemas/cdt.ts             # form de creación/edición + renovación (data-model §4)
│   ├── data/
│   │   ├── FinanceRepository.ts       # + deleteCdt, cdtDeletionPreview, renewCdt
│   │   └── local/cdtsRepo.ts(.test)   # createCdt (origen), updateCdt (R12), renewCdt (R6), deleteCdt (R8)
│   ├── hooks/useCdts.ts               # expone acciones nuevas
│   └── components/investments/
│       ├── CdtForm.tsx                # origen, valor final editable, nominal derivada
│       ├── CdtRenewalForm.tsx         # nuevo
│       ├── CdtDetailPanel.tsx         # acciones, historial, sin interés causado
│       ├── CdtListItem.tsx            # valor al vencimiento, "Listo para renovar"
│       └── labels.ts
└── app/(app)/(tabs)/finance/investments/
    ├── new.tsx
    └── [id]/{index,edit,renew}.tsx    # [id].tsx → [id]/index.tsx

apps/api/
├── alembic/versions/0002_cdt_operations.py         # nuevo (R9)
├── app/db/models/cdts.py                           # nullable, columnas, checks, sin unique
├── app/modules/sync/entities/cdts/{schemas,entity}.py   # contrato sync.md
└── tests/{unit,integration}/sync/…cdt…             # validación, coherencia y migración
```

**Structure Decision**: es el monorepo existente. La mayor parte del trabajo está en `apps/mobile` (dominio, repositorio local y UI). `apps/api` solo cambia el esquema de `cdts`, su migración y la entidad de sync.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Se elimina la restricción única `uq_cdts_account_id` | FR-020: la cadena de renovaciones comparte la cuenta INVESTMENT para tener un saldo continuo | Una cuenta por periodo duplica cuentas, exige transferir el saldo y rompe el historial. Un índice único parcial descartaría un lado del conflicto offline que los IDs deterministas ya resuelven. |
| IDs UUIDv5 en el cliente (SHA-1 propio) | Que renovar el mismo CDT en dos dispositivos no duplique interés ni periodos (principio II) | Los IDs aleatorios duplican. `expo-crypto` solo tiene digest asíncrono y no está disponible en el mock de pruebas. |
