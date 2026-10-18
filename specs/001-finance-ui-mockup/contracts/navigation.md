# Contract — Navegación, rutas y registro de módulos

## Registro de módulos (FR-002, FR-005, SC-007)

```ts
interface AppModule {
  id: string;                         // 'home' | 'finance' | 'routines' | ...
  label: string;                      // en español
  icon: string;                       // nombre de ícono
  route: string | null;               // null si status = 'coming_soon'
  status: 'active' | 'coming_soon';
  placement: 'main' | 'footer';       // footer = Ajustes
}
```

Contenido inicial, en orden:

| id | label | route | status |
|---|---|---|---|
| `home` | Inicio | `/` | active |
| `finance` | Finanzas | `/finance` | active |
| `routines` | Rutinas | — | coming_soon |
| `calendar` | Calendario | — | coming_soon |
| `todo` | To-do | — | coming_soon |
| `habits` | Hábitos | — | coming_soon |
| `settings` | Ajustes | `/settings` | active (footer) |

**Comportamiento del menú (`AppNavBar`)**:

- Ancho < 1024 px: barra inferior con los módulos `active`; un botón "Más" abre una hoja con los
  `coming_soon` (etiqueta "Próximamente", no navegables).
- Ancho ≥ 1024 px: barra lateral con todos los módulos; los `coming_soon` aparecen atenuados con
  la etiqueta "Próximamente" y `accessibilityState={{ disabled: true }}`.
- Añadir un módulo = añadir una entrada y su grupo de rutas; ningún otro archivo cambia.

## Mapa de rutas (Expo Router)

| URL | Pantalla | Presentación | Historia |
|---|---|---|---|
| `/` | Inicio (solo saludo) | tab | US1 |
| `/finance` | Finanzas → Resumen (hub) | stack raíz | US1 |
| `/finance/accounts` | Cuentas (activos / pasivos, filtro archivadas) | stack | US2 |
| `/finance/accounts/[id]` | Detalle de cuenta o tarjeta | stack | US2 |
| `/finance/accounts/new`, `/finance/accounts/[id]/edit` | Formulario de cuenta/cajita/tarjeta | modal | US2 |
| `/finance/transactions` | Historial con filtros | stack | US3 |
| `/finance/transactions/[id]` | Detalle de movimiento | stack | US3 |
| `/finance/transactions/new?type=&accountId=&groupId=` | Formulario de movimiento | modal | US3 |
| `/finance/transactions/[id]/edit` | Editar movimiento | modal | US3 |
| `/finance/spending?granularity=&anchor=` | Gastos por categoría | stack | US4 |
| `/finance/spending/[categoryId]?granularity=&anchor=` | Movimientos de una categoría | stack | US4 |
| `/finance/net-worth` | Patrimonio | stack | US5 |
| `/finance/net-worth/assets/new`, `/finance/net-worth/assets/[id]/edit` | Formulario de bien | modal | US5 |
| `/finance/investments` | Inversiones (CDTs) | stack | US6 |
| `/finance/investments/[id]` | Detalle de CDT | stack | US6 |
| `/finance/investments/new` | Formulario de CDT | modal | US6 |
| `/finance/subscriptions` | Suscripciones | stack | US7 |
| `/finance/subscriptions/new`, `/finance/subscriptions/[id]/edit` | Formulario de suscripción | modal | US7 |
| `/finance/reimbursements` | Grupos de reembolso | stack | US8 |
| `/finance/reimbursements/[id]` | Detalle de grupo | stack | US8 |
| `/finance/reimbursements/new` | Formulario de grupo | modal | US8 |
| `/settings` | Ajustes (tema, usuario, restablecer datos) | tab | US1 |

**Reglas**:

- Toda pantalla de detalle tiene botón atrás en el encabezado; en Android responde al botón del
  sistema y en web al historial del navegador (FR-006).
- Los parámetros de filtros y periodos van en la URL para que sobrevivan a la recarga en web.
- Una ruta inexistente o un `id` borrado muestra un estado "No encontrado" con acceso a Finanzas.
- El botón de acción rápida (FAB, FR-015) está en todas las pantallas bajo `/finance` y abre
  `/finance/transactions/new`, precargando `accountId` o `groupId` si se está en ese detalle.
