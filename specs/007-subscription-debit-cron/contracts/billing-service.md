# Contrato: servicio de cobros (`billing`)

Interfaz operativa del worker: comandos, variables de entorno, healthcheck, códigos de salida y log. No expone puertos ni HTTP.

## Comandos

Punto de entrada: `python -m app.modules.subscription_debits <comando>` (en la imagen de `apps/api`).

| Comando | Qué hace |
|---|---|
| `serve` | Modo servicio. Valida la configuración y la zona, espera a la base y verifica el esquema. Luego hace una ejecución inmediata (`trigger=startup`) y otra cada día a `BILLING_RUN_TIME` en Bogotá (`trigger=scheduled`). Actualiza el latido cada 60 s. Es el `entrypoint` del servicio en el compose. |
| `run [--date YYYY-MM-DD]` | Una sola ejecución (`trigger=manual`) para la fecha dada, o para hoy en Bogotá si no se indica. Imprime el resumen y termina. |
| `health` | Sale con 0 si el latido tiene menos de 180 s; si no, con 1. Es el healthcheck del compose. |

Uso manual en producción o desarrollo:

```sh
docker compose exec billing python -m app.modules.subscription_debits run
docker compose exec billing python -m app.modules.subscription_debits run --date 2026-10-15
```

### Reglas de `run --date`

- No puede ser posterior a hoy en Bogotá: sale con código 2 y no escribe nada.
- Aplica la fecha de activación igual que la ejecución programada (FR-007a).
- Da el mismo resultado que la ejecución programada de esa fecha (FR-002).

## Variables de entorno

| Variable | Obligatoria | Formato | Por defecto | Descripción |
|---|---|---|---|---|
| `DATABASE_URL` | Sí | `postgresql+asyncpg://…` | — | La misma base de la API. |
| `BILLING_ACTIVATION_DATE` | Sí | `YYYY-MM-DD` | — | Nunca se cobra una fecha anterior a esta (FR-007a). Se fija el día del primer despliegue. |
| `BILLING_RUN_TIME` | No | `HH:MM` (24 h) | `00:05` | Hora diaria de ejecución, en hora de Bogotá. |
| `LOG_LEVEL` | No | `DEBUG`/`INFO`/`WARNING`/`ERROR` | `INFO` | |

La zona horaria **no es configurable**: es `America/Bogota` (FR-023). La variable `TZ` del contenedor se ignora (FR-024).

Si una variable falta o es inválida, el error nombra la variable y nunca su valor, y el proceso sale con código 1.

## Códigos de salida

| Código | Significado |
|---|---|
| 0 | `run`: ejecución completa, aunque haya cobros `failed`, que se informan en el resumen. `health`: latido reciente. |
| 1 | Configuración inválida, zona no disponible, base inaccesible tras los reintentos, esquema distinto del esperado o latido viejo. |
| 2 | Argumentos inválidos (p. ej. `--date` futura o mal formada). |

## Compose (resumen)

```yaml
billing:
  build:
    context: ./apps/api
  entrypoint: ["python", "-m", "app.modules.subscription_debits", "serve"]
  restart: unless-stopped
  depends_on:
    api:
      condition: service_healthy
  environment:
    DATABASE_URL: ${DATABASE_URL:?DATABASE_URL es obligatoria}
    BILLING_ACTIVATION_DATE: ${BILLING_ACTIVATION_DATE:?BILLING_ACTIVATION_DATE es obligatoria}
    BILLING_RUN_TIME: ${BILLING_RUN_TIME:-00:05}
    LOG_LEVEL: ${LOG_LEVEL:-INFO}
  healthcheck:
    test: ["CMD", "python", "-m", "app.modules.subscription_debits", "health"]
    interval: 60s
    timeout: 10s
    retries: 3
    start_period: 120s
```

No publica puertos ni usa volúmenes. `docker-compose.override.yml` no necesita cambios.

## Log

Usa el formato existente (`%(asctime)s %(levelname)s %(name)s: %(message)s`) con el logger `app.subscription_debits` y el filtro `SensitiveDataFilter`. Nunca registra montos, nombres de suscripciones, correos ni la URL de la base.

| Evento | Nivel | Mensaje (forma) |
|---|---|---|
| Arranque | INFO | `Servicio de cobros iniciado: activación=2026-10-24, hora=00:05 America/Bogota, próxima=2026-10-25T00:05-05:00` |
| Inicio de ejecución | INFO | `Ejecución de cobros: fecha=2026-10-24 trigger=scheduled` |
| Fallo de una suscripción | WARNING | `Cobro fallido: subscription=<uuid> period=2026-10 motivo=<clase de error>` |
| Cuenta no disponible | INFO | `Cobro omitido: subscription=<uuid> period=2026-10 motivo=cuenta no disponible` |
| Resumen | INFO | `Resumen de cobros: fecha=2026-10-24 trigger=scheduled usuarios=3 suscripciones=12 creados=2 existentes=1 no_vencidos=8 omitidos=1 fallidos=0 duracion_ms=840` |
| Esquema distinto | ERROR | `Esquema inesperado: base=<rev> esperado=<rev>; no se escribe nada` |
| Base inaccesible | ERROR | `No se pudo conectar a la base tras N intentos` |

El resumen se emite siempre, también cuando todos los conteos son 0, para que el administrador vea que la ejecución ocurrió (US4).
