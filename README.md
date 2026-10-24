# BermudezTechOS

Aplicación hecha a la medida para organizar la vida personal (multiusuario): finanzas personales, rutinas, calendario, to-do, hábitos y más.

> **Fase actual — MVP:** únicamente **finanzas personales**. El resto de módulos llegará en fases posteriores.

## Características (visión)

| Módulo | Estado |
|---|---|
| 💰 Finanzas personales | 🚧 MVP en desarrollo |
| 🔁 Rutinas | ⏳ Planeado |
| 📅 Calendario | ⏳ Planeado |
| ✅ To-do | ⏳ Planeado |
| 🌱 Hábitos | ⏳ Planeado |

## Arquitectura

```
┌──────────────────────────────┐         ┌───────────────────────────┐
│  Cliente (React Native/Expo) │  sync   │  Backend (FastAPI/Python) │
│  Android · Web               │ ◄─────► │  REST API                 │
│  Expo SQLite (offline-first) │  HTTPS  │  SQLAlchemy 2 + Alembic   │
└──────────────────────────────┘         │  PostgreSQL               │
                                         └───────────────────────────┘
```

- **Frontend:** React Native con Expo. Principalmente Android; también accesible desde la web.
- **Offline-first:** todos los datos se leen y escriben en una base local **Expo SQLite**; se sincronizan con el servidor cuando hay conexión.
- **Backend:** Python + **FastAPI**.
- **Base de datos:** **PostgreSQL**.
- **ORM:** **SQLAlchemy 2** (async) con migraciones **Alembic**.
- **Contenedores:** **Docker** / Docker Compose (API + PostgreSQL).
- **Autenticación:** JWT (access + refresh token), multiusuario con datos aislados por usuario.
- **Despliegue:** automático en **Coolify** desde el `docker-compose.yml`.
- **Backups:** cron en el servidor con `pg_dump` → carpeta de Google Drive.
- **UI:** look moderno con estética *liquid glass* (glassmorphism), colores vibrantes y animaciones fluidas.

## Estructura del repositorio

```
BermudezTechOS/
├── apps/
│   ├── mobile/      # App React Native (Expo) — Android + Web
│   └── api/         # Backend FastAPI
├── docs/           # Documentación
├── specs/           # Especificaciones de Spec Kit (por feature)
├── .specify/        # Plantillas, scripts y constitución de Spec Kit
└── .claude/         # Skills/comandos para Claude Code
```

## Desarrollo guiado por especificaciones

