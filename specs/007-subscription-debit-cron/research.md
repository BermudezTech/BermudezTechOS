# Research: Débito automático diario de suscripciones y zona horaria única del MVP

Decisiones de la fase 0. Cada una indica qué se eligió, por qué y qué alternativas se descartaron. No quedan `NEEDS CLARIFICATION`.

## R1. Dónde vive el servicio

- **Decision**: es un módulo `app/modules/subscription_debits` dentro de `apps/api` y se despliega como **servicio aparte** (`billing`) en `docker-compose.yml`.
  - Usa la misma `build` (`./apps/api`) y reemplaza el `entrypoint` por `python -m app.modules.subscription_debits serve`.
  - Es un contenedor y un proceso propios, en Python, conectados directamente a la base y sin llamadas HTTP a la API.
- **Rationale**:
  - Reutiliza tal cual los modelos (`Transaction`, `Subscription`…) y `Money`.
  - Toma el lock de sync que `sync/core/lock.py` exige "a todo proceso del servidor que escriba datos de finanzas".
  - Reutiliza el logging con redacción y la infraestructura de pruebas (testcontainers, migraciones).
  - Un cambio de esquema queda alineado en ambos servicios, porque se despliegan juntos desde la misma imagen.
  - No agrega un tercer proyecto (Principio V).
- **Alternatives considered**:
  - **Proyecto separado `apps/billing`, con su Dockerfile y SQL propio**: duplica el esquema y el lock y puede desalinearse en una migración. Habría que montar una infraestructura de pruebas paralela.
  - **Programar la tarea dentro del proceso de la API** (APScheduler en `lifespan`): no es un contenedor aparte, como pidió el usuario. Además se ejecutaría una vez por cada réplica de la API.
  - **Cron de Coolify ("Scheduled Tasks") llamando a `run`**: no deja el servicio versionado en el compose y depende de configurarlo a mano en la UI. Aun así queda como opción: el comando `run` es el mismo (contracts/billing-service.md).

## R2. Programación diaria

- **Decision**: un **bucle `asyncio` propio** en `scheduler.py`.
  1. Al arrancar: carga y valida la configuración, espera a la base con reintentos y verifica el esquema (R6).
  2. Hace una ejecución inmediata para el día de hoy en Bogotá.
  3. Después, cada 60 s, actualiza el latido (R7). Si la hora de Bogotá ya pasó la próxima ejecución programada, ejecuta `run_for_date(today_local())` y calcula la siguiente.
  4. La siguiente ejecución es `BILLING_RUN_TIME` (por defecto `00:05`) del día siguiente en Bogotá, calculada con `zoneinfo`.
- **Rationale**:
  - Son unas 40 líneas sin dependencias nuevas, y se pueden probar inyectando el reloj (`Clock`).
  - La ejecución al arrancar recupera los días que el contenedor estuvo caído dentro del periodo actual (FR-007), y es inocua porque el proceso es idempotente.
  - Comprobar cada 60 s en lugar de dormir hasta la hora exacta tolera suspensiones y cambios de reloj del host.
- **Alternatives considered**:
  - **APScheduler**: es una dependencia para un solo trabajo diario.
  - **`supercronic` o `cron` en la imagen**: exigen un binario extra en el Dockerfile y un crontab, y `TZ` quedaría en el contenedor, lo que contradice FR-024.
  - **Dormir hasta la hora objetivo**: es frágil ante suspensiones del host y no deja un latido.

## R3. Periodo actual, fecha de cobro y elegibilidad

- **Decision**: funciones puras en `periods.py` que reciben la fecha de referencia `D` (hoy en Bogotá, o `--date`).
  - **Periodo**: si es mensual, `D.strftime("%Y-%m")` y fecha de cobro `date(D.year, D.month, min(billing_day, días del mes))`. Si es anual, `str(D.year)` y fecha de cobro `date(D.year, billing_month, min(billing_day, días de ese mes))`, con lo que el 29/02 cae el 28 en años no bisiestos.
  - **Se cobra** si se cumplen las cuatro condiciones:
    - `status == 'ACTIVE'` y `deleted_at IS NULL`.
    - `billing_date <= D`.
    - `billing_date >= start_date`.
    - `billing_date >= BILLING_ACTIVATION_DATE`.
  - `start_date` se compara contra la fecha de cobro, no contra el periodo (FR-006). Por eso una suscripción creada el 20 con día 15 empieza a cobrarse el mes siguiente.
- **Rationale**: es la misma regla que ya usa la app en `nextBillingDate` (`clampedIsoDate`, ajuste al último día y nunca antes de `startDate`). Así la app y el servidor coinciden.
- **Alternatives considered**:
  - **Calcular en SQL**: es posible con `make_date` y `LEAST`, pero cuesta más probarlo y obliga a duplicar la lógica en la app futura.
  - **Guardar `next_billing_date`**: `docs/db-finanzas.md` §5 lo descarta por conflictos de LWW.

