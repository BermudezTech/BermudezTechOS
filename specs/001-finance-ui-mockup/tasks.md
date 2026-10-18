---

description: "Tareas para implementar 001-finance-ui-mockup"
---

# Tasks: Interfaz de la app (shell, dashboard y módulo de finanzas) con datos de prueba

**Input**: Design documents from `/specs/001-finance-ui-mockup/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: incluidas solo donde la constitución las exige ("La lógica de cálculo de montos/saldos …
MUST tener pruebas automatizadas") y lo que fija research R12: pruebas unitarias de `lib/money`,
`lib/dates` y de cada función de dominio, más la prueba del formulario de movimiento. No hay pruebas
E2E.

**Organization**: tareas agrupadas por historia de usuario (US1–US8 de la spec).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1…US8)

## Path Conventions

- Todo el código vive en `apps/mobile/`. Las rutas de abajo son relativas a la raíz del repo.
- Rutas (Expo Router) en `apps/mobile/src/app/` (convención del template de Expo SDK 58); resto del código en `apps/mobile/src/` (alias `@/` → `src/`).
- Las pruebas van junto al archivo probado (`*.test.ts` / `*.test.tsx`).
- Identificadores en inglés; textos de UI en español.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: crear el proyecto `apps/mobile` y sus herramientas.

- [X] T001 Crear la app Expo en `apps/mobile` con `npx create-expo-app@latest apps/mobile --template default` (TypeScript + Expo Router), borrar las pantallas y componentes de ejemplo (`app/(tabs)/*`, `components/`, `hooks/`, `constants/` del template) y configurar `apps/mobile/app.json`: `name: "BermudezTechOS"`, `slug: "bermudeztechos"`, `scheme: "bermudeztechos"`, `userInterfaceStyle: "automatic"`, `web.output: "single"`, `web.bundler: "metro"`, Nueva Arquitectura activada.
- [X] T002 Instalar dependencias en `apps/mobile/package.json` con `npx expo install`: `react-native-reanimated react-native-gesture-handler react-native-safe-area-context react-native-screens expo-blur expo-linear-gradient expo-font @expo-google-fonts/inter @expo/vector-icons expo-crypto react-native-svg react-native-web react-dom @react-native-community/datetimepicker` y con `npm i`: `zustand react-hook-form @hookform/resolvers zod decimal.js date-fns @date-fns/tz react-native-gifted-charts`; dev: `jest jest-expo @testing-library/react-native @types/jest`. Añadir scripts `"test": "jest"`, `"lint": "expo lint"`, `"typecheck": "tsc --noEmit"`.
- [X] T003 [P] Configurar `apps/mobile/tsconfig.json`: `extends: "expo/tsconfig.base"`, `strict: true`, `noUncheckedIndexedAccess: true`, `paths: { "@/*": ["./src/*"] }`.
- [X] T004 [P] Configurar ESLint en `apps/mobile/eslint.config.js` con `eslint-config-expo` (flat config) y regla `no-restricted-imports` que prohíba importar `@/modules/finance/data/mock/*` y `@/modules/finance/data/inMemory/store` desde `src/app/**` (contrato finance-repository, regla 1).
- [X] T005 [P] Configurar Jest en `apps/mobile/jest.config.js` (`preset: "jest-expo"`, `moduleNameMapper` para `@/`, `transformIgnorePatterns` de jest-expo) y `apps/mobile/jest.setup.ts` (mock de Reanimated y de `expo-crypto` con un `randomUUID` determinista).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: utilidades de montos y fechas, tema, componentes base, navegación, tipos, seed y store.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta terminar esta fase.

### Montos, fechas e IDs

- [X] T006 [P] Implementar `apps/mobile/src/lib/money.ts` según research R5/R6: tipo `Cents = number & { __brand: 'Cents' }`; `cents(n)` (valida `Number.isSafeInteger`); `add`, `sub`, `sum`, `negate`, `abs`, `isNegative`, `compare` (cada resultado validado con `Number.isSafeInteger`, si no lanza `RangeError`); `parseAmount(input: string)`, que acepta `,` o `.` como separador decimal y **rechaza** vacío, no numérico, más de 2 decimales y valores > `99999999999999` centavos, devolviendo `{ ok: true, value: Cents } | { ok: false, code: 'AMOUNT_INVALID' }`; `formatCop(c, { hideZeroCents?, signDisplay? })` → `"$ 1.234.567,89"`, negativos con `"−$ 1.234,56"` (signo U+2212); `abbreviateCop(c)` → `"1,2 M"`, `"350 mil"`, `"2,5 mil M"`; `fromDecimal(d: Decimal)` redondeando half-up a centavos y `toDecimal(c)`. Ninguna otra parte del código hace aritmética directa sobre `Cents`.
- [X] T007 [P] Pruebas de `apps/mobile/src/lib/money.test.ts`: `0.1 + 0.2` en centavos = `30`; formato de `0`, `5`, `123456`, `99999999999999`, negativos; `hideZeroCents`; abreviaciones; `parseAmount` con `"25000,50"`, `"25000.5"`, `"0"`, `"-5"`, `"10,555"`, `""`, `"abc"`, `"1e3"` y el límite superior; `fromDecimal` con `.005` → half-up.
- [X] T008 [P] Implementar `apps/mobile/src/lib/dates.ts` con date-fns v4 + locale `es` + `@date-fns/tz`: tipos `IsoDateTime` e `IsoDate`; `nowUtc()`, `todayLocal()`, `deviceTimeZone()`; `formatDateLocal(iso, pattern)` y `formatRelativeDay(iso)` ("Hoy", "Ayer", "lunes 13 de octubre"); `periodRangeUtc({ granularity: 'MONTH' | 'YEAR', anchor })` → `{ fromUtc, toUtc }` según la zona local; `shiftPeriod(period, ±n)`; `addDays(isoDate, n)`; `clampDayToMonth(year, month, day)` (31 → último día del mes); `daysBetween(a, b)`; `localDayKey(isoDateTime)`.
- [X] T009 [P] Pruebas de `apps/mobile/src/lib/dates.test.ts`: rangos de mes y año en `America/Bogota`, movimiento a las 23:30 local que en UTC cae en el día siguiente, `clampDayToMonth(2026, 2, 31)` = 28, años bisiestos, `shiftPeriod`.
- [X] T010 [P] Implementar `apps/mobile/src/lib/ids.ts`: `newId()` con `Crypto.randomUUID()` de `expo-crypto`, y `seededId(n: number)`, que genera un UUID v4 válido y determinista a partir de un contador (para el seed).

### Tema y componentes base

- [X] T011 [P] Definir los tokens claro y oscuro en `apps/mobile/src/theme/tokens.ts` exactamente con la forma `Theme` de `specs/001-finance-ui-mockup/contracts/theme-tokens.md`: colores vibrantes con `surface`/`surfaceStrong` en rgba translúcido, `categoryPalette` de ≥ 13 colores, `radii`, `spacing(n) = 4n`, `typography` con fuente Inter, `glass`, `motion` y `layout: { wideBreakpoint: 1024, maxContentWidth: 1200, minTouchTarget: 44 }`. Contraste del texto ≥ 4.5:1 sobre `surface` en ambos temas.
- [X] T012 Implementar `apps/mobile/src/theme/ThemeProvider.tsx` y `apps/mobile/src/theme/index.ts`: contexto con `themeMode: 'system' | 'light' | 'dark'` (en memoria), `setThemeMode`, resolución con `useColorScheme()` y hook `useTheme()` que devuelve `Theme`; incluir `useReducedMotion()` de Reanimated en el contexto.
- [X] T013 [P] Implementar `apps/mobile/src/components/ui/GlassSurface.tsx` (`variant: 'blur' | 'tinted'`; en web aplica `backdropFilter: blur(…)` vía estilo web; en Android `variant="blur"` usa `BlurView` de `expo-blur` con el método experimental de blur de Android; `tinted` = fondo `surface` + borde `border` + sombra `glass.shadow`, sin blur) y `apps/mobile/src/components/ui/ScreenBackground.tsx` (degradado `backgroundGradient` con `expo-linear-gradient`).
- [X] T014 [P] Implementar `apps/mobile/src/components/ui/Screen.tsx`: contenedor con `ScreenBackground`, safe area, `ScrollView` opcional, ancho máximo `layout.maxContentWidth` centrado en pantallas anchas y padding lateral de 16 px.
- [X] T015 [P] Implementar componentes de presentación en `apps/mobile/src/components/ui/`: `GlassCard.tsx` (presionable opcional, `accessibilityRole="button"` si `onPress`), `ListItem.tsx` (título y subtítulo con `numberOfLines={1}` + elipsis), `Badge.tsx`, `ProgressBar.tsx`, `SegmentedControl.tsx`, `EmptyState.tsx` (ícono, mensaje, acción), `NotFound.tsx` (mensaje y botón "Ir a Finanzas"), `SectionHeader.tsx`. Todos con área táctil ≥ 44×44 y etiquetas accesibles.
- [X] T016 [P] Implementar `apps/mobile/src/components/ui/Amount.tsx`: recibe `Cents`, `variant: 'default' | 'income' | 'expense' | 'debt'`, `abbreviated?`; usa `formatCop`/`abbreviateCop`; el color depende del signo **y** siempre muestra el signo `−` o la etiqueta; `accessibilityLabel` con el valor completo; `adjustsFontSizeToFit` para montos grandes.
- [X] T017 [P] Implementar controles de formulario en `apps/mobile/src/components/ui/form/`: `FormField.tsx` (etiqueta + error), `AmountInput.tsx` (`keyboardType="decimal-pad"`, prefijo `$`, entrega el string crudo para `parseAmount`), `DateInput.tsx` (web: `<input type="date">`; Android: `@react-native-community/datetimepicker`), `Select.tsx` (modal/hoja con lista de opciones e ícono), `TextField.tsx`, `Switch.tsx`. Todos compatibles con `Controller` de react-hook-form.

### Navegación y módulos

- [X] T018 [P] Crear `apps/mobile/src/modules/registry.ts` con `AppModule` y el contenido exacto de la tabla de `specs/001-finance-ui-mockup/contracts/navigation.md` (`home`, `finance`, `routines`, `calendar`, `todo`, `habits` como `coming_soon` con `route: null`, y `settings` con `placement: 'footer'`).
- [X] T019 Implementar `apps/mobile/src/components/ui/AppNavBar.tsx` (recibe las props de `tabBar` de React Navigation y lee `registry.ts`): con ancho < `wideBreakpoint` es una barra inferior con `GlassSurface variant="blur"` y los módulos `active`, más el botón "Más", que abre una hoja con los `coming_soon` y la etiqueta "Próximamente" sin navegar; con ancho ≥ `wideBreakpoint` es una barra lateral con todos los módulos, los `coming_soon` atenuados con `accessibilityState={{ disabled: true }}`. Cambia de forma con `useWindowDimensions()` sin desmontar el navegador.
- [X] T020 Crear `apps/mobile/src/app/_layout.tsx` (carga Inter con `expo-font`, `GestureHandlerRootView`, `SafeAreaProvider`, `ThemeProvider`, `Stack` sin encabezado) y `apps/mobile/src/app/+not-found.tsx` (usa `NotFound`).
- [X] T021 Crear `apps/mobile/src/app/(tabs)/_layout.tsx` con `Tabs` de Expo Router, `tabBar={(p) => <AppNavBar {...p} />}`, `tabBarPosition` `'left'` si el ancho ≥ 1024 y `'bottom'` si no, y pantallas `index`, `finance` y `settings` (títulos en español). Crear marcadores mínimos `apps/mobile/src/app/(tabs)/index.tsx`, `apps/mobile/src/app/(tabs)/settings.tsx` y `apps/mobile/src/app/(tabs)/finance/index.tsx` con `Screen` vacío, para que la app arranque.

### Dominio, seed y store

- [X] T022 [P] Definir todos los tipos en `apps/mobile/src/modules/finance/domain/types.ts` según `specs/001-finance-ui-mockup/data-model.md`: `SyncFields { id; createdAt; updatedAt; deletedAt: IsoDateTime | null }`; `Account` (`type: 'CHECKING' | 'SAVINGS' | 'CASH' | 'CREDIT_CARD' | 'POCKET' | 'INVESTMENT'`, `nature: 'ASSET' | 'LIABILITY'`, `currency: 'COP'`…), `Category` (`kind: 'INCOME' | 'EXPENSE'`), `Transaction` (`type: 'INCOME' | 'EXPENSE' | 'TRANSFER'`, `categorySource: 'MANUAL' | 'AI'`…), `Subscription` (`billingCycle: 'MONTHLY' | 'YEARLY'`, `status: 'ACTIVE' | 'PAUSED' | 'CANCELLED'`), `ReimbursementGroup` (`kind: 'REIMBURSEMENT' | 'ADVANCE'`, `status: 'OPEN' | 'SUBMITTED' | 'SETTLED'`), `Cdt` (`interestPayment: 'AT_MATURITY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL'`, `status: 'ACTIVE' | 'MATURED' | 'RENEWED' | 'CANCELLED'`, tasas como `string` decimal) y `Asset`. Sin `userId`. Incluir los tipos `*Input` (sin `SyncFields`) de cada entidad.
- [X] T023 [P] Crear `apps/mobile/src/session/mockUser.ts` con `MockUser { displayName: string }` y el usuario de prueba (p. ej. `displayName: "Alex"`, editable en ese archivo).
- [X] T024 [P] Definir el contrato en `apps/mobile/src/modules/finance/data/FinanceRepository.ts`: tipos `TransactionFilter`, `Period`, códigos de error (`REQUIRED`, `AMOUNT_INVALID`, `SAME_ACCOUNT`, `CATEGORY_KIND_MISMATCH`, `HAS_DEPENDENCIES`, `GROUP_NOT_BALANCED`, `INVALID_TRANSITION`, `NOT_FOUND`), la clase `ValidationError { field?: string; code }` y la interfaz `FinanceRepository` con las firmas de escritura de `specs/001-finance-ui-mockup/contracts/finance-repository.md` (todas devuelven `Promise`).
- [X] T025 Implementar el seed en `apps/mobile/src/modules/finance/data/mock/seed.ts`: `buildSeed(mode: 'full' | 'empty', today: IsoDate)`, determinista (PRNG mulberry32 con semilla fija + `seededId`) y con fechas relativas a `today`. En modo `full` cumple exactamente "Requisitos del seed" de `data-model.md`: 1 corriente, 2 ahorros (una con 2 cajitas `POCKET`), 1 efectivo, 2 tarjetas de crédito con `creditLimit`/`statementDay`/`paymentDueDay`, 1 cuenta con `isExcludedFromNetWorth`, 1 archivada y 2 `INVESTMENT`; las 13 categorías de `data-model.md`; ~300 movimientos en 13 meses con salario mensual, gastos variados, transferencias, pagos de tarjeta (`TRANSFER` ahorros → tarjeta), ≥ 3 con `categorySource: 'AI'` y algunos con `categoryId: null`; 2 CDTs `ACTIVE` (uno vence en ≤ 15 días) y 1 `MATURED`, con su transferencia de apertura; 4 suscripciones (3 mensuales, una `PAUSED`, 1 anual, una con `billingDay: 31`) con sus débitos (`subscriptionPeriod` `YYYY-MM`); grupos `REIMBURSEMENT` abierto con saldo negativo, `ADVANCE` abierto con saldo positivo y uno `SETTLED` en 0; 2 bienes, uno con `validUntil` vencido. Todas las fechas en UTC ISO-8601 y todos los montos en `Cents`. En modo `empty` todo vacío salvo las categorías.
- [X] T026 Implementar el store en `apps/mobile/src/modules/finance/data/inMemory/store.ts` con Zustand: estado `{ accounts, categories, transactions, subscriptions, reimbursementGroups, cdts, assets }` como `Record<string, T>`, inicializado con `buildSeed('full', todayLocal())`. Helpers internos `insert(entity, input)` (asigna `newId()`, `createdAt`, `updatedAt` = `nowUtc()`, `deletedAt: null`), `patch(entity, id, partial)` (actualiza `updatedAt`; `NOT_FOUND` si no existe o está borrado) y `softDelete(entity, id)` (fija `deletedAt`), y `resetMockData(mode)`. Selectores `selectActive(entity)` que excluyen `deletedAt`.
- [X] T027 [P] Implementar el cálculo de saldos en `apps/mobile/src/modules/finance/domain/balances.ts`: `accountBalance(account, transactions)` = `openingBalance + ΣINCOME − ΣEXPENSE − ΣTRANSFER(sale) + ΣTRANSFER(entra)` sobre transacciones no borradas, para una `LIABILITY` `debt = −saldo` donde `openingBalance` es deuda inicial (documentar el signo en el archivo), y `balancesByAccount(accounts, transactions)` con un solo recorrido O(n) (memoizable). Solo usa `@/lib/money`.
- [X] T028 [P] Implementar la valoración de CDT en `apps/mobile/src/modules/finance/domain/cdtValuation.ts` con decimal.js: `accruedInterest(cdt, today)` = `principal × ((1 + EA)^(díasTranscurridos/365) − 1)` (días acotados a `termDays`); `totalInterest(cdt)`; `expectedNetAtMaturity(cdt)` = `principal + interésTotal × (1 − retención)`; `currentValue(cdt, paidInterest, today)` = `principal + interés causado − intereses ya pagados`. Todo redondeado a centavos con `fromDecimal` una sola vez al final.
- [X] T029 [P] Pruebas en `apps/mobile/src/modules/finance/domain/balances.test.ts` y `apps/mobile/src/modules/finance/domain/cdtValuation.test.ts`: cuenta con ingresos, egresos y transferencias en ambos sentidos; transacción borrada ignorada; tarjeta con compras y pago; CDT de 10.000.000 al 10,25 % E.A. a 180 días (interés causado a 0, 90 y 180 días, neto con 4 % de retención) contra valores calculados a mano.
- [X] T030 [P] Prueba en `apps/mobile/src/modules/finance/data/mock/seed.test.ts`: con `today` fijo, `buildSeed('full')` cumple cada punto de "Requisitos del seed" (conteos por tipo, `counterAccountId` presente si y solo si `TRANSFER` y distinto de `accountId`, `POCKET` ⇔ `parentAccountId`, montos > 0 y enteros seguros, un CDT con vencimiento ≤ 15 días, un bien vencido) y dos llamadas con el mismo `today` producen datos idénticos.

**Checkpoint**: la app arranca en Android y web con menú, marcadores y tema; `npm test` pasa.

---

## Phase 3: User Story 1 - Navegar la app y ver el dashboard principal (Priority: P1) 🎯 MVP

**Goal**: Inicio con solo un saludo, menú adaptable con módulos "Próximamente", hub de Finanzas y Ajustes con tema y restablecimiento de datos.

**Independent Test**: escenarios 1–5 de [quickstart.md](./quickstart.md): saludo en Inicio, menú en Android y web, alternancia barra inferior/lateral al redimensionar y cambio de tema.

- [X] T031 [P] [US1] Implementar `apps/mobile/src/lib/greeting.ts`: `greetingFor(date: Date)` → `"Buenos días"` (05:00–11:59), `"Buenas tardes"` (12:00–18:59), `"Buenas noches"` (resto), en hora local; y la prueba `apps/mobile/src/lib/greeting.test.ts` con los bordes 04:59, 05:00, 11:59, 12:00, 18:59, 19:00.
- [X] T032 [US1] Implementar Inicio en `apps/mobile/src/app/(tabs)/index.tsx`: `Screen` con el saludo `"{greetingFor(now)}, {mockUser.displayName}"` en tipografía `display`, con una animación de entrada (fade/slide de Reanimated, desactivada con *reduced motion*). **Sin** widgets, indicadores ni datos financieros (FR-007, FR-008).
- [X] T033 [P] [US1] Crear el registro de secciones de Finanzas en `apps/mobile/src/modules/finance/sections.ts`: `FinanceSection { id; label; icon; route; SummaryCard?: React.ComponentType }` y `financeSections: FinanceSection[]`, que empieza vacío y al que cada historia añade su entrada en este orden: Cuentas, Movimientos, Gastos por categoría, Patrimonio, Inversiones, Suscripciones, Reembolsos.
- [X] T034 [US1] Crear el stack de Finanzas en `apps/mobile/src/app/(tabs)/finance/_layout.tsx`: `Stack` con encabezado glass (`GlassSurface variant="blur"`), botón atrás, títulos en español y `presentation: 'modal'` para las rutas que terminan en `new` o `edit` (ver `contracts/navigation.md`).
- [X] T035 [US1] Implementar el hub en `apps/mobile/src/app/(tabs)/finance/index.tsx` (título "Finanzas"): primero la columna o rejilla de `SummaryCard` de las secciones que la tienen (rejilla de 2 columnas si el ancho ≥ 1024) y después la lista de accesos (`GlassCard` + `ListItem`) a cada `financeSections[i].route`; `EmptyState` si no hay secciones.
- [X] T036 [US1] Implementar Ajustes en `apps/mobile/src/app/(tabs)/settings.tsx`: `SegmentedControl` "Sistema / Claro / Oscuro" enlazado a `setThemeMode`; el nombre del usuario de prueba; la lista de módulos del registro con su estado ("Activo" / "Próximamente"); y la acción "Restablecer datos de prueba", con confirmación y dos opciones, "Datos completos" (`resetMockData('full')`) y "Sin datos" (`resetMockData('empty')`) (FR-039).

**Checkpoint**: US1 funciona y se puede demostrar sola.

---

## Phase 4: User Story 2 - Consultar cuentas, subcuentas y tarjetas (Priority: P1)

**Goal**: lista de cuentas por activos y pasivos, detalle con cajitas y saldo disponible, detalle de tarjeta y formulario de cuenta.

**Independent Test**: escenarios 6–7 de quickstart: saldos de la cuenta con cajitas y métricas de tarjeta contra el seed; crear una cuenta y verla en la lista.

- [X] T037 [P] [US2] Crear el esquema zod `apps/mobile/src/modules/finance/domain/schemas/account.ts` con las reglas de data-model: `name` "1–100 caracteres, obligatorio"; `type` en `'CHECKING' | 'SAVINGS' | 'CASH' | 'CREDIT_CARD' | 'POCKET' | 'INVESTMENT'`; `parentAccountId` "Si tiene valor es subcuenta (cajita). Un solo nivel. El padre no puede ser `CREDIT_CARD` ni `POCKET`"; "`POCKET` ⇔ `parentAccountId` no nulo"; `openingBalance` "≥ 0"; `creditLimit` "Obligatorio y > 0 solo en `CREDIT_CARD`"; `statementDay`/`paymentDueDay` "1–31, solo `CREDIT_CARD`"; `nature` no editable, derivada con `natureFor(type)` (`CREDIT_CARD` ⇒ `LIABILITY`; resto ⇒ `ASSET`). Mensajes de error en español.
- [X] T038 [P] [US2] Implementar `apps/mobile/src/modules/finance/domain/accounts.ts` usando `balances.ts`: `accountDetail(account, all, txs)` → `{ ownBalance, totalBalance (= propio + Σ cajitas), availableBalance (= propio), pockets[], recentTransactions (últimas 20 de la cuenta y sus cajitas) }`; `creditCardMetrics(account, debt)` → `{ debt, creditLimit, availableCredit = creditLimit − deuda, usedPct = deuda / creditLimit }` (porcentaje con decimal.js); `accountsSummary(accounts, txs, { includeArchived })` → grupos `assets` (bancarias, efectivo, inversión) y `liabilities` (tarjetas) con totales; `availableTotal` = "Σ saldos disponibles de cuentas `ASSET` no archivadas, excluyendo `INVESTMENT`".
- [X] T039 [P] [US2] Pruebas en `apps/mobile/src/modules/finance/domain/accounts.test.ts`: cuenta con 2 cajitas (total, disponible), tarjeta con cupo y deuda (cupo disponible y %), archivadas excluidas por defecto, `availableTotal` sin `INVESTMENT` ni `LIABILITY`, validaciones del esquema (`POCKET` sin padre, tarjeta sin cupo, `statementDay: 32`).
- [X] T040 [US2] Implementar `apps/mobile/src/modules/finance/data/inMemory/accountsRepo.ts`: `createAccount`, `updateAccount`, `archiveAccount(id, archived)` y `deleteAccount(id)`; valida con el esquema (lanza `ValidationError`), deriva `nature`, fija `currency: 'COP'`, y `deleteAccount` lanza `HAS_DEPENDENCIES` si la cuenta tiene movimientos o cajitas.
- [X] T041 [US2] Implementar los hooks en `apps/mobile/src/modules/finance/hooks/useAccounts.ts`: `useAccounts({ includeArchived })`, `useAccount(id)` y `useAccountsSummary()`, con selectores Zustand + `useMemo` sobre `balancesByAccount` y re-export de las escrituras de `accountsRepo`.
- [X] T042 [P] [US2] Crear los componentes de cuentas en `apps/mobile/src/modules/finance/components/accounts/`: `AccountListItem.tsx` (ícono/color, nombre con elipsis, `Amount`), `AccountGroup.tsx` (título + total + lista), `PocketList.tsx`, `CreditCardPanel.tsx` (deuda, cupo, cupo disponible, `ProgressBar` de % usado, "Corte: día X · Pago: día Y") y `AccountTypeIcon.ts` (mapa tipo → ícono).
- [X] T043 [US2] Implementar `apps/mobile/src/app/(tabs)/finance/accounts/index.tsx`: grupos Activos y Pasivos con totales, interruptor "Mostrar archivadas" (FR-010), botón "Nueva cuenta" → `/finance/accounts/new`, y `EmptyState` sin cuentas.
- [X] T044 [US2] Implementar `apps/mobile/src/app/(tabs)/finance/accounts/[id].tsx`. En cuentas, muestra saldo total, saldo disponible, `PocketList` (cada cajita navega a su propio detalle) y movimientos recientes; en tarjetas, `CreditCardPanel`. Acciones: Editar, Archivar/Desarchivar y Eliminar con confirmación; si llega `HAS_DEPENDENCIES`, ofrece "Archivar en su lugar". `NotFound` si el `id` no existe o está borrado.
- [X] T045 [US2] Crear `apps/mobile/src/modules/finance/components/accounts/AccountForm.tsx` (react-hook-form + `zodResolver(accountSchema)`: tipo con `Select`, nombre, saldo inicial con `AmountInput`, campos de tarjeta visibles solo si `CREDIT_CARD`, cuenta padre visible solo si `POCKET`, ícono/color y el interruptor "Excluir del patrimonio") y las rutas `apps/mobile/src/app/(tabs)/finance/accounts/new.tsx` (admite `?parentId=` para crear una cajita) y `apps/mobile/src/app/(tabs)/finance/accounts/[id]/edit.tsx`.
- [X] T046 [US2] Registrar la sección "Cuentas" en `apps/mobile/src/modules/finance/sections.ts` con `SummaryCard` = nuevo `apps/mobile/src/modules/finance/components/summary/AvailableBalanceCard.tsx` ("Saldo disponible" con `availableTotal`, que navega a `/finance/accounts`).

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 - Registrar y consultar movimientos (Priority: P1)

**Goal**: registro rápido con FAB, historial filtrable agrupado por día, edición, borrado y distintivo de categoría sugerida por IA.

**Independent Test**: escenarios 8–11 de quickstart: egreso en < 15 s, validaciones, filtros y distintivo IA.

- [X] T047 [P] [US3] Crear el esquema zod `apps/mobile/src/modules/finance/domain/schemas/transaction.ts` con las reglas de data-model: `accountId` "Obligatorio; cuenta no archivada al crear"; `counterAccountId` "Obligatorio **si y solo si** `type = 'TRANSFER'`; ≠ `accountId`" (error `SAME_ACCOUNT`); `amount` "> 0; entrada con máx. 2 decimales; ≤ 99.999.999.999.999 centavos" (el formulario envía el string y el esquema lo convierte con `parseAmount`; error `AMOUNT_INVALID`); `categoryId` "`null` en transferencias o 'Sin categoría'. Su `kind` debe coincidir con el tipo" (error `CATEGORY_KIND_MISMATCH`); `occurredAt` "Por defecto ahora"; `description` "≤ 500 caracteres"; `reimbursementGroupId` "No aplica a transferencias".
- [X] T048 [P] [US3] Implementar `apps/mobile/src/modules/finance/domain/transactions.ts`: `filterTransactions(txs, filter: TransactionFilter)` (cuenta como origen o destino, tipo, `categoryId` o `'NONE'`, rango de fechas local → UTC con `dates.ts`, `search` sin distinguir mayúsculas ni acentos sobre la descripción, grupo); `groupByLocalDay(txs)` → `DayGroup[]` ordenado desc; `periodTotal(txs)` → `{ income, expense, net }` sin transferencias; `recentTransactions(txs, limit)`.
- [X] T049 [P] [US3] Pruebas en `apps/mobile/src/modules/finance/domain/transactions.test.ts`: combinación de filtros, búsqueda con acentos ("cafe" encuentra "Café"), agrupación por día con zona `America/Bogota`, total sin transferencias y validaciones del esquema (`0`, `-5`, `10,555`, vacío, transferencia con la misma cuenta, categoría de ingreso en un egreso).
- [X] T050 [US3] Implementar `apps/mobile/src/modules/finance/data/inMemory/transactionsRepo.ts`: `createTransaction`, `updateTransaction`, `deleteTransaction` (lógico) y `setTransactionCategory(id, categoryId)`, que fija `categorySource: 'MANUAL'` (FR-020); en `TRANSFER` fuerza `categoryId: null` y `reimbursementGroupId: null`.
- [X] T051 [US3] Implementar los hooks en `apps/mobile/src/modules/finance/hooks/useTransactions.ts`: `useTransactions(filter)` → `{ days, total }`, `useTransaction(id)`, `useRecentTransactions(limit)` y `useCategories(kind?)`, con re-export de las escrituras.
- [X] T052 [P] [US3] Crear los componentes en `apps/mobile/src/modules/finance/components/transactions/`: `TransactionListItem.tsx` (ícono de categoría o de transferencia, descripción con elipsis, cuenta, `Amount` con signo por tipo y `Badge` "Sugerida por IA" si `categorySource === 'AI'`), `DayGroupHeader.tsx` (`formatRelativeDay` + total del día) y `TransactionFilters.tsx` (cuenta, tipo, categoría incl. "Sin categoría", rango de fechas, búsqueda; los valores se leen y escriben en los parámetros de la URL con `useLocalSearchParams` / `router.setParams`).
- [X] T053 [US3] Crear `apps/mobile/src/modules/finance/components/transactions/TransactionForm.tsx`: `SegmentedControl` Ingreso/Egreso/Transferencia; `AmountInput` con foco automático; `Select` de cuenta (solo no archivadas); en Transferencia, `Select` de cuenta destino que excluye la cuenta origen y oculta la categoría; `Select` de categoría filtrado por `kind`; `DateInput` con hoy por defecto; descripción; botón Guardar con error en línea por campo. Acepta `defaultValues` (`type`, `accountId`, `reimbursementGroupId`). Flujo de egreso: monto → categoría → Guardar (≤ 5 interacciones, SC-002).
- [X] T054 [P] [US3] Prueba en `apps/mobile/src/modules/finance/components/transactions/TransactionForm.test.tsx` con React Native Testing Library: muestra error y no llama a `onSubmit` con `0`, `-5`, `10,555` y vacío; Transferencia oculta la categoría y no ofrece la misma cuenta como destino; un egreso válido llama a `onSubmit` con `amount` en centavos (`"25000,50"` → `2500050`).
- [X] T055 [US3] Crear las rutas: `apps/mobile/src/app/(tabs)/finance/transactions/index.tsx` (`TransactionFilters` + `SectionList` por día con el total del periodo filtrado arriba y `EmptyState`), `apps/mobile/src/app/(tabs)/finance/transactions/[id].tsx` (detalle con todos los campos, distintivo IA con acción "Confirmar" o "Cambiar categoría" → `setTransactionCategory`, Editar y Eliminar con confirmación, y `NotFound`), `apps/mobile/src/app/(tabs)/finance/transactions/new.tsx` (lee `?type=&accountId=&groupId=`, guarda y vuelve atrás) y `apps/mobile/src/app/(tabs)/finance/transactions/[id]/edit.tsx`.
- [X] T056 [US3] Crear `apps/mobile/src/components/ui/Fab.tsx` (`GlassSurface variant="blur"`, ícono "+", animación de pulsación con Reanimated, `accessibilityLabel="Nuevo movimiento"`) y montarlo en `apps/mobile/src/app/(tabs)/finance/_layout.tsx` sobre todas las pantallas de Finanzas excepto los modales. Al pulsarlo navega a `/finance/transactions/new`, precargando `accountId` si la ruta actual es `/finance/accounts/[id]` y `groupId` si es `/finance/reimbursements/[id]`.
- [X] T057 [US3] En `apps/mobile/src/app/(tabs)/finance/accounts/[id].tsx`, añadir "Mover dinero" a cada cajita (y a la cuenta principal), que abre `/finance/transactions/new?type=TRANSFER&accountId=…` (FR-014), y hacer que cada movimiento reciente navegue a `/finance/transactions/[id]`.
- [X] T058 [US3] Registrar la sección "Movimientos" en `apps/mobile/src/modules/finance/sections.ts` con `SummaryCard` = nuevo `apps/mobile/src/modules/finance/components/summary/RecentTransactionsCard.tsx` (últimos 5 movimientos y "Ver todos" → `/finance/transactions`).

**Checkpoint**: las tres historias P1 están completas (MVP funcional de finanzas).

---

## Phase 6: User Story 4 - Ver gasto por categoría (Priority: P2)

**Goal**: gasto mensual o anual por categoría, con variación, gráfica de distribución, evolución y desglose por categoría.

**Independent Test**: escenario 12 de quickstart: alternar Mes/Año y periodos, y verificar las exclusiones.

- [X] T059 [P] [US4] Implementar `apps/mobile/src/modules/finance/domain/spending.ts`: `spendingReport(txs, categories, period)` → `{ total, items: { categoryId | null, name ('Sin categoría' si null), color, amount, pct, deltaPct | 'new' }[] ordenados desc, previousTotal, deltaPct }`, donde gasto personal = "Σ `EXPENSE` sin `reimbursementGroupId`, en el rango del periodo (zona local)" (las transferencias, incluido el pago de tarjeta, quedan fuera por tipo) y variación = "`(actual − anterior) / anterior`; sin anterior ⇒ 'nuevo'"; `spendingEvolution(txs, period, n)` → totales de los últimos 6 meses o años; `categoryTransactions(txs, categoryId, period)`.
- [X] T060 [P] [US4] Pruebas en `apps/mobile/src/modules/finance/domain/spending.test.ts`: exclusión de transferencias, pagos de tarjeta y egresos con grupo; "Sin categoría"; porcentajes que suman 100 % ± redondeo; variación con periodo anterior en 0 (`'new'`); evolución de 6 meses; modo año.
- [X] T061 [US4] Implementar el hook `apps/mobile/src/modules/finance/hooks/useSpending.ts`: `useSpendingByCategory(period)` → `{ report, evolution }` y `useCategorySpending(categoryId, period)`.
- [X] T062 [P] [US4] Crear los componentes en `apps/mobile/src/modules/finance/components/spending/`: `PeriodSwitcher.tsx` (`SegmentedControl` Mes/Año + flechas anterior/siguiente + etiqueta "octubre 2026" / "2026"), `CategoryDonut.tsx` (`PieChart` dona de react-native-gifted-charts con `categoryPalette` y el total al centro), `EvolutionChart.tsx` (`BarChart` de los últimos 6 periodos) y `CategoryBreakdownList.tsx` (monto, %, variación con flecha y texto).
- [X] T063 [US4] Crear las rutas `apps/mobile/src/app/(tabs)/finance/spending/index.tsx` (periodo en `?granularity=&anchor=` con el mes actual por defecto, total, dona, lista, evolución y `EmptyState` si el periodo no tiene gastos) y `apps/mobile/src/app/(tabs)/finance/spending/[categoryId].tsx` (movimientos de la categoría en el periodo, con `TransactionListItem` si existe o `ListItem` y `Amount`; `categoryId = 'none'` para "Sin categoría").
- [X] T064 [US4] Registrar la sección "Gastos por categoría" en `apps/mobile/src/modules/finance/sections.ts` con `SummaryCard` = nuevo `apps/mobile/src/modules/finance/components/summary/MonthSpendingCard.tsx` (gasto del mes actual vs. el anterior, con variación).

**Checkpoint**: US4 funciona de forma independiente.

---

## Phase 7: User Story 5 - Ver patrimonio neto (Priority: P2)

**Goal**: patrimonio neto con desglose, exclusiones, bienes con aviso de valor vencido y evolución de 12 meses.

**Independent Test**: escenario 13 de quickstart.

- [X] T065 [P] [US5] Crear el esquema zod `apps/mobile/src/modules/finance/domain/schemas/asset.ts`: `name` "1–100"; `value` "≥ 0" (vía `parseAmount`, aceptando 0); `validUntil` `IsoDate` obligatorio.
- [X] T066 [P] [US5] Implementar `apps/mobile/src/modules/finance/domain/netWorth.ts` usando `balances.ts` y `cdtValuation.ts`: `netWorthReport(accounts, txs, cdts, assets, today)` → `{ netWorth, assetsTotal, liabilitiesTotal, groups: { accounts, investments (valor actual de CDTs), assets (bienes), liabilities }[], excluded: [...] }` con patrimonio neto = "Σ activos (cuentas `ASSET` + valor actual de CDTs + bienes) − Σ deudas (`LIABILITY`), excluyendo `isExcludedFromNetWorth`" (las cuentas `INVESTMENT` de CDT se cuentan por el valor del CDT, no dos veces); `netWorthEvolution(…, months = 12)` = patrimonio al cierre de cada uno de los últimos 12 meses; `isAssetValueExpired(asset, today)`.
- [X] T067 [P] [US5] Pruebas en `apps/mobile/src/modules/finance/domain/netWorth.test.ts`: neto = activos − pasivos, cuenta excluida fuera del total, CDT sin doble conteo, bien vencido y evolución de 12 puntos con el último igual al neto actual.
- [X] T068 [US5] Implementar `apps/mobile/src/modules/finance/data/inMemory/assetsRepo.ts` (`createAsset`, `updateAsset` y `deleteAsset`, con validación) y el hook `apps/mobile/src/modules/finance/hooks/useNetWorth.ts` (`useNetWorth()` y `useAssets()` con `isValueExpired`).
- [X] T069 [P] [US5] Crear los componentes en `apps/mobile/src/modules/finance/components/netWorth/`: `NetWorthHeader.tsx` (neto, activos y pasivos), `NetWorthBreakdown.tsx` (grupos con sus elementos; los excluidos con `Badge` "Excluida" y atenuados; los bienes vencidos con `Badge` de advertencia "Actualiza su valor", que abre su edición), `NetWorthChart.tsx` (`LineChart` de 12 meses con área degradada) y `AssetForm.tsx` (nombre, valor y fecha de validez).
- [X] T070 [US5] Crear las rutas `apps/mobile/src/app/(tabs)/finance/net-worth/index.tsx` (cabecera, gráfica, desglose, "Agregar bien" y `EmptyState`), `apps/mobile/src/app/(tabs)/finance/net-worth/assets/new.tsx` y `apps/mobile/src/app/(tabs)/finance/net-worth/assets/[id]/edit.tsx` (con Eliminar confirmado y `NotFound`).
- [X] T071 [US5] Registrar la sección "Patrimonio" en `apps/mobile/src/modules/finance/sections.ts` con `SummaryCard` = nuevo `apps/mobile/src/modules/finance/components/summary/NetWorthCard.tsx`.

**Checkpoint**: US5 funciona de forma independiente.

---

## Phase 8: User Story 6 - Seguir CDTs (Priority: P3)

**Goal**: resumen de inversiones, lista por vencimiento, detalle con valores calculados y alta de CDT.

**Independent Test**: escenario 14 de quickstart.

- [X] T072 [P] [US6] Crear el esquema zod `apps/mobile/src/modules/finance/domain/schemas/cdt.ts`: `issuer` "Obligatorio"; `principal` "> 0"; `annualRateEa`/`annualRateNominal` "`\"10.2500\"`; 0 < tasa < 100" (string decimal validado con decimal.js); `termDays` "> 0"; `maturesOn` "`openedOn + termDays` por defecto, editable, > `openedOn`"; `interestPayment` en `'AT_MATURITY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL'`; `withholdingRate` "Por defecto `\"4.00\"`"; `sourceAccountId` obligatorio y `payoutAccountId` opcional, ambos "Cuentas de activo".
- [X] T073 [P] [US6] Implementar `apps/mobile/src/modules/finance/domain/cdts.ts` usando `cdtValuation.ts`: `cdtSummary(cdts, txs, today)` → `{ totalInvested, weightedRate }`, con rendimiento promedio ponderado = "`Σ(principal × EA) / Σ principal` sobre CDTs `ACTIVE`"; `sortByMaturity`; `isMaturingSoon(cdt, today)` (≤ 15 días, FR-025); `defaultMaturesOn(openedOn, termDays)`; `cdtDetail(cdt, txs, today)` con interés causado, valor actual y valor neto esperado.
- [X] T074 [P] [US6] Pruebas en `apps/mobile/src/modules/finance/domain/cdts.test.ts`: promedio ponderado de 2 CDTs, `isMaturingSoon` en 15 y 16 días, `defaultMaturesOn` y esquema (`maturesOn` ≤ `openedOn`, tasa 0 o 100).
- [X] T075 [US6] Implementar `apps/mobile/src/modules/finance/data/inMemory/cdtsRepo.ts`: `createCdt` crea en una sola actualización del store la cuenta `INVESTMENT` asociada (nombre `"CDT {issuer}"`), el `Cdt` con `accountId` y la `TRANSFER` de apertura `sourceAccountId` → cuenta del CDT por `principal` con `cdtId`; y `updateCdt`. Añadir el hook `apps/mobile/src/modules/finance/hooks/useCdts.ts` (`useCdts()` y `useCdt(id)`).
- [X] T076 [P] [US6] Crear los componentes en `apps/mobile/src/modules/finance/components/investments/`: `InvestmentsHeader.tsx` (total invertido y rendimiento ponderado), `CdtListItem.tsx` (entidad, capital, tasa E.A., fecha de vencimiento y `Badge` "Próximo a vencer"), `CdtDetailPanel.tsx` (todos los campos de §10 más interés causado, valor actual y valor neto esperado; acciones "Registrar vencimiento" y "Renovar" visibles pero marcadas "Disponible próximamente", según los supuestos de la spec) y `CdtForm.tsx` (`maturesOn` se recalcula al cambiar apertura o plazo mientras el usuario no lo edite a mano).
- [X] T077 [US6] Crear las rutas `apps/mobile/src/app/(tabs)/finance/investments/index.tsx` (cabecera, lista ordenada por vencimiento y `EmptyState`), `apps/mobile/src/app/(tabs)/finance/investments/[id].tsx` (`CdtDetailPanel` y `NotFound`) y `apps/mobile/src/app/(tabs)/finance/investments/new.tsx`.
- [X] T078 [US6] Registrar la sección "Inversiones" en `apps/mobile/src/modules/finance/sections.ts` (sin `SummaryCard`).

**Checkpoint**: US6 funciona de forma independiente.

---

## Phase 9: User Story 7 - Gestionar suscripciones (Priority: P3)

**Goal**: lista con próximo cobro y total mensual equivalente; crear, editar, pausar, reanudar y cancelar.

**Independent Test**: escenario 15 de quickstart.

- [X] T079 [P] [US7] Crear el esquema zod `apps/mobile/src/modules/finance/domain/schemas/subscription.ts`: `name` "Nombre 1–100"; `amount` "> 0"; `billingCycle` en `'MONTHLY' | 'YEARLY'`; `billingDay` "1–31; si el mes es más corto se usa el último día"; `billingMonth` "1–12, obligatorio en `YEARLY`"; `startDate` `IsoDate`; `accountId` obligatorio ("Cuenta o tarjeta de cobro"); `categoryId` opcional de `kind` `EXPENSE`.
- [X] T080 [P] [US7] Implementar `apps/mobile/src/modules/finance/domain/subscriptions.ts`: `nextBillingDate(sub, today)` = "Siguiente fecha ≥ hoy según `billingCycle`, `billingDay` (ajustado al último día del mes), `billingMonth`" (usa `clampDayToMonth` y no antes de `startDate`); `monthlyEquivalent(subs)` = "Σ activas: mensual + anual/12 (decimal.js, half-up a centavos)"; `canTransition(from, to)` según "ACTIVE ⇄ PAUSED ; ACTIVE|PAUSED → CANCELLED (final)".
- [X] T081 [P] [US7] Pruebas en `apps/mobile/src/modules/finance/domain/subscriptions.test.ts`: `billingDay: 31` en febrero y abril, anual con el mes ya pasado, `startDate` futura, total con anual de 119.900 / 12 redondeado, pausadas y canceladas excluidas, y transiciones inválidas (`CANCELLED → ACTIVE`).
- [X] T082 [US7] Implementar `apps/mobile/src/modules/finance/data/inMemory/subscriptionsRepo.ts` (`createSubscription`, `updateSubscription` y `setSubscriptionStatus`, que lanza `INVALID_TRANSITION`) y el hook `apps/mobile/src/modules/finance/hooks/useSubscriptions.ts` → `{ items: SubscriptionWithNext[], monthlyEquivalent }`.
- [X] T083 [P] [US7] Crear los componentes en `apps/mobile/src/modules/finance/components/subscriptions/`: `SubscriptionListItem.tsx` (ícono, nombre, monto, "Mensual" / "Anual", próximo cobro, cuenta, `Badge` de estado y acciones Pausar/Reanudar/Cancelar con confirmación para cancelar) y `SubscriptionForm.tsx` (el `Select` de mes de cobro solo aparece en anual).
- [X] T084 [US7] Crear las rutas `apps/mobile/src/app/(tabs)/finance/subscriptions/index.tsx` (total mensual equivalente arriba, activas, pausadas, canceladas y `EmptyState`), `apps/mobile/src/app/(tabs)/finance/subscriptions/new.tsx` y `apps/mobile/src/app/(tabs)/finance/subscriptions/[id]/edit.tsx`.
- [X] T085 [US7] Registrar la sección "Suscripciones" en `apps/mobile/src/modules/finance/sections.ts` (sin `SummaryCard`).

**Checkpoint**: US7 funciona de forma independiente.

---

## Phase 10: User Story 8 - Gestionar grupos de reembolso (Priority: P3)

**Goal**: grupos abiertos y cerrados con saldo interpretado, totales pendientes, detalle y asociación de movimientos.

**Independent Test**: escenario 16 de quickstart.

- [X] T086 [P] [US8] Crear el esquema zod `apps/mobile/src/modules/finance/domain/schemas/reimbursementGroup.ts`: `name` "1–100"; `payer` opcional; `kind` en `'REIMBURSEMENT' | 'ADVANCE'`; `notes` opcional.
- [X] T087 [P] [US8] Implementar `apps/mobile/src/modules/finance/domain/reimbursements.ts`: `groupBalance(groupId, txs)` = "Σ `INCOME` − Σ `EXPENSE` del grupo"; `balanceLabel(balance)` → "`< 0` 'Te deben', `> 0` 'Tienes de terceros', `= 0` 'Saldado'" (monto mostrado en valor absoluto); `groupsSummary(groups, txs)` → `{ open, closed, totalOwedToMe, totalHeldForOthers }`; `canTransition(from, to, balance)` según "OPEN → SUBMITTED → SETTLED ; OPEN → SETTLED (SETTLED solo si saldo = 0)".
- [X] T088 [P] [US8] Pruebas en `apps/mobile/src/modules/finance/domain/reimbursements.test.ts` con los ejemplos de `docs/db-finanzas.md` §4: reembolso de −250.000 que queda en 0 tras el ingreso, y adelanto de +500.000 que pasa a +80.000 y a 0, o a −50.000; además, `SETTLED` rechazado con saldo ≠ 0.
- [X] T089 [US8] Implementar `apps/mobile/src/modules/finance/data/inMemory/reimbursementsRepo.ts` (`createReimbursementGroup` y `setReimbursementGroupStatus`, que lanza `GROUP_NOT_BALANCED` o `INVALID_TRANSITION`) y el hook `apps/mobile/src/modules/finance/hooks/useReimbursements.ts` (`useReimbursementGroups()` y `useReimbursementGroup(id)`).
- [X] T090 [P] [US8] Crear los componentes en `apps/mobile/src/modules/finance/components/reimbursements/`: `GroupListItem.tsx` (nombre, pagador, "Reembolso" / "Adelanto", estado, `Amount` en valor absoluto + `balanceLabel`), `GroupsSummaryHeader.tsx` (totales "Te deben" y "Tienes de terceros") y `ReimbursementGroupForm.tsx`.
- [X] T091 [US8] Crear las rutas `apps/mobile/src/app/(tabs)/finance/reimbursements/index.tsx` (cabecera, secciones Abiertos y Cerrados, y `EmptyState`), `apps/mobile/src/app/(tabs)/finance/reimbursements/[id].tsx` (saldo y etiqueta, movimientos del grupo, botones "Registrar gasto" / "Registrar ingreso" → `/finance/transactions/new?groupId=…&type=…`, "Marcar como enviado" y "Marcar como saldado" habilitado solo con saldo 0, y `NotFound`) y `apps/mobile/src/app/(tabs)/finance/reimbursements/new.tsx`.
- [X] T092 [US8] En `apps/mobile/src/modules/finance/components/transactions/TransactionForm.tsx`, añadir el `Select` opcional "Grupo de reembolso" (solo grupos `OPEN` o `SUBMITTED`, oculto en Transferencia) usando `useReimbursementGroups`, y respetar `defaultValues.reimbursementGroupId`. Ampliar `TransactionForm.test.tsx` con un caso que envía el `reimbursementGroupId`.
- [X] T093 [US8] Registrar la sección "Reembolsos" en `apps/mobile/src/modules/finance/sections.ts` (sin `SummaryCard`).

**Checkpoint**: todas las historias funcionan.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [X] T094 [P] Revisar la accesibilidad en `apps/mobile/src/components/ui/*` y `apps/mobile/src/modules/finance/components/**`: `accessibilityLabel`/`accessibilityRole` en todo lo interactivo, áreas táctiles ≥ 44×44 y animaciones condicionadas a `useReducedMotion()`. Añadir `apps/mobile/src/theme/contrast.test.ts`, que verifique contraste ≥ 4.5:1 de `text` y `textMuted` sobre `surface` en ambos temas.
- [X] T095 [P] Optimizar el rendimiento: `SectionList`/`FlatList` con `keyExtractor`, `getItemLayout` cuando aplique y `React.memo` en `TransactionListItem`, `AccountListItem` y `GroupListItem`; comprobar que como máximo 2 `GlassSurface variant="blur"` están visibles a la vez en Android (nav + modal o FAB).
- [X] T096 Revisar la maquetación a 360, 768, 1280 y 1920 px en web (SC-005): sin desbordes, montos grandes con `abbreviated` en las tarjetas de resumen, rejillas de 2 columnas desde 1024 px en el hub y en las listas de cuentas, y barra lateral sin solaparse con el contenido.
- [X] T097 Revisar los estados vacíos con `resetMockData('empty')` en todas las pantallas de listas y `NotFound` en todas las rutas `[id]` (incluidos IDs borrados).
- [X] T098 [P] Actualizar la sección "Primeros pasos" de `README.md` con cómo ejecutar `apps/mobile` (instalación, `npx expo start`, Android/web, `npm test`).
- [ ] T099 Ejecutar `npm run lint`, `npm run typecheck` y `npm test` en `apps/mobile` sin errores, y completar los 20 escenarios de `specs/001-finance-ui-mockup/quickstart.md` en Android y web, anotando cualquier fallo.
  - **Estado (2026-10-17)**: lint, typecheck, format:check y `npm test` (114 pruebas) pasan; `expo-doctor` 20/20; bundles web y Android compilan. Escenarios del quickstart verificados en **web** (Chrome, 360–1920 px, temas claro/oscuro, estados vacíos, flujos de cuentas, movimientos, CDT, suscripciones y reembolsos). **Pendiente**: ejecutarlos en un dispositivo/emulador Android (no disponible en este entorno; incluye SC-004 de fluidez) y la revisión con 3 personas (SC-006).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup y **bloquea** todas las historias.
- **Historias (Phases 3–10)**: dependen de Foundational. Orden recomendado por prioridad: US1 → US2 → US3 → US4 → US5 → US6 → US7 → US8.
- **Polish (Phase 11)**: después de las historias que se quieran entregar.

### User Story Dependencies

- **US1 (P1)**: solo Foundational. Crea `finance/_layout.tsx` y `sections.ts`, que el resto amplía.
- **US2 (P1)**: Foundational + US1 (`sections.ts`, stack de Finanzas).
- **US3 (P1)**: Foundational + US1. T057 modifica la pantalla de detalle de cuenta de US2; si US2 no existe, se omite T057.
- **US4 (P2)**: Foundational + US1. T063 reutiliza `TransactionListItem` de US3 si existe.
- **US5 (P2)**: Foundational + US1 (usa `cdtValuation.ts` de Foundational, no US6).
- **US6 (P3)**: Foundational + US1.
- **US7 (P3)**: Foundational + US1.
- **US8 (P3)**: Foundational + US1; T092 requiere `TransactionForm` de US3.

### Within Each User Story

- Esquema y dominio → pruebas del dominio → repositorio → hooks → componentes → rutas → registro en `sections.ts`.
- Las tareas que tocan `sections.ts`, `finance/_layout.tsx`, `accounts/[id].tsx` o `TransactionForm.tsx` desde varias historias son secuenciales (no [P]).

### Parallel Opportunities

- Setup: T003, T004 y T005 en paralelo tras T002.
- Foundational: T006–T011, T013–T018, T022–T024 y T027–T030 en paralelo (archivos distintos). T012, T019–T021, T025 y T026 en el orden indicado.
- Con Foundational y US1 terminadas, US2, US4, US5, US6 y US7 pueden avanzar en paralelo (cada una en sus propias carpetas). Solo el registro en `sections.ts` se hace de forma secuencial.

---

## Parallel Example: User Story 2

```bash
# Esquema, dominio y pruebas en paralelo:
Task: "T037 Esquema zod de cuenta en apps/mobile/src/modules/finance/domain/schemas/account.ts"
Task: "T038 Dominio de cuentas en apps/mobile/src/modules/finance/domain/accounts.ts"
Task: "T039 Pruebas en apps/mobile/src/modules/finance/domain/accounts.test.ts"
# Componentes en paralelo con el repositorio/hooks:
Task: "T042 Componentes en apps/mobile/src/modules/finance/components/accounts/"
```

## Parallel Example: User Story 3

```bash
Task: "T047 Esquema de transacción en apps/mobile/src/modules/finance/domain/schemas/transaction.ts"
Task: "T048 Dominio en apps/mobile/src/modules/finance/domain/transactions.ts"
Task: "T049 Pruebas en apps/mobile/src/modules/finance/domain/transactions.test.ts"
Task: "T052 Componentes de lista y filtros en apps/mobile/src/modules/finance/components/transactions/"
```

## Parallel Example: P2/P3 después del MVP

```bash
Task: "Phase 6 (US4) — apps/mobile/src/modules/finance/{domain/spending.ts,components/spending/}"
Task: "Phase 7 (US5) — apps/mobile/src/modules/finance/{domain/netWorth.ts,components/netWorth/}"
Task: "Phase 8 (US6) — apps/mobile/src/modules/finance/{domain/cdts.ts,components/investments/}"
Task: "Phase 9 (US7) — apps/mobile/src/modules/finance/{domain/subscriptions.ts,components/subscriptions/}"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 (Setup) → Phase 2 (Foundational).
2. Phase 3 (US1): **detenerse y validar** en Android y web (quickstart 1–5). Es el esqueleto demostrable.
3. Phases 4–5 (US2, US3): con ellas el módulo de finanzas ya es útil (quickstart 6–11).

### Incremental Delivery

1. Setup + Foundational → la app arranca.
2. US1 → shell navegable.
3. US2 + US3 → cuentas y movimientos (MVP de finanzas).
4. US4 + US5 → análisis.
5. US6, US7 y US8 → inversiones, suscripciones y reembolsos.
6. Polish → validación completa del quickstart.

---

## Notes

- [P] = archivo distinto y sin dependencias pendientes.
- Las pantallas solo consumen hooks de `src/modules/finance/hooks/`; ESLint (T004) lo hace cumplir.
- Toda la aritmética de montos pasa por `src/lib/money.ts`.
- No hacer commit sin que el usuario lo pida (`CLAUDE.md`).
- Decisión abierta heredada del plan: contenido de Finanzas → Resumen (T035 + `SummaryCard` de T046, T058, T064 y T071). Si cambia, solo se ajustan esas tareas.
