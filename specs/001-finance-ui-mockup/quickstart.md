# Quickstart — validar 001-finance-ui-mockup

Guía para ejecutar la app y comprobar que la feature cumple la spec. Rutas y pantallas en
[contracts/navigation.md](./contracts/navigation.md); reglas de cálculo en
[data-model.md](./data-model.md).

## Requisitos

- Node.js LTS (≥ 20) y npm.
- Android: dispositivo con **Expo Go** o un *development build*, o emulador Android (Android Studio).
  Para medir fluidez, un teléfono Android de gama media real.
- Web: Chrome o Firefox recientes.

## Arranque

```bash
cd apps/mobile
npm install
npm test               # pruebas unitarias del dominio y de formularios
npm run lint && npm run typecheck && npm run format:check
npx expo start         # luego: "a" para Android, "w" para web
```

## Escenarios de validación

| # | Escenario | Resultado esperado | Spec |
|---|---|---|---|
| 1 | Abrir la app en Android y en web. | Inicio muestra solo el saludo con el nombre del usuario de prueba según la hora; sin widgets. | US1, FR-007/008 |
| 2 | Recorrer el menú: Inicio, Finanzas, Ajustes; tocar Rutinas/Calendario/To-do/Hábitos. | Las tres primeras navegan; las demás muestran "Próximamente" y no navegan. | FR-002 |
| 3 | En web, redimensionar la ventana por encima/debajo de 1024 px estando en un detalle de cuenta. | El menú alterna barra inferior ↔ lateral sin perder la pantalla actual. | FR-003 |
| 4 | Entrar a cada subsección de Finanzas desde el Resumen. | Las 8 pantallas son accesibles en ≤ 3 toques desde Inicio. | FR-004, SC-001 |
| 5 | Ajustes → tema claro, oscuro y sistema. | Todas las pantallas cambian y siguen legibles. | FR-036, SC-008 |
| 6 | Cuentas → abrir la cuenta de ahorros con cajitas. | Saldo total = propio + cajitas; disponible = propio. Coincide con la prueba unitaria del seed. | US2, SC-003 |
| 7 | Abrir una tarjeta de crédito. | Deuda, cupo, cupo disponible, % usado, días de corte y pago. | FR-012 |
| 8 | Desde Finanzas, FAB → egreso de `25.000,50` en Alimentación. Cronometrar. | < 15 s y ≤ 5 interacciones; aparece en el historial y el saldo baja exactamente 25.000,50. | US3, SC-002 |
| 9 | Intentar guardar montos `0`, `-5`, `10,555`, vacío; transferencia con la misma cuenta. | Mensajes de validación; no se guarda. | FR-017 |
| 10 | Historial → filtros por cuenta, tipo, categoría, fechas y búsqueda. | Solo resultados que cumplen todos; agrupados por día con total. | FR-018 |
| 11 | Abrir un movimiento con distintivo "sugerida (IA)" y cambiar la categoría. | El distintivo desaparece. | FR-020 |
| 12 | Gastos por categoría: alternar Mes/Año y periodos anteriores. | Totales recalculados; transferencias, pagos de tarjeta y gastos de grupos excluidos. | US4, FR-022 |
| 13 | Patrimonio. | Neto = activos − pasivos; cuenta excluida marcada y fuera del total; bien vencido con aviso; gráfica de 12 meses. | US5 |
| 14 | Inversiones → CDT próximo a vencer → detalle; crear un CDT nuevo. | Indicador "próximo a vencer"; vencimiento calculado = apertura + plazo. | US6 |
| 15 | Suscripciones → pausar una mensual. | Deja de sumar al total mensual equivalente. | US7 |
| 16 | Reembolsos → registrar un gasto asociado al grupo de reembolso. | Saldo del grupo baja; "Te deben" aumenta. | US8 |
| 17 | Ajustes → "Restablecer datos de prueba" → modo vacío. | Cada lista muestra su estado vacío con acción de crear. | Edge cases, FR-039 |
| 18 | En web, crear un movimiento y recargar el navegador. | Vuelven los datos iniciales; la URL actual se conserva. | Edge cases |
| 19 | Revisar pantallas a 360, 768, 1280 y 1920 px de ancho. | Nada cortado ni desbordado; montos grandes completos o abreviados con valor accesible. | SC-005 |
| 20 | En Android gama media, navegar rápido entre pantallas y abrir modales. | Sin saltos visibles (perfilador de rendimiento: sin caídas sostenidas por debajo de ~50 fps). | SC-004 |

## Criterio de aceptación

La feature está lista cuando los 20 escenarios pasan en Android y web, `npm test`, lint y
typecheck pasan sin errores, y la revisión con 3 personas de SC-006 se completa.
