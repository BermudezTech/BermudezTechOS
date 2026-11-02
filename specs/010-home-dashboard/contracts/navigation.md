# Contract: navegación

## Rutas nuevas

| Ruta | Archivo | Presentación | Parámetros |
|---|---|---|---|
| `/quick-transaction` | `src/app/(app)/quick-transaction.tsx` | `modal` en el Stack de `(app)/_layout.tsx` (sobre las pestañas) | `type?: 'EXPENSE' \| 'INCOME' \| 'TRANSFER'` |

- Renderiza `NewTransactionScreen` (componente compartido con `/finance/transactions/new`) con `defaults.type = type` y `fallback = '/'`.
- Guardar o cancelar → `goBack('/')` → `router.dismiss()` → vuelve a la pestaña de origen (Inicio).
- Sin cuentas: "Nueva cuenta" → `router.dismiss()` y luego `router.push('/finance/accounts/new')`.
- `isModalPath('/quick-transaction')` es `false`: no afecta el FAB de Finanzas, que vive en otro stack.

## Rutas modificadas

| Ruta | Cambio |
|---|---|
| `/finance/transactions/new` | Su cuerpo se mueve a `NewTransactionScreen`; el comportamiento no cambia (`fallback = '/finance/transactions'`). |
| `/` (Inicio) | Pasa a ser el tablero (ver [widgets.md](./widgets.md)). |

## Destinos desde el tablero

| Origen | Destino |
|---|---|
| Widget Patrimonio | `/finance/net-worth` |
| Widget Este mes | `/finance/balance?granularity=MONTH&anchor=<hoy>` |
| Patrimonio vacío → "Crear cuenta" | `/finance/accounts/new` |
| Fila SUBSCRIPTION | `/finance/subscriptions/<id>/edit` |
| Fila CDT_MATURITY | `/finance/investments/<id>` |
| Fila CARD_PAYMENT | `/finance/accounts/<id>` |
| FAB → opción | `/quick-transaction?type=<tipo>` |
