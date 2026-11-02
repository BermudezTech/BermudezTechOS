# Research: Operaciones de CDT

**Feature**: 009-cdt-operations · **Fecha**: 2026-11-01 · **Spec**: [spec.md](./spec.md)

No quedan `NEEDS CLARIFICATION` en el Technical Context. Cada decisión se registra como Decisión / Razón / Alternativas.

---

## R1. Fecha de vencimiento en días comerciales

**Decisión**: nueva función pura `addCommercialDays(openedOn: IsoDate, termDays: number): IsoDate` en `apps/mobile/src/lib/dates.ts`, con aritmética de calendario (sin `Date` local):

```
m = floor(termDays / 30)
extra = Σ_{k=0..m-1} (díasDelMes(mesApertura + k) − 30)   // mes y año avanzan juntos
vencimiento = addDays(openedOn, termDays + extra)
```

Reemplaza a `defaultMaturesOn` (que hoy hace `addDays(openedOn, termDays)`).

**Razón**: reproduce `helpComercialDays` del usuario y quita su límite de 24 meses. La función original usa `new Date(year, month, 0)` con meses de 1 a 24. Por el desborde de `Date`, eso ya recorre bien el año siguiente, así que la versión general da resultados idénticos dentro de ese rango. Al no depender de `Date` local, el resultado no cambia con la zona horaria del dispositivo (`npm run test:tz`).

**Pruebas**: la función original se copia **tal cual** como oráculo en `lib/dates.commercial.test.ts`. Se compara contra ella para fechas de apertura entre 2024-01-01 y 2030-12-31. La comparación completa (todas las fechas × plazos de 1 a 360 días) se ejecutó una vez en la implementación sin diferencias. La suite permanente usa una muestra para no tardar 40 s: todas las fechas con 15 plazos típicos, y todos los plazos de 1 a 360 para los días 1, 15 y 28–31. Además se prueban la tabla de FR-001 y, para plazos de hasta 3650 días, lo que el original no cubre: múltiplos de 30 → mismo día *m* meses después, cuando ese día existe.

**Alternativas**: `date-fns.addMonths` + días sobrantes. Se rechazó porque ajusta al fin de mes (31-ene + 30 → 28-feb) y la clarificación Q1 exige replicar la función tal cual (→ 03-mar).

## R2. Base de cálculo y tasa nominal

**Decisión** (`domain/cdtValuation.ts`, reescrito):

- `grossInterest(principal, ea, termDays) = principal × ((1 + ea)^(termDays/360) − 1)` con Decimal, sin redondear hasta el final.
- `calculatedMaturityValue = round(principal + gross × (1 − withholding))` en centavos (`fromDecimal`).
- `maturityValue(cdt) = cdt.maturityValueOverride ?? calculatedMaturityValue(cdt)`.
- `nominalFromEa(ea, termDays) = ((1 + ea)^(termDays/360) − 1) × 360/termDays`.
- `nominalFromMaturityValue(principal, value, withholding, termDays) = ((value − principal) / (1 − withholding)) / principal × 360/termDays`.
- La tasa nominal se guarda redondeada a 4 decimales (columna `rate`, `NUMERIC(7,4)`). Es la de FR-010(b) si hay override y la de FR-010(a) si no. Se recalcula y persiste en cada creación, edición o renovación. No es un campo del formulario.
- Se eliminan `accruedInterest`, `currentValue` y `elapsedDays` (FR-013).

**Razón**: clarificaciones Q3 (base 360) y Q4 (siempre nominal con pago al vencimiento). Guardar la nominal derivada mantiene el detalle y los datos sincronizados iguales a lo mostrado en el formulario.

**Alternativas**: calcular la nominal solo al mostrarla. Se rechazó porque obliga a repetir el cálculo en el servidor y en specs futuras (impuestos), y el valor del formulario podría diferir del guardado.

## R3. Valor final editable: representación

**Decisión**: nueva columna `maturity_value_override` (money, nullable).

- `NULL` → el valor final es el calculado (R2) y se actualiza solo cuando cambian capital, TEA, plazo o retención.
- Distinto de `NULL` → valor indicado por el banco, al centavo. En el formulario es el estado "ajustado a mano" (FR-011).

