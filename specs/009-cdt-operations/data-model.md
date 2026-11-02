# Data Model: Operaciones de CDT

**Feature**: 009-cdt-operations · Ver decisiones en [research.md](./research.md).

Solo se modifica la entidad **Cdt**. No hay tablas nuevas. Las entidades Account y Transaction no cambian de esquema; solo cambia cómo se usan.

## 1. Cdt (tabla `cdts`), un periodo de inversión

| Campo (dominio) | Columna | Tipo cliente / servidor | Null | Cambio | Regla |
|---|---|---|---|---|---|
| `accountId` | `account_id` | text / UUID | no | **regla** | Ya no es único. Si hay `renewedFromCdtId`, debe ser igual al `accountId` del anterior (R7). |
| `issuer` | `issuer` | text / VARCHAR(100) | no | — | |
| `certificateNumber` | `certificate_number` | text / VARCHAR(50) | sí | — | |
| `principal` | `principal` | Cents / NUMERIC(14,2) | no | — | > 0. En renovación = VF anterior ± ajuste (R4). |
| `annualRateEa` | `annual_rate_ea` | rate / NUMERIC(7,4) | no | — | (0, 100), ingresada por el usuario |
| `annualRateNominal` | `annual_rate_nominal` | rate / NUMERIC(7,4) | no | **derivada** | Ya no se ingresa. Se calcula según FR-010 y se redondea a 4 decimales (R2). |
| `termDays` | `term_days` | int | no | — | 1–3650 |
| `openedOn` | `opened_on` | date | no | — | |
| `maturesOn` | `matures_on` | date | no | **cálculo** | Por defecto `addCommercialDays(openedOn, termDays)` (R1); editable; > `openedOn` |
| `interestPayment` | `interest_payment` | text | no | — | Informativo; no altera cálculos (Q4) |
| `withholdingRate` | `withholding_rate` | rate / NUMERIC(5,2) | no | — | [0, 100), por defecto 4.00 |
| `sourceAccountId` | `source_account_id` | text / UUID | **sí** | **nullable** | `null` = CDT existente sin movimiento o renovación (R5) |
| `payoutAccountId` | `payout_account_id` | text / UUID | sí | — | Opcional (FR-018a) |
| `status` | `status` | text | no | — | Ver §3 |
| `renewedFromCdtId` | `renewed_from_cdt_id` | text / UUID | sí | — | Periodo anterior |
| `maturityValueOverride` | `maturity_value_override` | Cents / NUMERIC(14,2) | sí | **nuevo** | `null` = valor final calculado. Si no es null, debe ser ≥ `principal` (R3). |
| `settledGrossInterest` | `settled_gross_interest` | Cents / NUMERIC(14,2) | sí | **nuevo** | Se fija al renovar (FR-019a) |
| `settledWithholding` | `settled_withholding` | Cents / NUMERIC(14,2) | sí | **nuevo** | Se fija al renovar |
| `settledNetInterest` | `settled_net_interest` | Cents / NUMERIC(14,2) | sí | **nuevo** | Se fija al renovar |

**Invariantes de liquidación (cliente y servidor):**
- Los tres campos `settled*` son todos nulos o todos no nulos.
- Si no son nulos: `settledGrossInterest − settledWithholding = settledNetInterest` y los tres son ≥ 0.
- `settled*` no nulos ⇔ `status = 'RENEWED'`. El cliente siempre los fija juntos. El servidor solo valida el todo-o-nada y la aritmética, sin acoplarse al estado, para tolerar el orden de los lotes.

**Derivados (no se almacenan):**
- `maturityValue = maturityValueOverride ?? round(principal + principal·((1+EA)^(termDays/360) − 1)·(1 − ret))` (esperado; no cambia al renovar)
- `periodFinalValue = principal + settledNetInterest` si el periodo está liquidado; si no, `maturityValue`
- `origin = renewedFromCdtId ? 'RENEWAL' : sourceAccountId ? 'TRANSFER' : 'EXISTING'`
- `canRenew` según R10
- `chain`: los periodos anteriores, recorriendo `renewedFromCdtId`

