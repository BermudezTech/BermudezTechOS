# Quickstart: validar el débito automático y la zona horaria única

Guía para comprobar de punta a punta que la feature funciona. Los detalles de comandos, variables y log están en [contracts/billing-service.md](./contracts/billing-service.md); el mapeo de columnas, en [data-model.md](./data-model.md); y el comportamiento de fechas de la app, en [contracts/app-dates.md](./contracts/app-dates.md).

## Requisitos

- Docker y Docker Compose.
- `uv` (para `apps/api`) y Node/npm (para `apps/mobile`).
- `.env` en la raíz, copiado de `apps/api/.env.example`, con `BILLING_ACTIVATION_DATE` definida. Para estas pruebas conviene una fecha unos días anterior a hoy, por ejemplo el día 1 del mes en curso.

## 1. Pruebas automatizadas

```sh
cd apps/api
uv run pytest tests/unit/subscription_debits tests/integration/subscription_debits
uv run ruff check . && uv run mypy app

cd ../mobile
npm test
npm run test:tz        # la suite completa con TZ=Asia/Tokyo y TZ=Pacific/Honolulu
npm run typecheck
```

Todo debe pasar. `test:tz` no debe requerir cambios en los valores esperados (FR-030).

## 2. Levantar la composición

```sh
docker compose up --build -d
docker compose ps          # db, api y billing en estado "healthy"
docker compose logs billing
```

Esperado en el log de `billing`: la línea de arranque con la activación, la hora y la próxima ejecución, y el `Resumen de cobros … trigger=startup`.

## 3. Cobro del día (US1)

1. En la app, con un usuario de prueba, crea una suscripción mensual `ACTIVE` con el día de cobro de hoy (según Bogotá) y sincroniza.
2. Ejecuta: `docker compose exec billing python -m app.modules.subscription_debits run`
3. El resumen debe mostrar `creados=1`.
4. Sincroniza la app. Aparece un egreso de hoy por el monto de la suscripción, en su cuenta y con su nombre.
5. En la base, el egreso tiene:
   - `id` = UUIDv5 de `"<subscription_id>:<YYYY-MM>"`;
   - `subscription_period` = mes actual;
   - `occurred_at` = hoy a las 05:00Z.

## 4. Idempotencia (US2)

1. Repite `run` dos veces, y después dos a la vez:
   ```sh
   docker compose exec billing python -m app.modules.subscription_debits run & docker compose exec billing python -m app.modules.subscription_debits run; wait
   ```
   Esperado: `creados=0` y `existentes=1`. En la base hay una sola fila para esa suscripción y periodo.
2. Borra el egreso en la app, sincroniza y vuelve a ejecutar `run`. Esperado: no reaparece (`existentes=1`).

## 5. Vencidos del periodo y activación (FR-007, FR-007a)

1. Crea una suscripción con día de cobro anterior a hoy y posterior a `BILLING_ACTIVATION_DATE`, con `start_date` anterior a ese día. `run` la cobra con `occurred_at` en su día de cobro, no hoy.
2. Crea otra con día de cobro anterior a `BILLING_ACTIVATION_DATE`. `run` no la cobra (`no_vencidos`).
3. `run --date <mañana>` sale con código 2 y no escribe nada.
4. Sin `BILLING_ACTIVATION_DATE`, `docker compose up billing` falla con el error de configuración que nombra la variable.

## 6. Exclusiones (US3)

Con suscripciones `PAUSED`, `CANCELLED`, borradas o con `start_date` futura, y con día de cobro hoy, `run` no crea nada para ellas. Con la cuenta borrada, el log muestra `Cobro omitido … cuenta no disponible`. Con la cuenta archivada, sí se cobra.

## 7. Operación (US4)

- `docker compose exec billing python -m app.modules.subscription_debits health; echo $?` → `0`.
- `docker compose stop db`: `billing` registra los errores de conexión y reintenta. Al levantar `db`, la siguiente ejecución termina bien.
- El log no contiene montos, nombres de suscripciones, correos ni la URL de la base.

## 8. Zona horaria (US5)

1. **Web:** abre la app en el navegador con la zona emulada en `Asia/Tokyo` (DevTools → Sensors → Location/Timezone override).
   - Registra un movimiento sin cambiar la fecha propuesta. La fecha propuesta es hoy en Bogotá y el movimiento aparece en "Hoy" y en el mes de Bogotá.
   - El cobro del paso 3 aparece en su fecha de cobro.
2. **Android:** cambia la zona del dispositivo (Ajustes → Fecha y hora) a `Europe/Madrid`. Entre las 18:00 y las 23:59 de Bogotá:
   - la fecha propuesta, el grupo "Hoy" y los totales del mes coinciden con los de Bogotá;
   - el selector de fecha devuelve el día elegido.
3. **Servidor:** `docker compose exec -e TZ=Asia/Tokyo billing python -m app.modules.subscription_debits run`. El resultado es idéntico al del paso 3.

## Limpieza

```sh
docker compose down          # conserva el volumen pgdata
```