El formulario guarda override solo si el usuario editó el campo. Si después cambia un término, se muestra un aviso con "Recalcular", que pone el override en `NULL`.

**Razón**: un solo campo nullable expresa "calculado vs. ajustado" sin bandera extra ni backfill. Los CDTs legados quedan en `NULL`, es decir, calculados.

**Alternativas**: columna `maturity_value` siempre poblada más una bandera `is_overridden`. Se rechazó porque exige backfill en cliente y servidor y mantener ambos campos coherentes.

## R4. Capital editable en la renovación

**Decisión** (revisada el 2026-11-02): el capital nuevo se propone como `VF ± monto` y sigue a esos campos mientras el usuario no lo edite. Si lo edita con el valor del banco, la diferencia `capitalNuevo − (VF ± monto)` se registra como una transacción propia: `INCOME` si es positiva, `EXPENSE` si es negativa. Su ID determinista es `v5("<nuevoId>:difference")`; va en la cuenta del CDT, con `cdtId = nuevo` y fecha = inicio del nuevo periodo. Así el saldo de la cuenta del CDT sigue siendo igual al capital (SC-004).

**Razón**: cada movimiento y cada cierre de periodo mantienen sus datos íntegros. Editar el periodo nuevo no reescribe el anterior.

**Alternativas**:
- Recalcular hacia atrás el VF anterior. Era la versión inicial; se rechazó porque modificaba el cierre del periodo anterior.
- Capital no editable.
- Capital libre sin movimiento, que descuadra el saldo.

## R5. Origen del dinero: CDT existente sin movimiento

**Decisión**:

- `sourceAccountId` pasa a ser **nullable**. El origen se deriva así:
  - `renewedFromCdtId != null` → renovación.
  - `sourceAccountId != null` → transferencia (se crea la transferencia de apertura, como hoy).
  - Ninguno → existente: la cuenta INVESTMENT se crea con `openingBalance = principal` y sin transacción.
- El formulario muestra un selector "Origen del dinero" con *Transferencia desde una cuenta* / *CDT existente (sin movimiento)*. La cuenta de origen solo se muestra y exige con la primera opción.

**Razón**: el saldo inicial de cuenta ya existe y ya se cuenta en saldos y patrimonio (FR-005). No hace falta una columna `funding_source`, porque el origen se deduce sin ambigüedad.

**Alternativas**:
- Columna `funding_source`: redundante.
- Transacción de "ajuste de saldo": crearía un ingreso ficticio en los reportes.

## R6. Renovación: registros generados e IDs deterministas

**Decisión**: `renewCdt(id, input)` en `cdtsRepo.ts` hace en un solo `batch` (atómico, FR-019):

1. **Interés neto** del periodo que cierra: transacción `INCOME` en la cuenta del CDT.
   - Monto: `VF − capitalAnterior`. Se omite si es 0.
   - Fecha: `maturesOn` a las 10:00 Bogotá. `cdtId = anterior`. Categoría: la primera de ingreso activa cuyo nombre contenga "interés" o "rendimiento" (sin distinguir mayúsculas ni tildes); si no hay, `null` ("Sin categoría").
2. **Liquidación** en el CDT anterior (FR-019a):
   - `settledNetInterest = VF − capital`.
   - `settledGrossInterest = round(neto / (1 − ret))`.
   - `settledWithholding = bruto − neto`. Así bruto − retención = neto exacto en centavos.
   - Además `status = 'RENEWED'`. El `maturityValueOverride` del anterior **no** se toca: el valor real del cierre vive solo en `settled*` (valor final = `principal + settledNetInterest`), y deshacer la renovación devuelve exactamente el valor esperado original.
3. **Nuevo periodo**:
   - Mismo `accountId`, `renewedFromCdtId = anterior` y `sourceAccountId = null`.
   - Copia `issuer`, `interestPayment` y `payoutAccountId`; los dos últimos se pueden editar.
   - Capital según R4. Nominal y vencimiento según R1/R2.
4. **Ajuste** (si la operación es agregar o retirar): `TRANSFER` desde la cuenta de origen hacia la del CDT, o desde la del CDT hacia la de destino. `cdtId = nuevo` y fecha = `openedOn` del nuevo periodo.

IDs **deterministas (UUIDv5)** con un namespace propio de CDT:

