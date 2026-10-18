# Pantallas y componentes de la app móvil

Referencia rápida de las pantallas (rutas de `expo-router` en `apps/mobile/src/app`) y de los componentes de UI reutilizables (`apps/mobile/src/components/ui`).

Las rutas `new` y `edit` se abren como **modal** a pantalla completa, sin la barra de navegación.

## Pantallas

### Generales

| Ruta | Pantalla | Descripción |
|---|---|---|
| `_layout.tsx` | Layout raíz | Carga fuentes y tema, y envuelve toda la app. |
| `(tabs)/_layout.tsx` | Navegación por pestañas | Barra inferior en pantallas angostas (< 1024 px) y lateral en anchas. |
| `(tabs)/index.tsx` | Inicio | Saludo según la hora del día con el nombre del usuario. |
| `(tabs)/settings.tsx` | Ajustes | Apariencia (tema claro/oscuro/sistema), módulos y datos de prueba. |
| `+not-found.tsx` | Página no encontrada | Se muestra cuando la ruta no existe. |

### Finanzas

| Ruta | Pantalla | Descripción |
|---|---|---|
| `finance/_layout.tsx` | Stack de Finanzas | Define qué rutas son modales y muestra el FAB fuera de ellos. |
| `finance/index.tsx` | Resumen de Finanzas | Tarjetas de resumen (saldo, gasto del mes, patrimonio), últimos movimientos y acceso a las secciones. |
| `finance/accounts/index.tsx` | Cuentas | Lista de cuentas y sus cajitas con saldos. |
| `finance/accounts/new.tsx` | Nueva cuenta / cajita | Formulario para crear una cuenta o una cajita dentro de una cuenta. |
| `finance/accounts/[id]/index.tsx` | Detalle de cuenta | Saldo, cajitas y movimientos de una cuenta. |
| `finance/accounts/[id]/edit.tsx` | Editar cuenta | Formulario de edición de una cuenta. |
| `finance/transactions/index.tsx` | Movimientos | Lista de ingresos, gastos y transferencias con filtros. |
| `finance/transactions/new.tsx` | Nuevo movimiento | Formulario para registrar un movimiento (requiere al menos una cuenta). |
| `finance/transactions/[id]/index.tsx` | Detalle de movimiento | Información completa de un movimiento. |
| `finance/transactions/[id]/edit.tsx` | Editar movimiento | Formulario de edición de un movimiento. |
| `finance/spending/index.tsx` | Gastos por categoría | Gasto del periodo agrupado por categoría (sin transferencias, pagos de tarjeta ni reembolsables). |
| `finance/spending/[categoryId].tsx` | Gastos de una categoría | Movimientos de una categoría en el periodo elegido. |
| `finance/net-worth/index.tsx` | Patrimonio | Patrimonio neto: activos menos pasivos. |
| `finance/net-worth/assets/new.tsx` | Nuevo bien | Formulario para registrar un activo (bien). |
| `finance/net-worth/assets/[id]/edit.tsx` | Editar bien | Formulario de edición de un bien. |
| `finance/investments/index.tsx` | Inversiones | Lista de CDTs. |
| `finance/investments/new.tsx` | Nuevo CDT | Formulario para registrar un CDT. |
| `finance/investments/[id].tsx` | Detalle de CDT | Emisor, número de certificado y rendimiento de un CDT. |
| `finance/subscriptions/index.tsx` | Suscripciones | Gastos fijos recurrentes. |
| `finance/subscriptions/new.tsx` | Nueva suscripción | Formulario para crear una suscripción. |
| `finance/subscriptions/[id]/edit.tsx` | Editar suscripción | Formulario de edición de una suscripción. |
| `finance/reimbursements/index.tsx` | Reembolsos | Grupos de viáticos, adelantos y dinero de terceros. |
| `finance/reimbursements/new.tsx` | Nuevo grupo | Formulario para crear un grupo de reembolso. |
| `finance/reimbursements/[id].tsx` | Detalle de grupo | Movimientos y estado de un grupo de reembolso. |

## Componentes de UI

### Base y layout

| Componente | Archivo | Descripción |
|---|---|---|
| `Screen` | `Screen.tsx` | Contenedor de pantalla: título, subtítulo, botón atrás, scroll y modo modal. |
| `ScreenBackground` | `ScreenBackground.tsx` | Fondo degradado de la app según el tema. |
| `BlurTarget` | `BlurTarget.tsx` | Área que el blur puede difuminar (en Android, `BlurView` la necesita). |
| `AppNavBar` (`BottomNav`, `SideNav`) | `AppNavBar.tsx` | Barra de navegación inferior o lateral; se oculta en los modales. |
| `useIsWide`, `useNavInset`, `isModalPath` | `layout.tsx` | Utilidades de layout: pantalla ancha, espacio de la barra y detección de modales. |
| `FadeIn` | `FadeIn.tsx` | Animación de aparición con desplazamiento. |

### Superficies glass

| Componente | Archivo | Descripción |
|---|---|---|
| `GlassSurface` | `GlassSurface.tsx` | Superficie translúcida: `tinted` (sin blur, para tarjetas) o `blur` (desenfoque real, para elementos flotantes). |
| `GlassCard` | `GlassCard.tsx` | Tarjeta basada en `GlassSurface`, con padding y opción de ser presionable. |

### Contenido

| Componente | Archivo | Descripción |
|---|---|---|
| `AppText` | `AppText.tsx` | Texto con las variantes tipográficas y los tonos del tema. |
| `Amount` | `Amount.tsx` | Muestra un monto con formato y color por tipo (ingreso, egreso, deuda). |
| `Icon`, `IconBadge` | `Icon.tsx` | Ícono simple, o ícono dentro de un círculo de color. |
| `Badge` | `Badge.tsx` | Etiqueta pequeña con tono e ícono opcional (p. ej. "Sugerida por IA"). |
| `ListItem` | `ListItem.tsx` | Fila de lista con ícono, título, subtítulo y contenido a la derecha. |
| `SectionHeader` | `SectionHeader.tsx` | Título de sección con acción opcional (p. ej. "Ver todos"). |
| `ProgressBar` | `ProgressBar.tsx` | Barra de progreso accesible. |
| `EmptyState`, `NotFound` | `EmptyState.tsx` | Estado vacío con mensaje y acción, y aviso de elemento no encontrado. |

### Acciones

| Componente | Archivo | Descripción |
|---|---|---|
| `Button`, `IconButton` | `Button.tsx` | Botón con variantes (primario, etc.) y botón de solo ícono. |
| `Fab` | `Fab.tsx` | Botón flotante para crear un nuevo movimiento. |
| `SegmentedControl` | `SegmentedControl.tsx` | Selector de opciones en segmentos (p. ej. tema o periodo). |

### Formularios (`form/`)

| Componente | Archivo | Descripción |
|---|---|---|
| `FormField` | `FormField.tsx` | Envoltorio de campo con etiqueta, ayuda y error. |
| `TextField` | `TextField.tsx` | Campo de texto con prefijo opcional y estado de error. |
| `AmountInput` | `AmountInput.tsx` | Campo para montos (variante grande por defecto). |
| `DateInput` | `DateInput.tsx` / `DateInput.web.tsx` | Selector de fecha: nativo en móvil y versión propia en web. |
| `Select` | `Select.tsx` | Selector de una opción de una lista. |
| `SwitchField` | `SwitchField.tsx` | Interruptor con etiqueta y descripción; toda la fila es táctil. |
