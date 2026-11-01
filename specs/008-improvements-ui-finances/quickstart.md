# Quickstart — Validar 008 Mejoras de UI en Finanzas

## Requisitos previos

- API y PostgreSQL levantados con Docker Compose (solo hacen falta para probar la sincronización, P4-c).
- Un usuario de prueba con al menos **8 meses** de movimientos (ingresos y gastos en varias categorías, una transferencia, un pago de tarjeta y un movimiento con grupo de reembolso) y al menos un mes intermedio **sin** movimientos.
- Cliente en `apps/mobile`: `npm install`.

## Pruebas automatizadas

```bash
cd apps/mobile
npm run typecheck
npm run lint
npm test             # dominio, repos, catálogo, paleta y formulario
npm run test:tz      # mismos cálculos con TZ=Asia/Tokyo y Pacific/Honolulu
```

Cobertura esperada (ver [contracts/domain.md](contracts/domain.md) y [contracts/categories.md](contracts/categories.md)):

- Para todo periodo, ingresos y gastos coinciden entre `categoryFlowReport` y `monthSummary`, y el balance = ingresos − gastos (SC-002).
- `firstActivityMonth`, `clampPeriod`, `monthsByYear` (incluido un cambio de año), `balanceDelta` con un balance anterior negativo.
- `netWorthMonthsFor` en los cuatro rangos, con historial corto y sin datos.
- El catálogo de íconos (existencia en Ionicons, ≥ 80 entradas, defaults incluidos, búsqueda sin tildes) y la paleta (20 colores únicos, etiquetas, piso de contraste).
- `createCategory` y `updateCategory`: duplicados sin distinguir tildes ni mayúsculas, `kind` inmutable, `sortOrder` y `is_dirty = 1`.
- `TransactionForm`: el chip "+ Nueva" crea y selecciona la categoría sin perder monto, cuenta ni descripción.

## Validación manual (Android y web, modo claro y oscuro)

```bash
cd apps/mobile
npx expo start        # a: Android, w: web
```

### P1 — Selector de mes del Resumen (US1)

1. Abre Finanzas. El selector muestra el mes en curso y la flecha "siguiente" está deshabilitada.
2. Toca "anterior": las tres tarjetas cambian y sus etiquetas muestran el mes (p. ej. "Ingresos · septiembre 2026"). Comprueba los totales contra Movimientos filtrados a ese mes.
3. Toca el nombre del mes: se abre una lista agrupada por año, desde el primer mes con movimientos. Elige el mes vacío: los totales aparecen en $ 0, sin error.
4. Elige el primer mes con datos: la flecha "anterior" queda deshabilitada.
5. Con un mes anterior seleccionado, toca cada tarjeta: se abre la pantalla dedicada en **ese** mes.
6. Patrimonio y Movimientos recientes no cambian al mover el selector.
7. Toca "Mes actual" y luego reinicia la app: en los dos casos vuelve al mes en curso.

### P2 — Ingresos por categoría (US2)

1. Menú de secciones → "Ingresos por categoría". Revisa el total, la variación, la dona, la lista con % y la evolución de 6 meses.
2. Cambia a Año y navega hacia atrás. No se puede avanzar más allá del periodo en curso ni retroceder antes del primer mes con datos.
3. Toca una categoría: aparecen solo sus ingresos del periodo. Revisa que los ingresos sin categoría aparezcan como "Sin categoría" y que un periodo sin ingresos muestre estado vacío.

### P3 — Balance (US3)

1. Desde el Resumen, toca la tarjeta de balance: el mes coincide. Comprueba que balance = ingresos − gastos.
2. Navega a un mes con déficit: el balance aparece en color de egreso y con signo negativo. Si el balance anterior es negativo, la variación se muestra como diferencia absoluta.
3. Toca las filas de ingresos y gastos: llegan a sus pantallas con el mismo periodo.
4. La gráfica de 6 periodos distingue ingresos, gastos y el balance (positivo o negativo).

### P4 — Categorías (US4)

a. **Crear y editar**
   1. Menú → Categorías: dos grupos, Egresos e Ingresos.
   2. Crea "Mascotas" (egreso): busca "perro" en íconos y elige un color. La vista previa se actualiza.
   3. Intenta crear "mascotas " y "Mascótas": aparece el error de duplicado.
   4. Edita "Mascotas" (nombre y color): el tipo es de solo lectura, y el cambio se ve en Gastos por categoría y en el historial.

b. **Crear desde el formulario de movimientos**
   1. FAB → nuevo egreso. Escribe el monto y la descripción.
   2. Toca "+ Nueva", crea "Gimnasio" y guarda: vuelve al formulario con Gimnasio seleccionada y el monto y la descripción intactos.
   3. Repite y cancela: el formulario no cambia.

c. **Sin conexión y sincronización**
   1. En modo avión, crea una categoría: está disponible al instante en el formulario.
   2. Reconecta: aparece en un segundo dispositivo (o en web con el mismo usuario) tras sincronizar.

d. **Datos antiguos**: una categoría con un ícono inexistente muestra `pricetag-outline`. Una con un color fuera de la paleta se conserva al editar solo el nombre.

### P5 — Rango de Patrimonio (US5)

1. Patrimonio: la gráfica arranca en 12M y el título es "Últimos 12 meses".
2. Con 6M se ven 6 puntos; con 24M y Todo, solo los meses con historial (8 en el set de prueba), y el título de Todo es "Desde <mes año>".
3. Las etiquetas del eje no se solapan en un teléfono de 360 dp.
4. **Rendimiento (SC-006)**: con un set de 2 años y unos 3.000 movimientos en un Android de gama media, cambiar de rango tarda menos de 1 s. Si no, aplica la optimización de R12.

## Criterio de aceptación

Todos los comandos de la sección de pruebas automatizadas pasan, y los escenarios P1–P5 se cumplen en Android y web, en claro y oscuro.