- nuevo periodo = `v5("<anteriorId>:renewal")`
- interés = `v5("<anteriorId>:interest")`
- ajuste = `v5("<nuevoId>:adjustment")`
- diferencia de capital = `v5("<nuevoId>:difference")` (R4)

Si se renueva el mismo CDT en dos dispositivos sin conexión, los registros chocan por ID y gana el último (LWW) en vez de duplicarse. Esto cubre el caso borde "conflicto de renovación offline" sin lógica extra en el servidor.

El helper síncrono `uuidV5(namespace, name)` se añade a `apps/mobile/src/lib/ids.ts` con un SHA-1 en TypeScript puro (unas 40 líneas, sin dependencias). `expo-crypto` solo ofrece digest asíncrono sobre bytes, y está mockeado en `jest.setup.tsx` sin digest, así que no sirve aquí. Se verifica con vectores generados con `uuid.uuid5` de Python, que ya se usa en `debit_ids.py`; por ejemplo, el de `NAMESPACE_DNS` + `"python.org"`.

**Razón**: atomicidad (constitución, FR-011 heredado), idempotencia (principio II) y saldo continuo en la misma cuenta (FR-020).

**Alternativas**:
- Cuenta INVESTMENT nueva por periodo con una transferencia de saldo: duplica cuentas y rompe el historial.
- IDs aleatorios: duplicarían ingresos en conflictos offline.

## R7. Una cuenta INVESTMENT para toda la cadena

**Decisión**:

- Se elimina la restricción `uq_cdts_account_id` (servidor).
- Nueva regla de coherencia en `CdtsSyncEntity`: si `renewed_from_cdt_id` no es nulo, `account_id` debe ser igual al del CDT anterior. Para eso se añade `"cdts": ("account_id",)` a `reference_fields`.
- En el cliente, `createCdt` sigue creando siempre una cuenta nueva y `renewCdt` reutiliza la del anterior.
- `check_coherence` deja de comparar origen con cuenta cuando `source_account_id` es nulo.

**Razón**: FR-020. La regla impide que un CDT ajeno "se cuelgue" de la cuenta de otro, sin necesidad de un índice único parcial.

**Alternativas**:
- Índice único parcial `(account_id) WHERE status='ACTIVE' AND deleted_at IS NULL`: haría rechazar (DISCARDED) un lado del conflicto offline, cuando R6 ya lo resuelve por ID.
- Mantener 1:1 con cuentas por periodo: rechazada en R6.

## R8. Borrado en cascada

**Decisión**: `deleteCdt(id)` en un solo `batch`, en tres casos:

- **Tiene sucesor vivo** (otro CDT no borrado con `renewedFromCdtId = id`): `ValidationError` con el mensaje "Primero borra la renovación más reciente" (FR-016).
- **Es renovación**:
  - Se borran lógicamente el CDT y sus transacciones (`cdtId = id`, es decir, el ajuste).
  - En el anterior: `status = 'ACTIVE'`, `settled* = null` y `maturityValueOverride` se conserva.
  - Se borra la transacción de interés del anterior (`cdtId = anterior`, `type = INCOME`).
- **Es raíz** (sin anterior, por lo tanto el único de su cadena):
  - Se borran lógicamente el CDT, su cuenta INVESTMENT y todas las transacciones con `cdtId = id` o que toquen esa cuenta (`accountId` o `counterAccountId`).
  - Así el saldo de las otras cuentas vuelve exacto (SC-005) y no quedan movimientos huérfanos.

`cdtDeletionPreview(id)` devuelve `{ allowed, reason?, transactionCount }` para el diálogo de confirmación (FR-014).

El servidor no necesita reglas nuevas: el sync ya acepta borrados lógicos, y las referencias a registros borrados se resuelven porque `fetch_refs` incluye los borrados.

**Razón**: clarificación Q6 (borrar todo).

**Alternativas**: borrar solo el CDT. Se rechazó en la clarificación.

## R9. Columnas nuevas y migraciones

**Decisión**:

