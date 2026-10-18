# Quickstart: validar ingresos recurrentes

## Requisitos

- Development build instalada en Android (o navegador web) y datos de prueba "completos" (Ajustes → Datos de prueba).

```bash
cd apps/mobile
npm run typecheck && npm run lint && npm test
npm start
```

## Escenarios

1. **Crear plantilla (US2)**: Finanzas → Ingresos recurrentes → "+". Crear "Honorarios", $1.200.000, mensual, día 15, cuenta de ahorros, categoría de ingreso. → Aparece en la lista con valor y día.
2. **Registrar sin cambios (US1, SC-001)**: Nuevo movimiento → Ingreso → Ingreso recurrente: "Salario" → Guardar. → Ingreso con el valor esperado en la cuenta de la plantilla; "Ingresos del mes" sube en ese valor.
3. **Registrar con otro valor (US1, FR-006)**: repetir con "Salario" y cambiar el valor antes de guardar. → El movimiento tiene el valor nuevo; la plantilla mantiene el esperado. Se muestra el aviso de que ya hay un salario este mes, y aun así se puede guardar.
4. **Cambiar el valor esperado (FR-008)**: editar "Salario" con otro valor. → Los ingresos ya registrados no cambian; el próximo prellenado usa el nuevo valor.
5. **Pausar (US2)**: pausar "Honorarios". → No aparece en el selector del formulario.
6. **Eliminar (FR-009)**: eliminar "Salario". → Desaparece de la lista y del selector; sus ingresos siguen en Movimientos y en los totales.
7. **Cambio de tipo**: seleccionar una plantilla y cambiar el tipo a Egreso. → Se quita la selección.
8. **Tema y web**: repetir el escenario 2 en modo oscuro y en web.

Detalle de reglas: [data-model.md](./data-model.md), [contracts/](./contracts/).
