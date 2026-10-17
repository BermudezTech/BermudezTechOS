# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

## Proyecto

BermudezTechOS es una app **multiusuario** para gestionar finanzas, rutinas, calendario, to-do y hábitos.

**Alcance actual (MVP): solo finanzas personales.** No implementes otros módulos salvo que se pida explícitamente; pero diseña modelos y estructura de forma que añadir módulos después no requiera reescrituras.

## Stack

- **Cliente:** React Native + Expo (TypeScript). Objetivo principal Android; también web (Expo for Web).
- **Persistencia local:** Expo SQLite — fuente de verdad en el dispositivo.
- **Backend:** Python + FastAPI.
- **Base de datos servidor:** PostgreSQL.
- **ORM:** SQLAlchemy 2 (async) + Alembic para migraciones. No usar Prisma (sin soporte mantenido en Python).
- **Contenedores:** Docker + Docker Compose para API y PostgreSQL en desarrollo y despliegue.
- **Estructura:** monorepo con `apps/mobile` y `apps/api` (propuesta; confirmar antes de crear).

## Principios de arquitectura

### Offline-first
- La UI **siempre** lee y escribe en SQLite local; nunca bloquea esperando la red.
- Cada registro sincronizable necesita: ID generado en cliente (UUID), `created_at`, `updated_at`, borrado lógico (`deleted_at`) y estado de sincronización (p. ej. `is_dirty`).

### Sincronización
- Orden estricto: **primero PUSH, luego PULL**.
- **PUSH:** el cliente envía los registros modificados localmente desde la última sincronización. El servidor aplica **last-write-wins** comparando `updated_at`: solo sobrescribe si el `updated_at` entrante es más reciente que el almacenado.
- **PULL:** el cliente solicita al servidor los registros cambiados desde su último sync exitoso para esa tabla (incluye borrados lógicos) y los aplica localmente.
- Tabla de control local `sync_metadata` con la marca del último sync exitoso **por tabla**, para transferir solo lo que cambió; nunca descargar la base completa salvo en el primer sync.
- El cursor de PULL debe basarse en una marca asignada por el **servidor** (p. ej. `server_updated_at`), no en el reloj del dispositivo, para evitar perder cambios por desfase de relojes.
- Actualizar `sync_metadata` solo tras completar con éxito el PUSH y el PULL de la tabla; las operaciones deben ser idempotentes (reintentos seguros).

### Autenticación y multiusuario
- Todas las tablas de datos llevan `user_id`; el servidor filtra **siempre** por el usuario del JWT (nunca confiar en un `user_id` enviado por el cliente).
- `user_id` existe **solo en el servidor**: la base local SQLite no lo tiene; el servidor lo asigna desde el JWT. Al cerrar sesión se borra la base local.
- JWT: access token de corta duración + refresh token. En el cliente se guardan en `expo-secure-store` (en web, almacenamiento equivalente seguro).
- Sin conexión la app sigue funcionando con los datos locales; el refresh se intenta al recuperar la red.
- En web, verificar que Expo SQLite funcione (usa WASM/OPFS) antes de depender de ello.

### Finanzas
- Los montos tienen decimales (normalmente 2), pero deben representarse con **tipos decimales exactos, nunca de punto flotante** (`float`/`REAL`/`number` acumulan errores de redondeo: `0.1 + 0.2 ≠ 0.3`):
  - **PostgreSQL:** `NUMERIC(14, 2)`; **SQLAlchemy:** `Numeric(14, 2)` → `decimal.Decimal` en Python.
  - **API (JSON):** montos como **string** (`"1234.56"`) para no perder precisión.
  - **Cliente (SQLite/TS):** guardar como entero en centavos (`123456`) y formatear al mostrar, o usar una librería decimal (p. ej. `dinero.js`/`decimal.js`). Nunca operar montos con `number` directamente.
- Guardar siempre la moneda junto al monto.
- Fechas en UTC en almacenamiento; convertir a zona local solo para mostrar.

### UI / diseño
- Estética moderna **liquid glass**: superficies translúcidas con blur, colores vibrantes, bordes suaves, animaciones fluidas.
- Priorizar rendimiento en Android de gama media: limitar capas de blur, usar animaciones en el hilo nativo (p. ej. Reanimated).
- Centralizar colores, radios, espaciados y efectos en un sistema de tokens/tema; soportar modo claro y oscuro.

## Infraestructura

- **Despliegue:** automático en **Coolify** a partir de un `docker-compose.yml` (API + PostgreSQL). Mantener el compose compatible con Coolify (variables de entorno, healthchecks, volúmenes persistentes).
- **Migraciones:** Alembic se ejecuta al arrancar/desplegar la API.
- **Backups:** cron job en el servidor que hace `pg_dump` de la base y lo sube a una carpeta de Google Drive (p. ej. con `rclone`). Definir retención y probar la restauración periódicamente.
- **Secretos:** en variables de entorno (`.env` fuera de git, con `.env.example` versionado).

## Flujo de trabajo (Spec Kit)

Las features se desarrollan con Spec Kit: `/speckit-constitution` → `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
- Specs en `specs/`, constitución en `.specify/memory/constitution.md`.
- No implementar sin spec y plan aprobados para features no triviales.

## Convenciones

- Idioma: documentación y comunicación en español; identificadores de código en inglés.
- TypeScript estricto en el cliente; type hints y Pydantic en el backend.
- Commits pequeños y descriptivos; no hacer commit ni push sin que se pida.
