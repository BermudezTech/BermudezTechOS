# Contrato: FinanceRepository (ampliación)

Se añade a `FinanceRepository` (ver [spec 001](../../001-finance-ui-mockup/contracts/finance-repository.md)). Errores con `ValidationError(code, field, message)`.

```ts
createRecurringIncome(input: RecurringIncomeInput): Promise<RecurringIncome>;
updateRecurringIncome(id: string, patch: Partial<RecurringIncomeInput>): Promise<RecurringIncome>;
setRecurringIncomeStatus(id: string, status: 'ACTIVE' | 'PAUSED'): Promise<void>;
deleteRecurringIncome(id: string): Promise<void>; // borrado lógico; no toca transacciones
```

| Código | Cuándo |
|---|---|
| `NOT_FOUND` (`accountId`) | Cuenta inexistente o borrada. |
| `CATEGORY_KIND_MISMATCH` (`categoryId`) | Categoría que no es de ingreso. |
| `NOT_FOUND` (`id`) | Plantilla inexistente o borrada al editar. |

**Transacciones** (`createTransaction` / `updateTransaction`): aceptan `recurringIncomeId` y `recurringIncomePeriod`.

| Código | Cuándo |
|---|---|
| `RECURRING_INCOME_TYPE` (`recurringIncomeId`) | Vínculo con `type ≠ INCOME`. |
| `NOT_FOUND` (`recurringIncomeId`) | Plantilla que nunca existió. |
| `INVALID_PERIOD` (`recurringIncomePeriod`) | Falta el periodo con vínculo, o al revés. |

Cambiar `expectedAmount` o borrar la plantilla **nunca** modifica transacciones existentes (FR-008, FR-009).
