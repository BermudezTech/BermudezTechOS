# Research — 008 Mejoras de UI en Finanzas

No quedaban `NEEDS CLARIFICATION` en el contexto técnico. Las decisiones se tomaron revisando el código existente de `apps/mobile` y `apps/api`.

## R1. Estado del mes seleccionado en el Resumen

- **Decision**: store Zustand **en memoria** (`useSummaryMonth`) con `selected: IsoDate | null`, donde `null` = mes en curso. No se persiste.
- **Rationale**: las tarjetas del Resumen se registran como `ComponentType` sin props en `financeSections`, así que un store compartido evita cambiar ese contrato. Con `null` como "mes en curso" se resuelve el cambio de mes a medianoche: quien miraba el mes en curso pasa al nuevo, y una selección explícita se conserva. Además, al reiniciar la app se vuelve al mes en curso sin código extra (supuesto "Selección no persistente").
- **Alternatives considered**: parámetros de URL en `/finance` (el hub es raíz del stack y la URL se comparte con la pestaña; ensucia el deep link); contexto React en `FinanceHomeScreen` (obliga a pasar props o envolver el registro); `useAmountVisibilityStore` persistido (contradice la spec).

## R2. Límite inferior de navegación

- **Decision**: `firstActivityMonth(transactions)` devuelve el mes local (Bogotá) del movimiento personal (ingreso o gasto, criterio de FR-002) más antiguo, o `null` si no hay ninguno. Se usa como mínimo en el `MonthSelector` del Resumen y también en `PeriodSwitcher` (Gastos, Ingresos, Balance) mediante una nueva prop `min`.
- **Rationale**: la clarificación fija el límite del Resumen. Aplicar el mismo tope a las pantallas dedicadas resuelve el punto diferido de `/speckit-clarify` y evita periodos sin sentido. Los meses vacíos *dentro* del rango siguen siendo seleccionables (escenario "mes sin movimientos").
- **Alternatives considered**: sin límite en las pantallas dedicadas (incoherente con el Resumen); contar transferencias como actividad (no aportan a ingresos, gastos ni balance).

## R3. Lista de meses (MonthPickerSheet)

- **Decision**: hoja modal basada en el patrón de `components/ui/form/Select.tsx` (`Modal` + `GlassSurface` + lista). Usa `SectionList` con una sección por año (de la más reciente a la más antigua), los meses en orden descendente y el mes seleccionado marcado. Al elegir uno se cierra la hoja.
- **Rationale**: es el mismo lenguaje visual y de accesibilidad que ya usan los selectores, funciona igual en Android y web y no añade dependencias.
- **Alternatives considered**: extender `Select` con secciones (complica un componente de formulario genérico); calendario de terceros (dependencia nueva, mayor peso).

## R4. Generalizar el reporte por categoría

- **Decision**: refactorizar `domain/spending.ts`. La lógica de `spendingReport`, `spendingEvolution` y `categoryTransactions` pasa a funciones parametrizadas por `kind: CategoryKind` (`categoryFlowReport`, `categoryFlowEvolution`, `categoryFlowTransactions`) con el predicado `isPersonalExpense` / `isPersonalIncome`. Las funciones actuales se mantienen como envoltorios de `'EXPENSE'` para no tocar a quien las usa. Los componentes `CategoryDonut`, `CategoryBreakdownList` y `EvolutionChart` reciben un `basePath` (`/finance/spending` o `/finance/income`) y un texto de accesibilidad.
- **Rationale**: FR-002 exige que un mismo periodo dé el mismo número en todas las vistas. Usar un único cálculo con los mismos predicados lo garantiza por construcción, y las pruebas existentes de gastos siguen sirviendo.
- **Alternatives considered**: copiar `spending.ts` a `income.ts` (duplicación y riesgo de divergencia).

## R5. Pantalla de Balance y su gráfica

- **Decision**: `balanceEvolution(transactions, period, 6)` devuelve `FlowTotals` por periodo, reutilizando `totalsIn` de `monthSummary.ts`. La gráfica (`BalanceEvolutionChart`) usa `BarChart` de gifted-charts con barras agrupadas de ingresos y gastos (colores `income`/`expense` del tema) y el balance como etiqueta sobre cada grupo, coloreada por signo. La pantalla muestra una tarjeta principal con el balance (`Amount variant="auto"`), dos filas pulsables de ingresos y gastos que navegan a las pantallas por categoría del mismo periodo, y `DeltaText` del balance.
- **Rationale**: se reutiliza la librería de gráficas existente. Las barras agrupadas son legibles en móvil con 6 periodos. La variación del balance usa la función `delta` ya definida (con su caso `'new'`).
- **Alternatives considered**: `lineData` superpuesta en `BarChart` (soportada, pero mezclar dos escalas en el mismo eje complica la lectura con balances negativos); tres gráficas separadas (ocupa demasiado).
- **Nota sobre la variación del balance**: si el balance anterior es negativo, el porcentaje confunde. En ese caso se muestra la diferencia absoluta (p. ej. "+ $ 320.000 vs. mes anterior") en lugar del porcentaje. Esto lo cubre `balanceDelta` en `contracts/domain.md`.