- **Servidor**: migración Alembic `0002_cdt_operations`.
  - `source_account_id` pasa a `NULL`.
  - `DROP CONSTRAINT uq_cdts_account_id` y `CREATE INDEX ix_cdts_user_id_account_id`.
  - Nuevas columnas `maturity_value_override`, `settled_gross_interest`, `settled_withholding` y `settled_net_interest` (todas `NUMERIC(14,2) NULL`).
  - Checks:
    - `settled_all_or_none`
    - `settled_consistent` (`settled_gross_interest - settled_withholding = settled_net_interest`)
    - `settled_non_negative`
    - `maturity_value_gte_principal` (`maturity_value_override IS NULL OR maturity_value_override >= principal`)
  - `downgrade` revierte, siempre que no haya CDTs sin origen.
- **Cliente**: migración SQLite 2 en `db/schema.ts` que **reconstruye** `cdts`:
  - `CREATE TABLE cdts_new` con el esquema actual de `TABLE_COLUMNS`.
  - `INSERT … SELECT` con la lista **explícita** de columnas de la versión 1.
  - `DROP`, `RENAME` y se recrea `idx_cdts_dirty`.

  SQLite no permite cambiar `NOT NULL` con `ALTER`. Además, `migration1` se genera a partir de `TABLE_COLUMNS`, así que en una instalación nueva ya crea la tabla con las columnas nuevas. La reconstrucción con columnas explícitas funciona en ambos casos.
- **Mappers**: `sync/tables.ts` añade las 4 columnas (`money`, nullable) y marca `source_account_id` como nullable. Los mappers fila↔entidad↔API son declarativos y no cambian.

**Razón**: el principio IV pide montos exactos; los principios I y II piden que los campos nuevos viajen por el sync existente.

**Orden de despliegue**: primero la API (migración), luego la actualización OTA del cliente. Un cliente viejo que haga pull de un CDT sin origen fallaría por su `NOT NULL` local, pero esos CDTs solo los crean clientes nuevos.

**Alternativas**: tabla nueva `cdt_settlements` para la liquidación. Se rechazó por ser una tabla sincronizable más (registro, orden, mappers) para una relación 1:1 con el periodo. Las columnas bastan y quedan disponibles para la spec de impuestos.

## R10. Disponibilidad de "Renovar" y "hoy"

**Decisión**: `canRenew(cdt, cdts, today) = status === 'ACTIVE' && !deletedAt && today >= maturesOn && !hasLiveSuccessor`, con `today = todayLocal()` (America/Bogota). La UI muestra "Disponible desde el {maturesOn}" cuando falta.

**Razón**: FR-017 y clarificación Q2 (inclusive).

## R11. Valoración en patrimonio y vistas

**Decisión**:

- `netWorth.ts`: cada CDT vivo vale `principal` (ya no `currentValue`). Se elimina `paidInterest`.
- `cdtValues()` deja de exponer `accrued` y `currentValue`, y añade `maturityValue`, `isOverridden`, `canRenew` y `chain` (periodos anteriores).
- `CdtDetailPanel`:
  - Retira "Interés causado" y "Valor actual estimado".
  - El encabezado muestra "Valor neto esperado al vencimiento".
  - Se añaden los botones "Borrar" y "Editar" y la sección "Historial".
  - "Renovar" se habilita según R10. "Registrar vencimiento" sigue deshabilitado (fuera de alcance).

**Razón**: FR-013 y FR-022. Entre renovaciones el saldo de la cuenta INVESTMENT coincide con `principal`, porque el interés solo se registra al renovar.

## R12. Edición de un CDT

**Decisión**: nueva ruta `investments/[id]/edit.tsx`, que reutiliza `CdtForm` en modo edición. Solo se edita el periodo vigente (sin sucesor vivo) y el origen no se puede cambiar. Si cambia el capital:

- CDT con origen transferencia: se actualiza el monto de la transferencia de apertura.
- CDT existente: se actualiza el `openingBalance` de la cuenta.
- Renovación: **no** se edita el capital aquí. Se borra la renovación (se deshace) y se renueva de nuevo; el formulario de renovación ya aplica R4. *(Ajuste hecho en la implementación: evita reescribir la liquidación del periodo anterior desde la edición.)*

Todo en un `batch`.

**Razón**: la spec prevé que los CDTs legados corrijan su vencimiento "editando el CDT", y hoy no hay pantalla de edición. Es la vía para ajustar el valor final de CDTs ya registrados.

**Alternativas**: dejar la edición fuera. Se rechazó porque los CDTs legados quedarían con un vencimiento erróneo sin forma de corregirlo.
