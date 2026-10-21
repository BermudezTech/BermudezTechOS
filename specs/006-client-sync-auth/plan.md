# Implementation Plan: Datos locales reales, sincronización e inicio de sesión en la app

**Branch**: `006-client-sync-auth` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-client-sync-auth/spec.md`

## Summary

La app deja de usar datos de prueba en memoria y pasa a una base **Expo SQLite** local (Android y web) con las ocho tablas de finanzas, `is_dirty`, `server_updated_at`, `sync_metadata` y `sync_rejections`. El store de zustand actual se conserva como **espejo en memoria** de SQLite, así que pantallas, hooks y lógica de dominio no cambian. Toda escritura va primero a SQLite (serializada con un mutex global) y luego al espejo.

Un motor de sincronización sin React ejecuta **PUSH → PULL** contra las rutas existentes de la spec 004. Se dispara por eventos (login, primer plano, reconexión, 5 s tras cambios) y cada 5 min en primer plano. El ack del PUSH compara `updated_at`, el PULL aplica LWW local, y el cursor se guarda por tabla. Para recuperar versiones del servidor (descartes) se fuerza un PULL completo de la tabla.

La sesión usa las rutas de auth de la spec 003. Los tokens se guardan en `expo-secure-store` (Android) o `localStorage` (web), con renovación single-flight y sesión "vencida" que no bloquea el uso local. Las rutas se protegen con `Stack.Protected` en grupos `(auth)` / `(app)`.

## Technical Context

**Language/Version**: TypeScript 6 (estricto), React 19.3, React Native 0.88, Expo SDK 58.

**Primary Dependencies**: existentes: expo-router, zustand, zod, decimal.js, react-hook-form, expo-crypto. **Nuevas**: `expo-sqlite`, `expo-secure-store`, `expo-network`, `expo-build-properties` (solo cleartext en desarrollo); dev: `better-sqlite3` (+ tipos) para pruebas.

**Storage**: Expo SQLite (`bermudeztech.db`; WASM en web) como fuente de verdad local; SecureStore / `localStorage` para la sesión. Servidor: PostgreSQL vía la API existente (sin cambios).

**Testing**: Jest (`jest-expo`) + `@testing-library/react-native`; motor de sync y repositorios contra SQLite real en memoria (`better-sqlite3`) y un servidor de sync falso; validación manual con [quickstart.md](./quickstart.md).

**Target Platform**: Android (development build) y web (Expo for Web, Chrome/Firefox/Safari actuales).

**Project Type**: Aplicación móvil + web (cliente de un monorepo con API).

**Performance Goals**: guardar y reflejar en < 300 ms sin red (SC-003); arranque con sesión hasta Inicio con datos en < 2 s (SC-002); primer sync de ≈ 5.000 transacciones en < 30 s (SC-006); ciclo típico (≤ 200 cambios) en < 3 s.

**Constraints**: offline-first (la UI nunca espera a la red); montos exactos (centavos enteros ↔ string decimal); `user_id` jamás en la base local; sin cambios en el backend; web requiere cabeceras COOP/COEP; una sola pestaña activa en web.

**Scale/Scope**: 1 usuario real (MVP), ≈ 5.000 transacciones/año y unas decenas de registros en las demás tablas; ~6 pantallas nuevas o modificadas; se mueve el árbol `(tabs)` a `(app)/(tabs)` sin cambiar URLs.

Sin `NEEDS CLARIFICATION`: todas las incógnitas se resolvieron en [research.md](./research.md) (R1–R18).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Verificación | Estado |
|---|---|---|
| **I. Offline-first** | La UI lee del espejo de SQLite y escribe en SQLite antes de reflejar (R2). Ninguna pantalla espera a la red. Cada registro tiene UUID del cliente, `created_at`, `updated_at`, `deleted_at` e `is_dirty` (data-model §1). Con sesión vencida o sin red, la app sigue funcionando (FR-031, R6). | ✅ |
| **II. Sync incremental y determinista** | PUSH antes que PULL (R8). LWW lo decide el servidor; localmente, FR-017 con `updatedAt` estricto. Cursor opaco del servidor, guardado por tabla solo tras PUSH completo y PULL completo de esa tabla (R8.5). Idempotente: upsert por id y ack condicionado (R8). Solo el primer sync (o un reset explícito, R9) descarga la tabla completa. | ✅ (ver nota R9) |
| **III. Aislamiento y seguridad** | Sin `user_id` en SQLite; el dueño de los datos vive en el perfil de la sesión (R12). Tokens en SecureStore/`localStorage`, nunca en SQLite ni logs (R5). Al cerrar sesión se vacía la base local (R13). Access corto + refresh rotado (R6). | ✅ |
| **IV. Precisión monetaria y temporal** | Centavos enteros en SQLite (`INTEGER`), conversión por texto a string decimal en la API (R15), tasas como string. UTC en almacenamiento. Saldos derivados (sin cambios). Pruebas con valores que fallan en float. | ✅ |
| **V. Modularidad y alcance** | Solo finanzas. Los módulos futuros añadidos bajo `(app)/` quedan privados por defecto (FR-039). `@/db`, `@/api`, `@/session` y `@/sync` son transversales; añadir una tabla es registrarla en el mapa de columnas y el de dependencias. Sin cambios de backend. | ✅ |
| **VI. Multiplataforma liquid glass** | SQLite en web verificado con un spike antes de migrar pantallas (R1, quickstart §0). Pantallas nuevas con los componentes y tokens existentes. Las tareas de sync no bloquean el hilo de UI (async, sin animaciones nuevas). | ✅ |
| **Flujo y calidad** | Spec y clarificaciones aprobadas; pruebas automatizadas para la lógica de sync y de montos (R16). | ✅ |

**Nota R9**: forzar un PULL completo de una tabla tras un `DISCARDED` o un descarte manual no contradice "solo el primer sync descarga todo": es puntual, por tabla, y evita cambiar el backend. Se registra en Complexity Tracking por transparencia.

**Re-check post-diseño (Phase 1)**: data-model, contratos y quickstart mantienen todos los puntos anteriores. No se introducen violaciones nuevas. ✅

## Project Structure

### Documentation (this feature)

```text
specs/006-client-sync-auth/
├── plan.md              # Este archivo
├── research.md          # Phase 0 (R1–R18)
├── data-model.md        # Phase 1: esquema SQLite, sesión y estados
├── quickstart.md        # Phase 1: validación de punta a punta
├── contracts/
│   ├── api-usage.md      # Cómo responde la app a cada ruta de auth/sync
│   ├── navigation.md     # Rutas públicas/privadas y reglas de la guarda
│   └── client-modules.md # Interfaces de @/db, @/api, @/session, @/sync y repositorios
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/mobile/
├── app.json / app.config.ts       # plugins: expo-sqlite, expo-secure-store, expo-build-properties (dev); cabeceras COOP/COEP
├── metro.config.js                # NUEVO: wasm + cabeceras COOP/COEP en el dev server (R1)
├── .env.example                   # NUEVO: EXPO_PUBLIC_API_URL
└── src/
    ├── app/
    │   ├── _layout.tsx            # Arranque: fuentes, lock web, sesión, base, hidratación; Stack.Protected
    │   ├── +not-found.tsx
    │   ├── (auth)/                # NUEVO: login, forgot-password, verify-code, reset-password
    │   └── (app)/                 # NUEVO grupo privado
    │       ├── _layout.tsx        # syncScheduler + aviso de sesión vencida
    │       ├── reauth.tsx
    │       └── (tabs)/            # MOVIDO desde src/app/(tabs); index y settings modificados
    ├── api/                       # NUEVO: apiClient, errores, renovación single-flight
    ├── db/                        # NUEVO: openLocalDb, migraciones, withWriteLock, wipeLocalData, webTabLock
    ├── session/                   # mockUser.ts ELIMINADO; NUEVO: sessionStore, signIn/signOut, recuperación, tokenStorage(.web).ts, hooks
    ├── sync/                      # NUEVO: tables (mapa de columnas y dependencias), mappers, syncEngine, syncScheduler, rejections, syncStore, hooks
    ├── lib/
    │   ├── ids.ts                 # sin seededId
    │   └── money.ts               # + toMoneyString / fromMoneyString (por texto)
    └── modules/finance/
        ├── data/
        │   ├── FinanceRepository.ts
        │   ├── local/             # RENOMBRADO desde inMemory/: store (espejo, sin seedMode), repos sobre SQLite, hydrate
        │   └── mock/              # ELIMINADO
        └── hooks/                 # useMockData.ts ELIMINADO; el resto sin cambios de contrato
