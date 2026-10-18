# Implementation Plan: Interfaz de la app (shell, dashboard y módulo de finanzas) con datos de prueba

**Branch**: `001-finance-ui-mockup` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-finance-ui-mockup/spec.md`

## Summary

Crear `apps/mobile`: una app Expo + TypeScript con Expo Router que funciona en Android y web. Tiene
un menú adaptable (barra inferior en teléfono, barra lateral desde 1024 px) generado desde un
registro de módulos, un Inicio que solo saluda y la sección Finanzas completa del MVP (cuentas,
movimientos, gasto por categoría, patrimonio, CDTs, suscripciones y reembolsos). Los datos son de
prueba, en memoria (store Zustand detrás de un contrato `FinanceRepository`), y los valores
derivados se calculan con funciones puras del dominio sobre montos en centavos enteros. La estética
*liquid glass* sale de un sistema de tokens con modo claro y oscuro; el blur real se limita a las
superficies flotantes para mantener la fluidez en Android. Detalle de decisiones en
[research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript (`strict: true`) sobre React Native 0.88 con Expo SDK 58
(Nueva Arquitectura)

**Primary Dependencies**: expo-router, react-native-reanimated, react-native-gesture-handler,
react-native-safe-area-context, expo-blur, expo-linear-gradient, expo-font, @expo/vector-icons,
expo-crypto, zustand, react-hook-form, zod, decimal.js, date-fns + @date-fns/tz,
react-native-gifted-charts + react-native-svg, react-native-web

**Storage**: N/A — datos de prueba en memoria; se reinician al recargar (FR-032). Sin SQLite en
esta fase.

**Testing**: Jest (`jest-expo`) + React Native Testing Library; ESLint (`eslint-config-expo`) y
`tsc --noEmit`

**Target Platform**: Android 10+ (objetivo principal) y navegadores web modernos (Chrome, Firefox,
Edge, Safari recientes)

**Project Type**: Aplicación móvil multiplataforma (mobile + web) dentro de un monorepo

**Performance Goals**: transiciones y animaciones fluidas (~60 fps, sin caídas sostenidas por
debajo de ~50 fps) en Android de gama media; listas de ~300 movimientos con desplazamiento fluido

**Constraints**: offline (sin red); como máximo 2 capas de blur visibles a la vez en Android; montos
exactos al centavo; anchos de 360–1920 px sin desbordes; interfaz en español

**Scale/Scope**: 1 usuario de prueba; unas 25 rutas (ver
[contracts/navigation.md](./contracts/navigation.md)); 8 entidades; ~300 movimientos de seed en
13 meses

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Verificación | Estado |
|---|---|---|
| I. Offline-first | La UI lee y escribe solo en estado local; no hay llamadas de red. Las entidades llevan `id` UUID de cliente, `createdAt`, `updatedAt` y `deletedAt` (borrado lógico). `isDirty` se pospone porque no hay sync (se documenta en data-model). | ✅ |
| II. Sincronización | Fuera de alcance. El modelo conserva la forma de `docs/db-finanzas.md` y el contrato del repositorio devuelve `Promise`, así que la sync podrá añadirse sin rediseño. | ✅ N/A |
| III. Multiusuario y seguridad | No hay `user_id` en el cliente, ni secretos ni tokens. Hay un único usuario de prueba y no existe autenticación. | ✅ |
| IV. Precisión monetaria y temporal | Montos en centavos enteros (`Cents`) con aritmética centralizada y `decimal.js` para tasas; moneda `COP` en cuentas; saldos derivados, nunca almacenados; fechas en UTC y mostradas en zona local. | ✅ |
| V. Modularidad y alcance | Solo el módulo de finanzas; los demás son entradas "Próximamente" del registro de módulos. La estructura es `apps/mobile` (`apps/api` no se crea en esta feature). Las dependencias se justifican en research. | ✅ |
| VI. Multiplataforma liquid glass | Mismas rutas en Android y web; tokens centralizados con modo claro y oscuro; blur limitado a nav, modales y FAB; animaciones con Reanimated. La verificación de SQLite en web se pospone a la feature de datos. | ✅ |
| Flujo y calidad | Hay spec aprobada y este plan. Las pruebas automatizadas de `lib/money` y del dominio de saldos son obligatorias (sync N/A). | ✅ |

**Resultado (pre-research)**: PASA, sin violaciones.
**Resultado (post-design)**: PASA. El diseño de Phase 1 (data-model, contratos, quickstart) no
introduce violaciones; la única desviación consciente (sin `isDirty`) se debe a que esta fase no
tiene sincronización, y se añadirá con la capa de datos.

## Project Structure

### Documentation (this feature)

```text
specs/001-finance-ui-mockup/
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── finance-repository.md
│   ├── navigation.md
│   └── theme-tokens.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/mobile/
├── app/                                  # Rutas (Expo Router)
│   ├── _layout.tsx                       # Providers: tema, gestos, safe area, fuentes
│   ├── +not-found.tsx
│   └── (tabs)/
│       ├── _layout.tsx                   # Tabs con AppNavBar adaptable
│       ├── index.tsx                     # Inicio (saludo)
│       ├── settings.tsx
│       └── finance/
│           ├── _layout.tsx               # Stack de finanzas + FAB
│           ├── index.tsx                 # Resumen (hub)
│           ├── accounts/{index,[id],new}.tsx, accounts/[id]/edit.tsx
│           ├── transactions/{index,[id],new}.tsx, transactions/[id]/edit.tsx
│           ├── spending/{index,[categoryId]}.tsx
│           ├── net-worth/index.tsx, net-worth/assets/{new}.tsx, net-worth/assets/[id]/edit.tsx
│           ├── investments/{index,[id],new}.tsx
│           ├── subscriptions/{index,new}.tsx, subscriptions/[id]/edit.tsx
│           └── reimbursements/{index,[id],new}.tsx
├── src/
│   ├── theme/                            # tokens, ThemeProvider, useTheme
│   ├── components/ui/                    # GlassSurface, GlassCard, Amount, AppNavBar, Fab, controles
│   ├── lib/
│   │   ├── money.ts                      # Cents: parse, format, abbreviate, aritmética
│   │   ├── dates.ts                      # UTC ↔ local, periodos, último día del mes
│   │   └── ids.ts
│   └── modules/
│       ├── registry.ts                   # AppModule[]
│       └── finance/
│           ├── domain/                   # tipos, esquemas zod, cálculos puros (balances, spending,
│           │                             #   netWorth, cdt, subscriptions, reimbursements)
│           ├── data/
│           │   ├── FinanceRepository.ts  # contrato
│           │   ├── inMemory/             # store Zustand + implementación
│           │   └── mock/seed.ts          # seed relativo a hoy (full | empty)
│           ├── hooks/                    # useAccounts, useTransactions, ...
│           └── components/               # TransactionForm, AccountCard, CategoryDonut, ...
├── __tests__/ (o *.test.ts junto al código)
│   ├── lib/money.test.ts, lib/dates.test.ts
│   └── modules/finance/domain/*.test.ts, components/TransactionForm.test.tsx
├── app.json, package.json, tsconfig.json, babel.config.js, jest.config.js, eslint.config.js
```

**Structure Decision**: monorepo con `apps/mobile`, como establecen `CLAUDE.md` y la constitución
(Principio V). Solo se crea `apps/mobile`; `apps/api` llegará con la feature de backend. Las rutas
(`app/`) son delgadas: componen hooks y componentes de `src/modules/finance`, de modo que la lógica
y los datos queden fuera del enrutador y se puedan probar sin UI.

## Decisiones abiertas

- **Contenido de Finanzas → Resumen**: el plan asume un hub con el resumen que antes estaba en el
  dashboard (saldo disponible, patrimonio, gasto del mes y últimos movimientos) más los accesos a
  las subsecciones (research R13). Si se prefiere otra cosa, ajustar la spec (FR-004) antes de
  `/speckit-tasks`.

## Notas de implementación (ajustes respecto al plan)

Decisiones tomadas durante `/speckit-implement` al trabajar con las versiones reales:

- **Expo SDK 58** (React Native 0.88, React 19.3, Reanimated 4, Jest 30). El template de
  `create-expo-app` ubica las rutas en **`apps/mobile/src/app/`** (no en `apps/mobile/app/`); el
  resto del código vive en `apps/mobile/src/`. `tasks.md` se actualizó con esas rutas.
- **Menú adaptable** con las pestañas *headless* de `expo-router/ui` (`Tabs`/`TabSlot`/`TabTrigger`)
  en lugar de `Tabs` + `tabBar` (R2): permite dibujar la barra inferior o la lateral manteniendo la
  pantalla montada al redimensionar.
- **Blur en Android**: `expo-blur` exige `BlurTargetView` + `blurMethod`. El blur real se aplica solo a
  la barra inferior (una capa); FAB, hojas y modales usan superficies translúcidas sólidas (R7).
- **Contraste**: se añadió el token `accentText` (acento para texto, ≥ 4.5:1) separado de `accent`
  (relleno de botones, texto blanco ≥ 4.5:1). Lo verifica `src/theme/contrast.test.ts`.
- **Formularios en modal** (`new`/`edit`) ocultan la barra inferior y el FAB; el botón atrás usa
  `dismiss` y, sin historial (enlace directo o recarga en web), vuelve a la sección.
- **Pruebas de componentes**: Reanimated y los íconos se simulan en `jest.setup.tsx`; RNTL 14 usa
  `render`/`fireEvent` asíncronos.
- **Formato**: Prettier (`npm run format`) con `printWidth` 140.

## Complexity Tracking

No aplica: el Constitution Check no tiene violaciones.