## 2. Usos de Account y Transaction

| Registro | Cuándo | Campos clave |
|---|---|---|
| Account `INVESTMENT` | `createCdt` (todos los orígenes) | `openingBalance = principal` si el origen es EXISTING; `0` si es TRANSFER. Es compartida por toda la cadena de renovaciones. |
| Transaction `TRANSFER` de apertura | `createCdt` con origen TRANSFER | `source → cuenta del CDT`, `amount = principal`, `cdtId = cdt` (como hoy) |
| Transaction `INCOME` de interés | `renewCdt` | ID `v5(anterior:interest)`; en la cuenta del CDT; `amount = VF − principal anterior`; `occurredAt = maturesOn` del anterior a las 10:00 Bogotá; `cdtId = anterior` |
| Transaction `INCOME`/`EXPENSE` de diferencia | `renewCdt` con capital del banco ≠ VF ± aporte/retiro | ID `v5(nuevo:difference)`; en la cuenta del CDT; `amount` = valor absoluto de la diferencia; `cdtId = nuevo`; `occurredAt = openedOn` del nuevo. Se borra al deshacer la renovación |
| Transaction `TRANSFER` de ajuste | `renewCdt` con aporte o retiro | ID `v5(nuevo:adjustment)`. Aporte: `origen → cuenta del CDT`. Retiro: `cuenta del CDT → destino`. `cdtId = nuevo`; `occurredAt = openedOn` del nuevo |

## 3. Estados de Cdt

```text
             renewCdt                    deleteCdt(renovación B)
  ACTIVE(A) ─────────► RENEWED(A) + ACTIVE(B) ─────────► ACTIVE(A)   (se borran B, su ajuste y el interés de A; settled* de A = null)

  ACTIVE(raíz, sin sucesor) ── deleteCdt ──► borrado (CDT + cuenta + transacciones de la cuenta)
  RENEWED (con sucesor vivo) ── deleteCdt ──► rechazado ("primero borra la renovación más reciente")
```

- "Vencido pendiente de renovar" no es un estado guardado. Es `ACTIVE` con `today >= maturesOn`.
- `MATURED` y `CANCELLED` siguen existiendo en el esquema, pero esta feature no los produce (la liquidación queda fuera de alcance).

## 4. Validaciones del formulario (Zod, `domain/schemas/cdt.ts`)

**Creación y edición (`cdtFormSchema`):**
- Se quita `annualRateNominal`.
- Se añade `origin: 'TRANSFER' | 'EXISTING'`. `sourceAccountId` es obligatorio solo si el origen es TRANSFER.
- Se añade `maturityValue` (texto de monto) con la bandera `maturityValueEdited`.
- `payoutAccountId` es opcional.
- `maturityValue ≥ principal` (FR-012).

**Renovación (`cdtRenewalFormSchema`):**
- `previousMaturityValue`: ≥ principal anterior.
- `operation: 'RENEW' | 'ADD' | 'WITHDRAW'`.
- `amount`: > 0 si la operación es ADD o WITHDRAW. Con WITHDRAW, además `< previousMaturityValue`.
- `adjustmentAccountId`: obligatorio con ADD o WITHDRAW. Debe ser una cuenta ASSET que no sea INVESTMENT ni POCKET. Con WITHDRAW se prellena con `payoutAccountId`.
- `principal` (editable, R4).
- `annualRateEa`, `termDays`, `withholdingRate`, `openedOn` (por defecto `maturesOn` anterior), `maturesOn` (R1).
- `maturityValue` con su bandera de editado.
- `interestPayment` y `payoutAccountId` (nullable).

**Capa de repositorio (`cdtInputSchema`):**
- `sourceAccountId` y `payoutAccountId` son nullable.
- Se valida la aritmética de `settled*`.
- Se valida `maturityValueOverride` ≥ `principal`.
