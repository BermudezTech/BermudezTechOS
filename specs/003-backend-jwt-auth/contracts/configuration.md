# Contrato de configuración y arranque

**Feature**: [spec.md](../spec.md) · **Research**: R8, R11, R12

## Variables de entorno

Todas se documentan en `apps/api/.env.example`, que está versionado y no contiene secretos reales.

| Variable | Obligatoria | Ejemplo / default | Uso |
|---|---|---|---|
| `DATABASE_URL` | Sí | `postgresql+asyncpg://bt:bt@db:5432/bermudeztech` | Conexión de la API y de Alembic. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Sí (compose) | `bt` / — / `bermudeztech` | Inicialización del contenedor `db`. |
| `JWT_SECRET` | Sí | ≥ 32 caracteres aleatorios | Firma HS256 de los tokens de acceso. Rotarla cierra todas las sesiones de acceso. |
| `PASSWORD_RESET_PEPPER` | Sí | ≥ 32 caracteres aleatorios | HMAC de los códigos de recuperación. |
| `INITIAL_USER_EMAIL` | Solo si no hay usuarios | `yo@ejemplo.com` | Seed del primer usuario. |
| `INITIAL_USER_PASSWORD` | Solo si no hay usuarios | 8–128 caracteres | Seed. Se recomienda retirarla tras el primer despliegue. |
| `INITIAL_USER_DISPLAY_NAME` | No | `Juan` | Seed. |
| `RESEND_API_KEY` | No | `re_…` | Envío de correos. Sin ella, la recuperación no envía nada (FR-032). |
| `MAIL_FROM` | No (sí si hay `RESEND_API_KEY`) | `BermudezTechOS <no-reply@dominio>` | Remitente verificado en Resend. |
| `FORWARDED_ALLOW_IPS` | No | `127.0.0.1` (default de uvicorn); en Coolify, la red del proxy, o `*` si la API solo es accesible desde el proxy | Qué proxies son de confianza para tomar la IP real (`X-Forwarded-For`), según FR-014. |
| `CORS_ORIGINS` | No | vacío | Orígenes permitidos para la app web, separados por coma. |
| `DOCS_ENABLED` | No | `false` | Publica `/docs` y `/openapi.json`. El override de desarrollo lo pone en `true`. |
| `LOG_LEVEL` | No | `INFO` | |

**Reglas de validación al arrancar** (FR-024):
- Si falta una variable obligatoria o es inválida (formato o longitud mínima), el proceso termina con código ≠ 0 y un mensaje del tipo `Configuración inválida: JWT_SECRET debe tener al menos 32 caracteres.`, sin mostrar el valor.
- Si `RESEND_API_KEY` está definida pero falta `MAIL_FROM`, la configuración es inválida.
- Si faltan ambas, el servicio arranca y registra la advertencia `Envío de correo no configurado`.

## Secuencia de arranque del contenedor `api`

```
docker-entrypoint.sh
 └─ python -m app.bootstrap
     1. Settings() ─── inválida ──▶ exit 1
     2. pg_advisory_lock(BOOTSTRAP_LOCK_ID)
     3. alembic upgrade head ─── error ──▶ exit 1 (sin seed)
     4. ¿existe algún usuario?
        ├─ sí ──▶ log "Seed omitida: ya existe un usuario" ──▶ continuar
        └─ no ──▶ validar INITIAL_USER_* ─── inválidas ──▶ exit 1 (sin crear nada)
                  └─ en una transacción: crear usuario + 15 categorías
     5. pg_advisory_unlock
 └─ exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
```

**Mensajes**: registran el correo del usuario creado, pero nunca la contraseña ni su hash.

## Docker Compose

- **`docker-compose.yml`** (raíz; lo usa Coolify):
  - Servicios `db` (PostgreSQL 17, volumen `pgdata`, healthcheck `pg_isready`) y `api` (build `apps/api`, `depends_on` con `service_healthy`, `expose: 8000`, healthcheck a `/health`, `restart: unless-stopped`).
  - Sin puertos publicados. Las variables se declaran como `${VAR}` o `${VAR:-default}`.
- **`docker-compose.override.yml`** (solo desarrollo local):
  - Publica `8000:8000` y `5432:5432`, carga `apps/api/.env` y pone `DOCS_ENABLED=true`.
  - Lo aplica automáticamente `docker compose up`. Coolify no lo usa.

## Comandos de desarrollo (`apps/api`)

| Comando | Qué hace |
|---|---|
| `uv sync` | Instala las dependencias (incluidas las de desarrollo). |
| `uv run uvicorn app.main:app --reload` | API local contra la `db` del compose. |
| `uv run python -m app.bootstrap` | Migraciones y seed manuales. |
| `uv run alembic revision --autogenerate -m "<msg>"` | Nueva migración. |
| `uv run pytest` | Pruebas. Usan testcontainers, o `TEST_DATABASE_URL` si está definida. |
| `uv run ruff check . && uv run ruff format --check .` | Lint y formato. |
| `uv run mypy app` | Tipos en modo estricto. |