## R6. Catálogo de íconos

- **Decision**: lista estática `iconCatalog.ts` de alrededor de 120 nombres de Ionicons (variantes `-outline`) en 14 grupos: Comida y bebida, Transporte, Hogar, Servicios, Salud, Educación, Ocio, Compras, Finanzas, Trabajo, Viajes, Mascotas, Familia y personal, Otros. Cada entrada tiene `name`, `label` en español y `keywords` en español sin tildes. Incluye todos los íconos de `apps/api/app/modules/categories/defaults.py`, para que las categorías iniciales aparezcan marcadas. Una prueba verifica que cada nombre existe en `Ionicons.glyphMap` y que no hay duplicados.
- **Rationale**: Ionicons ya está empaquetado (`@expo/vector-icons` 15.1, unos 1.300 glifos) y el tipo `IconName` existe, así que no hay que añadir fuentes. Una lista curada y etiquetada hace posible la búsqueda en español (SC-004), cosa que los nombres en inglés del glyphMap no permiten.
- **Alternatives considered**: exponer los ~1.300 glifos sin curar (búsqueda en inglés, ruido, rendimiento de la cuadrícula); otra familia de íconos (dependencia y estética mixta).

## R7. Búsqueda de íconos

- **Decision**: `searchIcons(query)` normaliza con `NFD` + eliminación de diacríticos + minúsculas, y busca coincidencias por subcadena en `label`, `keywords` y `name`. Sin consulta muestra los grupos; con consulta, una cuadrícula plana de resultados o un estado vacío ("Sin íconos para «…»"). La cuadrícula es un `FlatList` con `numColumns`.
- **Rationale**: es simple, determinista y se puede probar en Jest. Con ~120 entradas, filtrar en cada pulsación cuesta menos de 1 ms.

## R8. Paleta de colores

- **Decision**: ampliar `categoryPalette` en `theme/tokens.ts` de 13 a **20** colores e incluir todos los colores de las categorías por defecto del servidor (p. ej. `#F59E0B`, `#64748B`, que hoy faltan). Se mantiene el tipo `string[]`, que comparten `AccountForm` y las gráficas; así las cuentas también ganan los colores nuevos. El selector (`ColorPalettePicker`) es una cuadrícula de círculos con estado `selected` accesible y un nombre en español ("Violeta", "Cian"…) tomado de un mapa `paletteColorLabels`. `contrast.test.ts` se amplía con un piso de contraste de cada color sobre `surfaceSolid`: **≥ 1.8:1 en claro y ≥ 3:1 en oscuro**. El color de categoría es decorativo, porque siempre va acompañado del nombre en texto con contraste ≥ 4.5:1. El piso evita colores casi invisibles. Un 3:1 en claro excluiría la mitad de los tonos vibrantes actuales y por defecto (amarillo `#EAB308` = 1.92, cian `#06B6D4` = 2.43 sobre blanco), y con ello la estética vibrante que pide la constitución.
- **Rationale**: la paleta ya está centralizada y es la que usan las gráficas, así que ampliarla mantiene la coherencia. Validar el contraste con una prueba cumple "legible en ambos modos" (FR-016).
- **Alternatives considered**: una paleta separada solo para categorías (dos fuentes de verdad).

## R9. Formulario y validación de categorías

- **Decision**: esquema Zod `categoryInputSchema` (nombre recortado de 1 a 50 caracteres, `kind`, `icon` del catálogo o el valor actual heredado, `color` de la paleta o el valor actual heredado). La unicidad se comprueba en el repositorio contra las categorías activas del mismo tipo con `normalizeCategoryName` (trim + NFD sin tildes + minúsculas), excluyendo la propia categoría al editar. Error en español: "Ya tienes una categoría de egreso llamada «Mercado»".
- **Rationale**: el servidor solo detecta duplicados exactos. La regla local es más estricta (FR-014) y evita la mayoría de rechazos `DUPLICATE`. Los duplicados creados en paralelo en dos dispositivos los sigue cubriendo la UI de rechazos de sync existente.
- **Ícono y color heredados** fuera del catálogo o la paleta: el esquema los acepta solo si no cambiaron respecto al valor almacenado (edge cases de la spec). Si el usuario edita otro campo, se conservan.
- **Alternatives considered**: forzar al usuario a elegir ícono y color de nuevo al editar una categoría antigua (fricción innecesaria).