Este repo usa [Spec Kit](https://github.com/github/spec-kit). Flujo de trabajo:

1. `/speckit-constitution` — principios del proyecto
2. `/speckit-specify` — especificación de la feature
3. `/speckit-plan` — plan técnico
4. `/speckit-tasks` — desglose en tareas
5. `/speckit-implement` — implementación

## Primeros pasos

### App (`apps/mobile`)

Requisitos: Node.js LTS (≥ 20) y npm. Para Android, un **development build** (la app usa módulos nativos: SQLite, almacenamiento seguro y red) o un emulador.

```bash
cd apps/mobile
npm install
cp .env.example .env   # EXPO_PUBLIC_API_URL: IP de tu PC en la LAN (Android) o http://localhost:8000/api/v1 (web)
npx expo start         # "a" para Android, "w" para web
```

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas unitarias (montos, dominio, base local, motor de sync, sesión y rutas) |
| `npm run lint` | ESLint (config de Expo) |
| `npm run typecheck` | TypeScript estricto (`tsc --noEmit`) |
| `npm run format` | Formatea con Prettier |
| `npm run build:dev:android` | Development build (perfil `development`, con `APP_VARIANT=development`) |

- **Datos y sesión:** la app guarda todo en **Expo SQLite** en el dispositivo y lo sincroniza con la API (subir, luego bajar) al iniciar sesión, al abrirla, al recuperar la red, unos segundos después de cada cambio y cada 5 minutos en primer plano. Funciona sin conexión; el estado y los cambios pendientes se ven en **Ajustes → Sincronización**. Todas las pantallas exigen sesión; **al cerrar sesión se borran los datos del dispositivo**.
- **Nuevo development build:** necesario tras esta versión, porque se añadieron módulos nativos (`expo-sqlite`, `expo-secure-store`, `expo-network`).
- **HTTP en desarrollo (Android):** Android bloquea `http://` sin cifrar. El perfil `development` de EAS define `APP_VARIANT=development`, que lo permite solo en ese build. En producción usa siempre HTTPS.
- **Web:** añade `http://localhost:8081` a `CORS_ORIGINS` en el `.env` de la API. Expo SQLite en web necesita las cabeceras `Cross-Origin-Embedder-Policy: credentialless` y `Cross-Origin-Opener-Policy: same-origin`: el servidor de desarrollo ya las envía (`metro.config.js`) y `app.config.ts` las declara para el hosting junto con una CSP estricta (sin scripts de terceros). Si publicas la web en otro servidor, configúralas allí. La app se abre en una sola pestaña a la vez.

Escenarios de validación: [`specs/006-client-sync-auth/quickstart.md`](specs/006-client-sync-auth/quickstart.md) (y los de la interfaz en [`specs/001-finance-ui-mockup/quickstart.md`](specs/001-finance-ui-mockup/quickstart.md)).

### API (`apps/api`)

FastAPI + PostgreSQL. Cada módulo tiene un **controlador** (rutas) y un **servicio** (lógica), al estilo NestJS. Todas las rutas exigen sesión salvo las marcadas con `@public`, y cada usuario solo ve sus propios datos.

Requisitos: Docker con Compose v2. Para desarrollar fuera de Docker y correr las pruebas, [uv](https://docs.astral.sh/uv/) y Python 3.13+.

**Levantar API + base de datos:**

```bash
cp apps/api/.env.example .env      # en la raíz del repo (lo lee docker compose)
# Completa en .env:
#   POSTGRES_PASSWORD y la misma clave en DATABASE_URL
#   JWT_SECRET y PASSWORD_RESET_PEPPER  → openssl rand -base64 48
#   INITIAL_USER_EMAIL / INITIAL_USER_PASSWORD / INITIAL_USER_DISPLAY_NAME
#   BILLING_ACTIVATION_DATE              → día del primer despliegue (YYYY-MM-DD)
docker compose up --build
```

- La API queda en `http://localhost:8000`, con la documentación interactiva en `/docs` (solo en desarrollo) y el estado en `/health`.
- Al arrancar se aplican las migraciones (Alembic) y luego la **seed**: si la base no tiene usuarios, crea el usuario de `INITIAL_USER_*` con su set inicial de categorías. Si ya existe un usuario, no hace nada. Si faltan esas variables con la base vacía, el contenedor no arranca e indica qué variable falta. No hay registro desde la app; se recomienda borrar `INITIAL_USER_PASSWORD` tras el primer despliegue.
- **Recuperación de contraseña:** necesita `RESEND_API_KEY` y `MAIL_FROM` (remitente verificado en Resend). Sin ellas la API funciona, pero no envía correos.
- **Servicio de cobros (`billing`):** contenedor aparte con la misma imagen. Al arrancar y luego cada día a las `BILLING_RUN_TIME` (00:05 por defecto) registra el egreso de las suscripciones activas que vencen en el periodo actual, nunca con fecha anterior a `BILLING_ACTIVATION_DATE`. Es idempotente: ejecutarlo de nuevo no duplica cobros. El resumen de cada ejecución queda en `docker compose logs billing`. Contrato: [`specs/007-subscription-debit-cron/contracts/billing-service.md`](specs/007-subscription-debit-cron/contracts/billing-service.md).
- **Zona horaria:** todo el MVP (servicio, API y app) calcula y muestra fechas en `America/Bogota`, sin importar la zona del dispositivo o del servidor. Se almacena siempre en UTC.
- **Versión web (`web`):** el compose también compila la web (`apps/mobile/Dockerfile.web`: `expo export` + nginx) y la sirve en `http://localhost:8080`. `EXPO_PUBLIC_API_URL` se fija al compilar y su origen va en la CSP; añade el origen de la web a `CORS_ORIGINS`. Las cabeceras COOP/COEP/CSP de nginx se generan desde `app.config.ts`, así que cualquier cambio se hace solo allí.
- **Coolify:** despliega `docker-compose.yml` (sin puertos publicados; `docker-compose.override.yml` es solo local). Configura `FORWARDED_ALLOW_IPS` con la red del proxy para que el bloqueo de inicio de sesión vea la IP real del cliente.

**Desarrollo** (en `apps/api`):

| Comando | Qué hace |
|---|---|
| `uv sync` | Instala dependencias (incluidas las de desarrollo) |
| `uv run uvicorn app.main:app --reload` | API local; usa `apps/api/.env` con `localhost` en `DATABASE_URL` |
| `uv run python -m app.bootstrap` | Migraciones + seed manuales |
| `uv run alembic revision --autogenerate -m "<msg>"` | Nueva migración |
| `uv run pytest` | Pruebas contra PostgreSQL real (testcontainers, o `TEST_DATABASE_URL`) |
| `uv run ruff check . && uv run ruff format --check .` | Lint y formato |
| `uv run mypy app` | Tipos (modo estricto) |
| `uv run python -m app.modules.subscription_debits run [--date YYYY-MM-DD]` | Una ejecución de cobros (en Docker: `docker compose exec billing python -m app.modules.subscription_debits run`) |
| `uv run python -m app.modules.subscription_debits health` | Estado del servicio de cobros (0 si el latido es reciente) |

**Sincronización:** los datos de finanzas no tienen rutas por entidad. La app (offline-first) envía sus cambios con `POST /api/v1/sync/push` y recibe los del servidor con `POST /api/v1/sync/pull`, ambos para todas las tablas. Contrato y escenarios: [`specs/004-data-sync/`](specs/004-data-sync/) ([contrato](specs/004-data-sync/contracts/http-api.md), [quickstart](specs/004-data-sync/quickstart.md)).

Contrato de la API, variables y escenarios de validación: [`specs/003-backend-jwt-auth/`](specs/003-backend-jwt-auth/) ([quickstart](specs/003-backend-jwt-auth/quickstart.md)).
