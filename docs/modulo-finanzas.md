# Módulo de Finanzas Personales — Funcionalidades

> Fase: **MVP**. Este documento describe *qué* debe hacer el módulo. Los detalles técnicos de cada funcionalidad se desarrollan en su spec (`specs/`) con Spec Kit.

El sistema de finanzas personales debe garantizar **control operativo**, **precisión fiscal** y una **experiencia fluida** bajo un enfoque **offline-first**.

## Principios transversales

- **Offline-first:** toda operación se registra primero en Expo SQLite y se sincroniza después (ver `CLAUDE.md` → Sincronización).
- **Precisión monetaria:** montos con decimales exactos (`NUMERIC(14,2)` / `Decimal` / centavos), nunca floats. **Moneda única: COP** (sin multimoneda en el MVP); se conserva un campo `currency` para no cerrar la puerta a futuro.
- **Saldos derivados:** los saldos se calculan a partir de las transacciones; no se almacenan como valor editable.
- **Borrado lógico** en todas las entidades sincronizables.

---

## 1. Cuentas principales y subcuentas (Cajitas)

Administración de **cuentas principales** (ahorros, corriente, efectivo, inversión, etc.) y **subcuentas** asociadas jerárquicamente.

- Una subcuenta pertenece a una única cuenta principal.
- **Cajitas:** apartados de dinero dentro de una cuenta (p. ej. "Vacaciones").
- **Metas:** se diseñarán más adelante, fuera de este modelo de cuentas.
- El saldo de la cuenta principal incluye el de sus subcuentas; debe poder verse el saldo "disponible" (excluyendo lo apartado).
- Mover dinero entre cuenta y subcuenta es una **transferencia interna**.

## 2. Registro de ingresos y egresos (offline-first)

Registro **local e instantáneo** de ingresos, egresos y transferencias en el dispositivo (React Native + Expo SQLite), con **cero fricción** y sin depender de la red.

- Campos mínimos: tipo (ingreso / egreso / transferencia), monto, moneda, cuenta, fecha, descripción, categoría.
- Transferencias: cuenta origen y destino; no cuentan como ingreso ni gasto.
- Sincronización **incremental bidireccional**: PUSH y luego PULL, basado en `updated_at`/marca del servidor y tabla `sync_metadata` por entidad; conflicto resuelto con *last-write-wins*.

## 3. Tarjetas de crédito

- Modeladas como **cuentas de tipo pasivo**: su saldo representa la **deuda actual**.
- **Compras** con la tarjeta aumentan la deuda (son egresos para el presupuesto personal).
- **Pago del resumen** = **transferencia interna** desde una cuenta de ahorros/corriente hacia la tarjeta (reduce la deuda; no es un gasto nuevo).
- Datos opcionales: cupo, día de corte y día de pago (para recordatorios).

## 4. Suscripciones periódicas y registro automático

Módulo para configurar **gastos fijos recurrentes**.

- Campos: nombre, ícono, monto, periodicidad (**mensual** / **anual**), día de cobro, cuenta asociada, categoría, activa/inactiva.
- Las suscripciones se **crean y editan desde el dispositivo**, también sin conexión.
- Los débitos pueden generarse **en el dispositivo** (al abrir la app, para lo vencido sin conexión) **y en el servidor** (cron), de forma **atómica** e **idempotente**.
- Para evitar duplicados entre ambos, el ID del débito es **determinista**: UUIDv5 de `(subscription_id, periodo)`. Si cliente y servidor generan el mismo cobro, al sincronizar es el mismo registro.

## 5. Gastos reembolsables y viáticos (aislamiento del flujo de caja)

Identificación de dinero **corporativo o de terceros** para que no contamine las finanzas personales.

- El dinero de terceros **vive en las cuentas principales**; no se crea una cuenta aparte.
- Los movimientos se agrupan en un **grupo de reembolso** (p. ej. un viaje), de dos tipos:
  - **Reembolso:** pago con mi dinero y luego me devuelven.
  - **Adelanto:** me consignan un adelanto y gasto de ahí; el sobrante se devuelve o el faltante me lo reembolsan.
- Cada gasto, adelanto, reembolso o devolución es una transacción normal asociada al grupo: afecta el saldo de la cuenta, pero **no** cuenta como gasto ni ingreso personal.
- **Saldo del grupo** = ingresos del grupo − gastos del grupo: negativo = me deben; positivo = tengo dinero de terceros; cero = saldado.
- Vista propia con los grupos abiertos y lo pendiente por cobrar o devolver.

## 6. Categorización inteligente con IA

- Clasificación automática de transacciones según su descripción usando un modelo de lenguaje (p. ej. **API de Gemini**).
- Solo funciona **con conexión**; sin red, la transacción queda sin categoría o con una sugerencia local y se clasifica después.
- La llamada al modelo se hace **desde el backend** (la API key nunca va en el cliente).
- El usuario siempre puede corregir la categoría; las correcciones sirven como contexto para futuras sugerencias.

## 7. Activos, pasivos y patrimonio neto