## R10. Repositorio local de categorías

- **Decision**: `categoriesRepo.ts` con `createCategory(input)` y `updateCategory(id, changes)`, siguiendo el patrón de `assetsRepo.ts` (`insert` / `patch` del store + `validate`). `createCategory` asigna `sortOrder = max(sortOrder del tipo) + 1`. `updateCategory` ignora cualquier `kind` entrante (FR-013). No se expone ninguna función de borrado.
- **Rationale**: es idéntico a los demás repos y el store ya gestiona `is_dirty`, `updated_at` y la persistencia en SQLite. La tabla `categories` ya está en `sync/tables.ts`.

## R11. Crear categoría desde el formulario de movimientos

- **Decision**: añadir al final de los chips de categoría de `TransactionForm` un chip "+ Nueva" que abre `CategoryEditorSheet`, una hoja `Modal` dentro del propio formulario que renderiza `CategoryForm` con `kind` fijado al tipo del movimiento. Al guardar, llama a `createCategory`, cierra la hoja y hace `setValue('categoryId', nueva.id)`. Al cancelar, solo cierra. La prop es opcional (`allowCreateCategory`) y solo la activan las pantallas de nuevo y editar movimiento, no suscripciones ni ingresos recurrentes.
- **Rationale**: como el formulario nunca se desmonta, no se pierde lo que el usuario llevaba escrito y no hace falta devolver el ID por navegación. Funciona igual en Android y web.
- **Alternatives considered**: navegar a `/finance/categories/new` como segundo modal y devolver el ID por parámetros o un store (modales anidados frágiles en web y más estado compartido).

## R12. Rango de Patrimonio

- **Decision**: `type NetWorthRange = '6M' | '12M' | '24M' | 'ALL'`, con estado local de la pantalla (por defecto `'12M'`). `firstNetWorthMonth(accounts, transactions, cdts, assets)` toma el mínimo entre el `occurredAt` de los movimientos, el `startDate` de los CDT y el `createdAt` de cuentas y bienes, en mes local. Los meses mostrados son `min(rango, meses desde el primer dato hasta hoy)` (FR-022). `netWorthEvolution` mantiene su firma (`months`), y el hook calcula `months` a partir del rango. Las etiquetas del eje se espacian con `step = ceil(n / 6)`: mes corto ("ene") cuando n ≤ 12 y "ene 26" cuando n > 12. Título: "Últimos 6 meses", "Últimos 12 meses", "Últimos 24 meses" o "Desde <mes año>".
- **Rendimiento**: `netWorthEvolution` hoy recalcula los saldos desde cero en cada mes (O(meses × movimientos)). Con "Todo" sobre unos 5 años son unos 60 recálculos. Si en el quickstart (escenario P5) supera 1 s en gama media, se optimiza recorriendo una sola vez los movimientos ordenados por fecha y acumulando saldos por cuenta. Es un cambio interno y no altera la interfaz.
- **Alternatives considered**: agregar por trimestres en "Todo" (cambia la semántica de la gráfica y la spec no lo pide); persistir el rango (contradice la spec).

## R13. Respaldo de íconos inexistentes

- **Decision**: `Icon` comprueba `name in Ionicons.glyphMap` y, si el nombre no existe, usa `pricetag-outline`.
- **Rationale**: hay datos antiguos o creados en otro cliente con nombres arbitrarios (edge case de la spec). Sin respaldo, Ionicons muestra un "?".

## R14. Enlaces de las tarjetas y del menú

- **Decision**: `MonthIncomeCard` → `/finance/income?granularity=MONTH&anchor=<mes>`, `MonthSpendingCard` → `/finance/spending?...` y `MonthBalanceCard` → `/finance/balance?...`. En `financeSections` se añaden `income` ("Ingresos por categoría"), `balance` ("Balance") y `categories` ("Categorías"), y las tarjetas de ingresos y balance se mueven a esas secciones (mismo `order`).
- **Rationale**: cumple FR-005 y FR-008 sin cambiar el contrato del registro de secciones.
