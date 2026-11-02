# Contrato: pantallas y formularios

Rutas bajo `apps/mobile/src/app/(app)/(tabs)/finance/investments/`. Todo texto visible está en español. Se usan los componentes existentes de `@/components/ui` y no se añaden capas de blur nuevas.

| Ruta | Estado | Contenido |
|---|---|---|
| `new.tsx` | modificada | `CdtForm` en modo creación |
| `[id].tsx` | modificada | `CdtDetailPanel`: acciones Editar / Renovar / Borrar e historial |
| `[id]/edit.tsx` | **nueva** | `CdtForm` en modo edición (R12) |
| `[id]/renew.tsx` | **nueva** | `CdtRenewalForm` |

`[id].tsx` pasa a `[id]/index.tsx` para alojar las subrutas, igual que en `transactions/[id]/index.tsx`.

## `CdtForm` (creación y edición)

Campos en este orden:
1. Entidad
2. N.º de título
3. **Origen del dinero**: segmentado *Transferencia desde una cuenta* / *CDT existente (sin movimiento)*. Solo en creación; en edición se muestra como texto.
4. Cuenta de origen: solo si el origen es Transferencia.
5. Capital
6. TEA
7. Plazo (días)
8. Retención (%)
9. Apertura
10. Vencimiento: calculado con días comerciales y editable.
11. Pago de intereses
12. Cuenta destino al vencer: opcional, con la opción "Sin definir".
13. **Valor neto al vencimiento**: `AmountInput` prellenado con el valor calculado. Si se edita, muestra la insignia "Ajustado al banco".
14. **Tasa nominal**: solo lectura, recalculada en vivo (FR-010).

Si cambia un término (capital, TEA, plazo o retención) mientras el valor final está ajustado, aparece un aviso en línea: "El valor final fue ajustado a mano. [Recalcular]" (FR-011).

## `CdtRenewalForm`

**Sección "Periodo que termina"** (solo lectura, salvo donde se indica):
- Capital y vencimiento.
- **Valor final**: editable y prellenado con `maturityValue`.
- Interés neto, retención y bruto, derivados.

**Sección "Operación"**: segmentado *Solo renovar* / *Agregar capital* / *Retirar capital*.
- Con Agregar o Retirar se muestran Monto y Cuenta: de origen (Agregar) o de destino (Retirar, prellenada con la cuenta destino al vencer).

**Sección "Nuevo periodo"**:
- Capital: calculado y editable (R4).
- TEA (prellenada con la anterior), plazo (prellenado con el anterior) y retención.
- Inicio: por defecto el vencimiento anterior.
- Vencimiento: con días comerciales.
- Pago de intereses.
- Cuenta destino: opcional.
- N.º de título.
- Valor neto al vencimiento: editable.
- Tasa nominal: solo lectura.

**Botón**: "Renovar CDT". "Solo renovar" no exige ninguna cuenta (FR-018a).

## `CdtDetailPanel`

- **Encabezado**: insignia de estado, más "Vence en N días" o "Vencido: listo para renovar". Debajo, "Valor neto esperado al vencimiento" (con la insignia "Ajustado al banco" si aplica).
- **Tarjeta de valores**:
  - Capital, interés bruto, retención y valor neto al vencimiento.
  - Ya **no** se muestran "Interés causado a la fecha" ni "Valor actual estimado".
- **Tarjeta de datos**: como hoy, con la tasa nominal derivada y el origen ("Transferencia desde …", "CDT existente" o "Renovación de …").
- **Acciones**:
  - *Editar*: solo en el periodo vigente.
  - *Renovar*: deshabilitado con el texto "Disponible desde el {fecha}" si `!canRenew`.
  - *Borrar*: diálogo de confirmación "Se borrará el CDT y N movimientos asociados". Si no se permite, muestra el motivo.
  - *Registrar vencimiento*: sigue deshabilitado, con el texto "Disponible próximamente".
- **Historial** (si la cadena tiene más de un periodo): un renglón por periodo con apertura → vencimiento, capital, TEA y valor final.

## Lista (`CdtListItem`)

Muestra el valor neto esperado al vencimiento en lugar del valor actual, y la insignia "Listo para renovar" si `canRenew`. Los periodos `RENEWED` no se listan por separado: se ven en el historial del vigente.