**Patrimonio neto = Activos − Pasivos**.

- **Activos:** cuentas de efectivo/bancarias, inversiones y bienes (p. ej. vehículos: nombre, valor estimado y fecha hasta la que ese valor es válido).
- **Pasivos:** deudas de tarjetas de crédito, préstamos, etc.
- Cada cuenta/activo tiene un indicador para **excluirlo del patrimonio neto** cuando no es capital liquidable o de libre disposición personal (p. ej. una cuenta que maneja dinero ajeno).
- Vista global de salud financiera y su evolución en el tiempo.

## 8. Asistencia fiscal y alertas DIAN — *fase posterior (fuera del MVP)*

Seguimiento **dual** por año gravable (Colombia):

1. **Ingresos reales** — base para el cálculo del impuesto / base gravable. Excluye transferencias entre cuentas propias, reembolsos y dinero de terceros.
2. **Acumulado bruto** de consignaciones, depósitos y movimientos (incluidas transferencias entre cuentas propias) — para evaluar los **topes de obligatoriedad** de la declaración de renta.

- También considera los demás topes (patrimonio bruto, consumos con tarjeta de crédito, compras y consumos totales).
- Los topes se expresan en **UVT**; el valor de la UVT por año debe ser configurable.
- **Alertas tempranas** al acercarse (p. ej. 80 %) y al superar cada tope.
- Registro de **deducciones**, incluido el cálculo automático del **50 % deducible del GMF (4x1000)** pagado en el año.
- Aviso: es una herramienta de apoyo, no reemplaza asesoría contable.

## 9. Importación de extractos, auditoría y conciliación — *fase posterior (fuera del MVP)*

- Importar extractos bancarios periódicos mediante un **parser específico por tipo de extracto** (banco + formato). Arquitectura de parsers enchufables: cada uno convierte su formato a un modelo común de movimiento.
- Emparejar los movimientos del extracto con las transacciones registradas (por fecha, monto y descripción).
- Señalar **diferencias**: movimientos faltantes, duplicados o con monto distinto; y la diferencia entre el saldo del extracto y el saldo calculado.
- Permitir crear las transacciones faltantes desde el extracto y marcar el periodo como **conciliado**.

## 10. Inversiones (MVP: solo CDTs)

Seguimiento de **Certificados de Depósito a Término (CDT)**. Otros instrumentos (fondos, acciones, cripto) quedan para fases posteriores; el modelo debe permitir añadirlos sin reescrituras.

- Campos: entidad emisora, monto invertido (capital), tasa **efectiva anual (E.A.)** y tasa **nominal** (según la periodicidad de pago), plazo (días), fecha de apertura, fecha de vencimiento (calculada), modalidad de pago de intereses (al vencimiento / periódica: mensual, trimestral…), cuenta de origen y cuenta de destino al vencimiento, número de título (opcional).
- **Apertura:** transferencia interna desde una cuenta → el capital deja de estar disponible pero sigue siendo **activo**.
- **Rendimientos:** cálculo del interés proyectado y del causado a la fecha; mostrar valor actual estimado y valor esperado al vencimiento.
- **Retención en la fuente** sobre los rendimientos (porcentaje configurable) y, si aplica, GMF; registrar el neto recibido.
- **Vencimiento:** alerta días antes; al vencer, registrar el pago (capital + intereses netos) a la cuenta destino o la **renovación** (nuevo CDT encadenado al anterior).
- Registro **manual** (sin importación).
- **Integraciones:**
  - Patrimonio neto (§7): el CDT cuenta como activo por su valor actual.
  - Asistencia fiscal (§8, fase posterior): los rendimientos son **ingresos** del año gravable, la retención practicada se acumula como **retención a favor**, y el saldo al 31 de diciembre suma al **patrimonio bruto**.
- Vista resumen: total invertido, rendimiento promedio ponderado, próximos vencimientos.

## 11. Dashboard de gastos por categoría

- Gasto **mensual** y **anual** agrupado por categoría (sin presupuestos por categoría).
- Comparación con el periodo anterior y gráfica de evolución.
- Excluye transferencias internas, pagos de tarjeta y gastos reembolsables (§5).
- Calculado localmente a partir de SQLite: funciona sin conexión.

---

## Decisiones

- **Multiusuario:** desde el inicio; cada usuario ve solo sus datos.
- **Moneda:** solo COP; sin multimoneda en el MVP.
- **Suscripciones:** se crean desde el dispositivo; débitos generados en cliente y servidor con ID determinista.
- **Fuera del MVP:** asistencia fiscal DIAN (§8) e importación de extractos (§9). Extractos: un parser por tipo cuando se implemente.
- **Metas de ahorro:** se definirán más adelante.
- **Reembolsos:** grupos de reembolso (reembolso / adelanto) sobre las cuentas principales.
- **Presupuestos por categoría:** fuera del alcance; en su lugar, dashboard de gasto por categoría (§11).
- **CDTs:** registro manual.
- **Orden de implementación sugerido:** 1 → 2 → 3 → 11 → 7 → 10 → 4 → 5 → 6.
