# Quickstart: validar el Dashboard de Inicio

## Prerrequisitos

- `cd apps/mobile && npm install`
- API local opcional (no es necesaria: el tablero lee solo datos locales).
- Un usuario con: 2 cuentas de ahorro, 1 tarjeta de crédito con `paymentDueDay` y deuda, 1 CDT activo que vence en ≤ 15 días, 2 suscripciones activas (una mensual con día 31, una anual), movimientos de varios meses.

## Pruebas automatizadas

```bash
cd apps/mobile
npm run typecheck
npm run lint
npm test -- upcoming dashboard
npm run test:tz          # mismos resultados con TZ=Asia/Tokyo y Pacific/Honolulu
```

Resultado esperado: todo en verde; los casos están listados en [contracts/domain.md](./contracts/domain.md).

## Validación manual

| # | Paso | Resultado esperado | Cubre |
|---|---|---|---|
| 1 | `npm run android` (o `npm run web`) e iniciar sesión | Inicio muestra saludo compacto, Patrimonio, Este mes, Próximos vencimientos y el FAB | US5-1/2 |
| 2 | Tocar el ojo del encabezado | Se muestran todos los montos; en Finanzas → Resumen también | US5-4 |
| 3 | Comparar Patrimonio con Finanzas → Patrimonio (12M) | Valor y 12 puntos iguales al centavo | SC-003 |
| 4 | Comparar Este mes con Finanzas → Balance (mes en curso) | Ingresos, gastos y balance iguales | SC-003 |
| 5 | En Finanzas → Resumen elegir un mes anterior y volver a Inicio | Este mes sigue en el mes en curso | US2-6 |
| 6 | Revisar Próximos vencimientos | Tarjeta, CDT y suscripciones ordenados por fecha con "Hoy/Mañana/En N días" y montos correctos | US4 |
| 7 | Pausar una suscripción | Desaparece de la lista sin recargar | US4-11, FR-004 |
| 8 | FAB → Gasto → guardar | Vuelve a Inicio; Este mes y Patrimonio reflejan el gasto | US3, SC-002 |
| 9 | FAB → tocar fuera / botón atrás | Se cierra el menú sin abrir formulario | US3-3 |
| 10 | FAB → Ingreso → cancelar con atrás | Vuelve a Inicio (no a Finanzas) | US3-4, R2 |
| 11 | Activar modo avión y repetir 8 | Se guarda al instante; se sincroniza al volver la red | US3-6, SC-006 |
| 12 | Web a ≥ 1024 px | Patrimonio a ancho completo; Este mes y Vencimientos lado a lado | US5-3 |
| 13 | Alternar modo claro/oscuro | Contraste legible en todos los widgets | US5-5 |
| 14 | Usuario nuevo sin datos | Patrimonio vacío con "Crear cuenta"; Vencimientos en una línea; Este mes en ceros | Edge cases |
