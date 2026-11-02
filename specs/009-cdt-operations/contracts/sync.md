# Contrato: registro `cdts` en el sync (PUSH/PULL)

El endpoint, el orden de tablas y el formato de lote no cambian (spec 004). Solo cambia el esquema del registro `cdts`. Los montos viajan como string decimal.

## `CdtRecord` (Pydantic, `apps/api/app/modules/sync/entities/cdts/schemas.py`)

```diff
  principal: MoneyStr (> 0)
  annual_rate_ea: RateStr
  annual_rate_nominal: RateStr
  ...
- source_account_id: uuid.UUID
+ source_account_id: uuid.UUID | None = None
  payout_account_id: uuid.UUID | None = None
  status: Literal[...] = "ACTIVE"
  renewed_from_cdt_id: uuid.UUID | None = None
+ maturity_value_override: MoneyStr | None = None
+ settled_gross_interest: MoneyStr | None = None
+ settled_withholding: MoneyStr | None = None
+ settled_net_interest: MoneyStr | None = None
```

**Validaciones del registro** (`_single_record_rules`, devuelven `VALIDATION_ERROR`):
- `maturity_value_override` es nulo o ≥ `principal`.
- Los `settled_*` son todos nulos o todos presentes, cada uno ≥ 0, y `gross − withholding == net`.

**Coherencia** (`CdtsSyncEntity.check_coherence`, devuelve `INCOHERENT`):
- Si `source_account_id` no es nulo, debe ser distinto de `account_id` (como hoy).
- La cuenta debe ser `INVESTMENT` (como hoy).
- **Nuevo:** si `renewed_from_cdt_id` no es nulo, `account_id` debe ser igual al `account_id` del CDT anterior. Requiere `reference_fields = {"accounts": ("type",), "cdts": ("account_id",)}`. Si el anterior viene en el mismo lote, se usa su valor del lote.

**Eliminado:** `constraint_codes["uq_cdts_account_id"]`, porque la restricción desaparece.

## Ejemplo de registro (renovación con liquidación del anterior)

```json
{
  "id": "…anterior…", "account_id": "…inv…", "status": "RENEWED",
  "principal": "10000000.00", "maturity_value_override": "10245873.00",
  "settled_gross_interest": "256117.71", "settled_withholding": "10244.71", "settled_net_interest": "245873.00",
  "source_account_id": "…ahorros…", "renewed_from_cdt_id": null, "...": "..."
}
```

```json
{
  "id": "uuidv5(anterior:renewal)", "account_id": "…inv…", "status": "ACTIVE",
  "principal": "10245873.00", "source_account_id": null, "renewed_from_cdt_id": "…anterior…",
  "maturity_value_override": null, "settled_gross_interest": null, "settled_withholding": null, "settled_net_interest": null
}
```

## Migraciones

| Lado | Migración | Contenido |
|---|---|---|
| Servidor | Alembic `0002_cdt_operations` | Ver research R9 |
| Cliente | SQLite `user_version` 2 | Reconstrucción de `cdts` (R9) |

**Compatibilidad**:
- Un registro sin los campos nuevos (cliente viejo) es válido, porque toman su valor por defecto `None`.
- Hay que desplegar la API antes que la actualización del cliente.