## R4. ID determinista

- **Decision**:
  - `NAMESPACE = uuid5(NAMESPACE_URL, "https://bermudeztech.os/subscription-debit")`, que da **`9d1e0cb1-0ae7-5d67-856e-c19860851ef1`** y queda fijado como literal.
  - `debit_id = uuid5(NAMESPACE, f"{subscription_id}:{period}")`, con `subscription_id` en minúsculas y con guiones (`str(uuid)`), y `period` en formato `YYYY-MM` o `YYYY`.
  - Vector de prueba fijo: suscripción `7f1c2a9e-0000-4000-8000-000000000001` y periodo `2026-10` → `e4bc34e4-a6ae-5090-9861-6968494a9467`.
  - Se documenta en `docs/db-finanzas.md` §5 para la app futura (FR-010).
- **Rationale**: sigue el estilo del namespace de la migración 005 (`uuidv5(url, URL)`) y el formato `"{subscription_id}:{period}"` que ya define la documentación. Con el vector fijo, Python y TypeScript se pueden probar contra el mismo valor.
- **Alternatives considered**:
  - **`NAMESPACE_OID` o el namespace de la migración 005**: mezcla dominios de ID.
  - **Incluir `user_id` en el nombre**: la app no conoce `user_id` (Principio III).

## R5. Escritura: transacción, lock e inserción idempotente

- **Decision**: `run_for_date(D)` funciona así:
  1. Consulta los `user_id` que tienen suscripciones candidatas: `ACTIVE`, sin borrar y con usuario existente.
  2. Para cada usuario abre **una transacción**:
     - toma `user_sync_lock(session, user_id, shared=False)`;
     - lee sus suscripciones candidatas con `LEFT JOIN` a la cuenta (activa = `deleted_at IS NULL`) y a la categoría (válida = `kind = 'EXPENSE' AND deleted_at IS NULL`);
     - para cada suscripción elegible (R3), dentro de un `SAVEPOINT` (`session.begin_nested()`), ejecuta `INSERT INTO transactions (...) VALUES (...) ON CONFLICT DO NOTHING RETURNING id`.
  3. Con fila devuelta cuenta *creado*; sin fila, *ya existía*; con excepción, *fallido*, después del rollback del savepoint.
  4. Hace `COMMIT` por usuario.
  - **Ajuste en la implementación (SC-005):** un savepoint y un `INSERT` por suscripción tardaban unos 40 s con 10.000 suscripciones. Se insertan los débitos de cada usuario **en lote**, en bloques de 500 filas por el límite de parámetros de PostgreSQL, dentro de un savepoint. Solo si un lote falla se repite uno por uno, cada cobro en su savepoint, para aislar el que falla (FR-015). La semántica no cambia.
  - Valores del egreso: los de [data-model.md](./data-model.md).
  - `created_at` y `updated_at` toman la hora del reloj inyectado, en UTC. `server_updated_at` usa su valor por defecto, `clock_timestamp()`.
- **Rationale**:
  - **Sin objetivo en `ON CONFLICT`**: cubre tanto la PK (mismo UUIDv5) como `uq_transactions_subscription_id_subscription_period`. Un débito que el usuario borró o editó sigue existiendo como fila, así que nunca se recrea ni se modifica (FR-014).
  - **Lock exclusivo por usuario**: garantiza que ningún PULL lea mientras la transacción está abierta y que el cursor no salte un cobro (FR-016).
  - **Dos ejecuciones simultáneas**: se serializan por usuario gracias al mismo lock, y `ON CONFLICT` resuelve cualquier carrera restante (FR-013).
  - **Savepoints**: aíslan el fallo de una suscripción (FR-015).
- **Alternatives considered**:
  - **Una transacción global**: retendría los locks de todos los usuarios durante toda la ejecución y bloquearía sus PUSH.
  - **Una transacción por suscripción**: tomaría el lock N veces. Es correcta pero más lenta, y no hace falta.
  - **`SELECT` previo y después `INSERT`**: es una carrera sin `ON CONFLICT`.

## R6. Esquema y dependencia de la API

- **Decision**: el servicio `billing` declara `depends_on: api: condition: service_healthy`. La API aplica las migraciones en su `bootstrap` antes de estar sana. Además, antes de cada ejecución, `schema_check.py` compara `SELECT version_num FROM alembic_version` con el head del `ScriptDirectory` de Alembic incluido en la imagen. Si no coinciden, registra el error y no escribe nada (FR-019); el bucle lo reintenta en el siguiente ciclo.
- **Rationale**: como las dos imágenes son la misma, el head esperado es exactamente el que la API acaba de migrar. Esto protege contra un despliegue a medias.
- **Alternatives considered**:
  - **Que `billing` ejecute `alembic upgrade`**: lo prohíbe FR-019 y competiría con la API.
  - **No verificar el esquema**: un `INSERT` contra un esquema viejo fallaría por cada suscripción, con un log ruidoso.