```

Pruebas junto al código (`*.test.ts`), como hoy: `src/sync/*.test.ts`, `src/db/*.test.ts`, `src/api/*.test.ts`, `src/session/*.test.ts`, `src/modules/finance/data/local/*.test.ts`. Adaptador de pruebas `src/db/testing/betterSqlite.ts`.

**Structure Decision**: todo el trabajo está en `apps/mobile`; `apps/api` no cambia. Las capas transversales (`api`, `db`, `session`, `sync`) quedan fuera de `modules/finance` porque las usarán los módulos futuros. El grupo `(app)` hace que cualquier ruta nueva sea privada por defecto.

## Orden de implementación sugerido

1. **Spike SQLite web** (R1, quickstart §0). Si falla, se detiene y se revisa el plan.
2. `@/db` (migraciones, lock, adaptador de pruebas) + mappers y mapa de tablas (`@/sync/tables`).
3. Repositorios sobre SQLite + hidratación; eliminar datos de prueba. La app funciona offline sin login todavía (temporalmente).
4. `@/api` + `@/session` + rutas `(auth)`/`(app)` y guarda.
5. Motor de sync + planificador + estado.
6. Ajustes (perfil, sync, rechazos, cerrar sesión), reauth y recuperación de contraseña.
7. Quickstart completo en Android y web.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| PULL completo puntual de una tabla tras `DISCARDED` o "Descartar mi cambio" (R9) | La app necesita la versión actual del servidor de un registro que no volverá a llegar con el cursor vigente. | Una ruta "traer por ID" exige cambiar el backend (fuera de alcance). Guardar una copia por registro de la versión del servidor duplica la base. |
| Espejo en memoria de SQLite (R2) además de la base | Mantiene sin cambios ~40 pantallas, hooks y pruebas que leen el store síncronamente. | Reescribir todos los hooks a consultas async multiplicaría el alcance y el riesgo sin beneficio con el volumen del MVP. |
| Mutex de escritura en JS (R3) | `withTransactionAsync` no es exclusiva y `withExclusiveTransactionAsync` no existe en web; FR-011 exige atomicidad. | Usar transacciones distintas por plataforma duplica el camino crítico y deja web sin garantía. |
