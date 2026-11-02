# Quickstart: validar Operaciones de CDT

## Prerrequisitos

- API y PostgreSQL en marcha (`docker compose up`), con la migración `0002_cdt_operations` aplicada (Alembic corre al arrancar).
- App en Android o web (`cd apps/mobile && npx expo start`), con sesión iniciada y al menos dos cuentas de activo, por ejemplo "Ahorros" y "Nómina".

## Pruebas automatizadas

```bash
cd apps/mobile
npm test -- lib/dates cdtValuation cdts cdtsRepo schema   # dominio, repositorio y migración 2
npm run test:tz                                            # independencia de la zona del dispositivo
npm run typecheck && npm run lint

cd ../api
uv run pytest tests/unit/sync tests/integration/sync -k cdt   # esquema, coherencia y migración
uv run ruff check . && uv run mypy app
```

Lo que deben cubrir (ver [contracts/domain.md](./contracts/domain.md) y [contracts/sync.md](./contracts/sync.md)):

- `addCommercialDays` coincide con el oráculo `helpComercialDays` en todo el rango 2024–2030 × 1–360 días y con la tabla de FR-001.
- `settlement`: `bruto − retención = neto` exacto en todos los casos de prueba.
- `renewCdt` y `deleteCdt` son atómicos, usan IDs deterministas y restauran los saldos.
- El servidor acepta CDTs sin origen y renovaciones en la misma cuenta, y rechaza: cuenta distinta en una renovación, `settled_*` incoherentes y override menor que el capital.

## Recorrido manual

1. **Vencimiento comercial (US1)**: nuevo CDT con apertura 2026-01-31 y plazo 30 → el vencimiento propuesto es **2026-03-03**. Con 2026-01-15 y 90 → **2026-04-15**.
2. **CDT existente (US2)**:
   - Elegir "CDT existente (sin movimiento)": desaparece la cuenta de origen.
   - Capital 5.000.000 y apertura 2026-06-01, plazo 90 → se guarda.
   - Los saldos de Ahorros y Nómina no cambian; el patrimonio sube 5.000.000.
   - Como venció el 2026-09-01, "Renovar" está habilitado.
3. **Valor final editable (US3)**:
   - Capital 10.000.000, TEA 10 %, 180 días, retención 4 % → valor neto calculado = 10.000.000 + 10.000.000·(1.1^0.5 − 1)·0.96 = **10.468.564,94**. Tasa nominal = **9,7618 %**.
   - Editar el valor final a 10.470.000 → aparece "Ajustado al banco" y la nominal cambia.
   - Cambiar la TEA → aparece el aviso con "Recalcular".
4. **Renovar (US5)**:
   - Abrir el CDT existente del paso 2.
   - *Agregar capital* 1.000.000 desde Ahorros → el nuevo capital es VF + 1.000.000.
   - Ahorros baja 1.000.000 y aparece un ingreso por el interés neto.
   - El historial muestra 2 periodos. El nuevo periodo tiene "Renovar" deshabilitado, con "Disponible desde el …".
   - *Retirar capital* por un monto ≥ VF (en otro CDT vencido) → se bloquea con "El nuevo capital debe ser mayor que cero".
   - *Solo renovar* sin cuentas → se confirma.
5. **Borrar (US4)**:
   - Intentar borrar el periodo anterior → se rechaza con "Primero borra la renovación más reciente".
   - Borrar la renovación → el periodo anterior vuelve a "listo para renovar", Ahorros recupera 1.000.000 y el ingreso por interés desaparece.
   - Borrar el CDT del paso 3, creado por transferencia → la cuenta de origen recupera exactamente su saldo anterior.
6. **Sync**:
   - Repetir el paso 4 sin conexión, reconectar → en un segundo dispositivo se ven el mismo periodo nuevo, el ingreso y la liquidación (`settled_*`).
   - Renovar el mismo CDT en dos dispositivos sin conexión y sincronizar ambos → queda **un solo** periodo nuevo y **un solo** ingreso (IDs deterministas).

## Despliegue

1. **Primero la API**: desplegar en Coolify. Al arrancar, Alembic aplica `0002_cdt_operations`: `source_account_id` pasa a admitir nulos, se elimina `uq_cdts_account_id` y se crean 4 columnas de montos con sus checks. Verificar `GET /health` y que `alembic current` muestre `0002`.
2. **Después el cliente**: publicar la actualización OTA (`eas update`). Al abrir la app, la migración local 2 reconstruye la tabla `cdts` en SQLite.
3. **Por qué en este orden**: una app con la versión anterior que haga pull de un CDT sin cuenta de origen fallaría por su `NOT NULL` local. Esos CDTs solo los crea la app nueva, así que basta con que la API se actualice primero (research R9).
4. **Rollback**: `alembic downgrade 0001` solo funciona si no hay CDTs sin origen ni renovaciones. En otro caso, revertir solo el cliente.