## R7. Healthcheck y reintentos

- **Decision**:
  - El bucle escribe un **archivo de latido** (`/tmp/billing-heartbeat`) cada 60 s.
  - El healthcheck del compose ejecuta `python -m app.modules.subscription_debits health`, que sale con 0 si el latido tiene menos de 180 s. El resultado de la última ejecución no influye (FR-018).
  - Si la base no responde, el arranque reintenta con espera creciente (5 s, 10 s, 20 s… hasta 60 s) durante un máximo de 10 minutos y luego sale con código 1, para que Docker lo reinicie (`restart: unless-stopped`).
  - Si una ejecución falla por la base, se reintenta 3 veces (1, 5 y 15 min). Si sigue fallando, queda registrada y se intenta en la ejecución del día siguiente, que recupera el periodo actual.
- **Rationale**: es el criterio que se acordó (solo log, sin alertas) y funciona en Coolify sin exponer puertos.
- **Alternatives considered**:
  - **Un endpoint HTTP de salud**: obliga a levantar un servidor dentro del worker.
  - **Un healthcheck con `pg_isready`**: mide la base, no el servicio.

## R8. Zona horaria en el servidor

- **Decision**: `app/core/timezone.py` define `APP_TIME_ZONE = ZoneInfo("America/Bogota")` y `today_local(clock) = clock.now().astimezone(APP_TIME_ZONE).date()`.
  - Todo el cálculo de "hoy" y de la hora de ejecución pasa por ahí. No se usa `date.today()` ni `datetime.now()` sin zona.
  - `occurred_at = datetime.combine(billing_date, time(0, 0), APP_TIME_ZONE)`, es decir, `billing_date` a las 05:00 en UTC.
  - Al arrancar se valida que `ZoneInfo("America/Bogota")` cargue; `python:3.13-slim` incluye `/usr/share/zoneinfo`, ya verificado.
- **Rationale**:
  - Es independiente de la variable `TZ` del contenedor (FR-024) y usa la base IANA, no −5 h fijo (FR-029).
  - Usar medianoche de Bogotá es la misma convención de la migración 005 (R7 de esa spec). Además, el cobro nunca queda con una hora futura respecto a la ejecución de las 00:05.
- **Alternatives considered**:
  - **Mediodía de Bogotá** (lo que usa la app para fechas que no son hoy): quedaría 12 h en el futuro al registrarse a las 00:05.
  - **Agregar la dependencia `tzdata` de PyPI**: no hace falta en la imagen ni en Linux. Si algún día se desarrolla en Windows, se agrega.
  - **Variable de entorno `TZ=America/Bogota` en el contenedor**: hace que la corrección dependa del entorno, justo lo que prohíbe FR-024.

La API no tiene hoy cálculos que dependan del día local: los vencimientos de tokens y el throttle comparan instantes UTC. Por eso no cambia; `app/core/timezone.py` queda disponible para usos futuros (FR-023).

## R9. Zona horaria en la app: punto único

- **Decision**:
  - En `src/lib/dates.ts`, `deviceTimeZone()` se reemplaza por `export const APP_TIME_ZONE = 'America/Bogota'` como valor por defecto de `zone` en todas las funciones (`todayLocal`, `localDateTimeToUtc`, `localDayKey`, `localTimeParts`, `formatDateLocal`, `periodRangeUtc`).
  - Se agrega `todayParts()`, que devuelve `{ year, month, day }` de hoy en Bogotá.
  - `deviceTimeZone()` se elimina, porque solo se usa en ese archivo, para que nadie vuelva a depender de la zona del dispositivo.
  - Se conserva el parámetro `zone` por si en el futuro hay zona por usuario.
- **Rationale**:
  - `dates.ts` ya centraliza la conversión, y `@date-fns/tz` (`tz()`, `TZDate`) ya calcula en una zona explícita, así que cambiar el valor por defecto corrige de una vez los resúmenes, gastos, patrimonio, agrupación por día, formularios y presentación.
  - Hermes en Android soporta `Intl.DateTimeFormat` con `timeZone` (lo usa hoy `@date-fns/tz`), y los navegadores también.
- **Alternatives considered**:
  - **Pasar la zona en cada llamada**: es propenso a olvidos.
  - **Cambiar la zona del dispositivo o del runtime**: no es posible en la app.

## R10. Usos de la hora del dispositivo fuera de `dates.ts`

Se revisaron con `grep` los usos de `getHours`, `getDate`, `getMonth`, `getFullYear`, `new Date(y, m, d)`, `toLocale*` e `Intl` en `src/`:

| Lugar | Problema | Cambio |
|---|---|---|
| `src/lib/greeting.ts` | `date.getHours()` da la hora del dispositivo. | Usar `localTimeParts(date.toISOString()).hours` en Bogotá. La prueba deja de construir `new Date(2026, 9, 17, h, m)`, que es la hora local del runner, y pasa a instantes UTC equivalentes a esas horas en Bogotá. |
| `SubscriptionForm.tsx:56` y `RecurringIncomeForm.tsx:61` | `new Date().getDate()` como día propuesto. | `todayParts().day`. |
| `DateInput.tsx:21` (Android) | El día inicial es `new Date()`. | Construir el `Date` del selector con `todayParts()`. La conversión entre el `Date` del selector y `YYYY-MM-DD` (`getFullYear`/`getMonth`/`getDate`) **se mantiene**, porque el selector nativo trabaja en el calendario del dispositivo y la ida y vuelta conserva el día elegido sin importar la zona. |
| `DateInput.web.tsx` | `<input type="date">` ya entrega `YYYY-MM-DD`. | Ninguno. |
| `schemas/common.ts:78` | Valida la fecha con `Date.UTC`. | Ninguno: es independiente de la zona. |
| `addDays`, `daysBetween`, `clampDayToMonth` | Aritmética en UTC sobre fechas puras. | Ninguno. |
| `sync/status.ts` (`formatDistanceStrict`) | Es una duración relativa. | Ninguno: no depende de la zona. |

`dateToOccurredAt` ("si es hoy, hora actual; si no, mediodía local") pasa a calcular en Bogotá sin cambiar su código, gracias a los valores por defecto de R9.

## R11. Pruebas de zona horaria

- **Decision**:
  - **App:**
    - Se agrega `"test:tz": "TZ=Asia/Tokyo jest && TZ=Pacific/Honolulu jest"` en `package.json` (UTC+9 y UTC−10, uno a cada lado de Bogotá).
    - `dates.test.ts` incorpora casos fijados con `jest.setSystemTime`: 23:30 de Bogotá (04:30Z del día siguiente), 31-oct 20:00 de Bogotá (cambio de mes en UTC y en Madrid), 31-dic 22:00 (cambio de año), "Hoy"/"Ayer", `periodRangeUtc` de octubre (`2026-10-01T05:00Z`–`2026-11-01T05:00Z`) y `todayParts`.
    - Se agrega una prueba que verifica que no queden usos de `getHours()`, `getDate()` ni `new Date()` sin argumentos para elegir el día en los archivos de R10.
  - **Servidor:** `test_periods.py` y `test_scheduler.py` se parametrizan con `monkeypatch.setenv("TZ", …)` + `time.tzset()` en `Asia/Tokyo`, `Pacific/Honolulu` y `UTC`, y verifican resultados idénticos usando relojes fijos en las franjas 19:00–23:59 de Bogotá.
- **Rationale**: FR-030 pide al menos dos zonas, una a cada lado. Ejecutar toda la suite en otras zonas detecta usos olvidados de la zona del sistema que una prueba puntual no vería.
- **Alternatives considered**: solo pruebas puntuales con la zona en el código, pero no detectan dependencias accidentales de la zona del runner.

## R12. Configuración del servicio

- **Decision**: `BillingSettings` (pydantic-settings) es independiente de `Settings` de la API, para no exigir `JWT_SECRET` ni `PASSWORD_RESET_PEPPER` al worker.
  - `DATABASE_URL`: obligatoria, con el mismo prefijo `postgresql+asyncpg://`.
  - `BILLING_ACTIVATION_DATE`: obligatoria, `YYYY-MM-DD` (FR-007a).
  - `BILLING_RUN_TIME`: `HH:MM`, por defecto `00:05`, en hora de Bogotá.
  - `LOG_LEVEL`: por defecto `INFO`.
  - Los errores nombran la variable, nunca su valor, como `load_settings()`.
- **Rationale**: es el mínimo privilegio, porque el worker no maneja tokens, y reutiliza el patrón de `_describe`.
- **Alternatives considered**: reutilizar `Settings`, que obligaría a dar secretos de autenticación a un proceso que no los usa.

## R13. Fuera de este plan (anotado)

- **"Próximo cobro" en la app tras el cobro**: `nextBillingDate` devuelve "hoy" hasta que termina el día, aunque el servicio ya haya registrado el cobro, porque no mira el último periodo generado. `docs/db-finanzas.md` §5 sugiere usarlo. No es parte de esta spec; se anota para la de débitos en el dispositivo.
- **Coherencia documental**: la enmienda PATCH de la constitución, la línea de `CLAUDE.md` y la nota en FR-035 de la spec 001 quedan como tarea de cierre (plan, Constitution Check).
