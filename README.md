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

## Estructura del repositorio (propuesta)

```
BermudezTechOS/
├── apps/
│   ├── mobile/      # App React Native (Expo) — Android + Web
│   └── api/         # Backend FastAPI
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

> Se completará cuando exista el código de `apps/mobile` y `apps/api`.
