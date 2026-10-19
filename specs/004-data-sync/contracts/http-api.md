# Contrato HTTP: Sincronización

Base: `/api/v1`. Las dos rutas exigen `Authorization: Bearer <access token>`; sin él responden `401 UNAUTHENTICATED` con el sobre de error común de la spec 003. JSON en camelCase, fechas ISO-8601 UTC con `Z`, montos como string.

Tablas válidas: `accounts`, `categories`, `reimbursement_groups`, `subscriptions`, `recurring_incomes`, `cdts`, `assets` y `transactions`. Formato de cada registro: [data-model.md](../data-model.md) §2.

---

## `POST /sync/push`

Aplica los cambios locales con last-write-wins y devuelve el resultado de cada registro.

### Request

```json
{
  "changes": {
    "accounts": [
      {
        "id": "6f1c2b9e-1d3a-4c55-9a77-0b1f6a2d9e10",
        "parentAccountId": null,
        "name": "Bancolombia Ahorros",
        "type": "SAVINGS",
        "nature": "ASSET",
        "currency": "COP",
        "icon": null,
        "color": null,
        "openingBalance": "1500000.00",
        "creditLimit": null,
        "statementDay": null,
        "paymentDueDay": null,
        "isExcludedFromNetWorth": false,
        "isArchived": false,
        "sortOrder": 0,
        "createdAt": "2026-10-18T14:00:00Z",
        "updatedAt": "2026-10-18T14:00:00Z",
        "deletedAt": null
      }
    ],
    "transactions": [
      {
        "id": "0e7a6a52-5b1f-4f0e-8a51-2b0a4f9c1d22",
        "accountId": "6f1c2b9e-1d3a-4c55-9a77-0b1f6a2d9e10",
        "counterAccountId": null,
        "type": "EXPENSE",
        "amount": "45000.00",
        "categoryId": "a3d9…",
        "categorySource": "MANUAL",
        "occurredAt": "2026-10-18T13:45:00Z",
        "description": "Almuerzo",
        "reimbursementGroupId": null,
        "subscriptionId": null,
        "subscriptionPeriod": null,
        "recurringIncomeId": null,
        "recurringIncomePeriod": null,
        "cdtId": null,
        "createdAt": "2026-10-18T13:46:00Z",
        "updatedAt": "2026-10-18T13:46:00Z",
        "deletedAt": null
      }
    ]
  }
}
```

- `changes` es obligatorio; cada tabla es opcional y puede ir vacía.
- El orden de las tablas y de los registros no importa: el servidor aplica en orden de dependencias.
- `userId`, `serverUpdatedAt` e `isDirty` se ignoran si vienen en un registro.

### Response `200 OK`

Siempre hay un resultado por cada registro recibido, aunque todos sean rechazados.

```json
{
  "results": [
    { "table": "accounts", "id": "6f1c2b9e-…", "status": "APPLIED" },
    { "table": "transactions", "id": "0e7a6a52-…", "status": "REJECTED",
      "code": "INCOHERENT",
      "message": "Un gasto solo puede usar una categoría de gasto." }
  ],
  "serverTime": "2026-10-18T14:00:01.234Z"
}
```

| `status` | Qué hace la app |
|---|---|
| `APPLIED` | Marca el registro como sincronizado (`is_dirty = 0`). |
| `DISCARDED` | Marca el registro como sincronizado; la versión ganadora llega en el PULL siguiente. |
| `REJECTED` | Lo deja pendiente y muestra o registra el motivo. Con `CLOCK_AHEAD`, pide revisar la fecha del dispositivo. |

Códigos de rechazo: `VALIDATION_ERROR` (con `details`), `INVALID_REFERENCE`, `DEPENDENCY_REJECTED`, `INCOHERENT`, `DUPLICATE`, `ID_CONFLICT` y `CLOCK_AHEAD`. Significado en [data-model.md](../data-model.md) §3.

### Errores de toda la petición (no se aplica nada)

| HTTP | `code` | Cuándo |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Sin sesión o con el token vencido. |
| 413 | `PUSH_TOO_LARGE` | Más de 500 registros o un cuerpo de más de 2 MB. |
| 422 | `VALIDATION_ERROR` | El sobre es inválido: falta `changes`, hay una tabla desconocida o una tabla no es una lista. |

### Garantías

- **Idempotente**: reenviar el mismo cuerpo deja el mismo estado. Los registros ya aplicados vuelven como `DISCARDED`, porque su `updatedAt` es igual al almacenado.
- **Atómico solo por registro**: un `REJECTED` nunca revierte otros registros, salvo los que dependen de él (`DEPENDENCY_REJECTED`).
- Los cambios están confirmados antes de enviar la respuesta.

---

## `POST /sync/pull`

Devuelve los registros cambiados desde cada cursor, incluidos los borrados lógicos. No modifica datos. Usa POST porque lleva un objeto de cursores.

### Request

```json
{
  "cursors": {
    "accounts": "eyJ0IjoiMjAyNi0xMC0xOFQxNDowMDowMS4xMDBaIiwiaWQiOiI2ZjFj…In0",
    "transactions": null
  }
}
```

- `cursors` es opcional. Una tabla sin clave o con `null` se trae completa (primer sync).
- El cuerpo `{}` equivale al primer sync de todas las tablas.

### Response `200 OK`

```json
{
  "changes": {
    "categories": {
      "records": [
        { "id": "a3d9…", "name": "Transporte", "kind": "EXPENSE", "icon": null, "color": null,
          "sortOrder": 0, "createdAt": "…", "updatedAt": "…", "deletedAt": null,
          "serverUpdatedAt": "2026-10-18T12:00:00.000123Z" }
      ],
      "cursor": "eyJ0Ijoi…",
      "hasMore": false
    },
    "accounts": { "records": [], "cursor": "eyJ0Ijoi…", "hasMore": false }
  },
  "hasMore": false
}
```

- **Las ocho tablas** aparecen siempre, en orden de dependencias.
- `cursor` es la posición nueva de cada tabla. Si no hubo cambios, se devuelve el mismo cursor recibido (o `null` si la tabla está vacía y no había cursor).
- `hasMore` existe por tabla y en total. Mientras `hasMore` total sea `true`, la app repite el PULL con los cursores nuevos.
- Como máximo 1000 registros por respuesta, sumando todas las tablas.
- **La app guarda los cursores en `sync_metadata` solo cuando el ciclo termina** (`hasMore = false`) y ya aplicó los registros en su base local.

### Errores

| HTTP | `code` | Cuándo |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Sin sesión. |
| 422 | `INVALID_CURSOR` | Un cursor mal formado. `details` indica la tabla; la app hace sync completo de esa tabla. |
| 422 | `VALIDATION_ERROR` | Una tabla desconocida en `cursors`. |

### Garantías

- Solo datos del usuario de la sesión, sin `userId`.
- Ningún cambio confirmado queda detrás de un cursor entregado, aunque haya un PUSH concurrente (research S1).
- Sin repeticiones ni omisiones entre páginas, aunque varios registros compartan `serverUpdatedAt`.

---

## Flujo de la app (referencia)

```
1. POST /sync/push  con todos los registros is_dirty=1 (en trozos de ≤500)
   → APPLIED / DISCARDED: is_dirty = 0
2. POST /sync/pull  con los cursores de sync_metadata
   → aplicar registros localmente (sobrescribir por id) y repetir mientras hasMore
3. Guardar los cursores nuevos en sync_metadata
```

Si la app recibe un 401 en cualquier paso, renueva la sesión y reintenta: todo es idempotente.
