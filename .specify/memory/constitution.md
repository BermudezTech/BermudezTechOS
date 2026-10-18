<!--
Sync Impact Report
- Version change: (plantilla sin completar) → 1.0.0
- Principios definidos (nuevos):
  I. Offline-first
  II. Sincronización incremental y determinista
  III. Aislamiento multiusuario y seguridad
  IV. Precisión monetaria y temporal
  V. Modularidad y alcance controlado
  VI. Experiencia multiplataforma liquid glass
- Secciones añadidas: Restricciones técnicas e infraestructura; Flujo de trabajo y calidad; Governance
- Secciones eliminadas: ninguna
- Plantillas: no modificadas (leen la constitución en tiempo de ejecución)
- TODOs diferidos: ninguno
-->

# BermudezTechOS Constitution

## Core Principles

### I. Offline-first

- La UI MUST leer y escribir siempre en la base local del dispositivo; ninguna interacción del
  usuario puede bloquearse esperando la red.
- Cada registro sincronizable MUST tener ID generado en el cliente (UUID), `created_at`,
  `updated_at`, borrado lógico (`deleted_at`) y estado de sincronización (`is_dirty`).
- Sin conexión, la app MUST seguir funcionando con los datos locales.

**Rationale**: el uso principal es móvil y con conectividad intermitente; registrar un gasto
debe ser instantáneo.

### II. Sincronización incremental y determinista

- El orden MUST ser PUSH y luego PULL.
- PUSH aplica last-write-wins: el servidor solo sobrescribe si el `updated_at` entrante es más
  reciente que el almacenado.
- El cursor de PULL MUST ser una marca asignada por el servidor (`server_updated_at`), nunca el
  reloj del dispositivo, e incluye borrados lógicos.
- `sync_metadata` guarda el último sync exitoso por tabla y MUST actualizarse solo tras completar
  PUSH y PULL de esa tabla; solo el primer sync descarga todo.
- Toda operación de sync y de generación automática (p. ej. débitos de suscripciones) MUST ser
  idempotente; los registros que puedan generar cliente y servidor usan IDs deterministas (UUIDv5).

**Rationale**: evita pérdida de cambios por desfase de relojes y duplicados por reintentos.

### III. Aislamiento multiusuario y seguridad

- Toda tabla de datos del servidor MUST llevar `user_id`, y el servidor MUST filtrar siempre por
  el usuario del JWT; nunca se confía en un `user_id` enviado por el cliente.
- `user_id` existe solo en el servidor; la base local no lo almacena y se borra al cerrar sesión.
- Autenticación con access token de corta duración + refresh token, guardados en almacenamiento
  seguro del dispositivo (o su equivalente seguro en web).
- Secretos y claves de terceros (p. ej. modelos de IA) MUST vivir solo en el backend, en variables
  de entorno; `.env` fuera de git y `.env.example` versionado.

**Rationale**: la app maneja datos financieros personales de varios usuarios.

### IV. Precisión monetaria y temporal

- Los montos MUST usar tipos decimales exactos, nunca punto flotante: `NUMERIC(14,2)` /
  `Decimal` en servidor, string en JSON, centavos enteros o librería decimal en el cliente.
- Todo monto MUST ir acompañado de su moneda (COP en el MVP).
- Los saldos MUST derivarse de las transacciones; no se almacenan como valor editable.
- Fechas en UTC en almacenamiento; conversión a zona local solo al mostrar.

**Rationale**: `0.1 + 0.2 ≠ 0.3`; un error de centavos destruye la confianza en una app de
finanzas.

### V. Modularidad y alcance controlado

- El MVP implementa solo el módulo de finanzas; otros módulos (rutinas, calendario, to-do,
  hábitos) MUST NOT implementarse sin petición explícita.
- Modelos, navegación y estructura MUST permitir añadir módulos nuevos sin reescribir los
  existentes.
- Monorepo con `apps/mobile` (cliente) y `apps/api` (backend).
- Se prefiere la solución más simple que cumpla la spec; la complejidad adicional se justifica en
  el plan.

**Rationale**: entregar valor pronto sin cerrar la puerta a la visión completa de la app.

### VI. Experiencia multiplataforma liquid glass

- El cliente MUST funcionar en Android (objetivo principal) y web con las mismas funcionalidades;
  toda dependencia de plataforma (p. ej. SQLite en web) se verifica antes de depender de ella.
- Estética liquid glass (translucidez con blur, colores vibrantes, bordes suaves, animaciones
  fluidas) definida en un sistema de tokens centralizado con modo claro y oscuro.
- El rendimiento en Android de gama media MUST priorizarse: capas de blur limitadas y animaciones
  en el hilo nativo.
- La interfaz y la documentación están en español; los identificadores de código en inglés.

**Rationale**: la identidad visual es parte del producto, pero no a costa de la fluidez.

## Restricciones técnicas e infraestructura

- **Cliente:** React Native + Expo (TypeScript estricto), Expo SQLite como fuente de verdad local.
- **Backend:** Python + FastAPI, type hints y Pydantic; SQLAlchemy 2 (async) + Alembic. No Prisma.
- **Base de datos:** PostgreSQL.
- **Contenedores y despliegue:** Docker Compose (API + PostgreSQL) compatible con Coolify:
  configuración por variables de entorno, healthchecks y volúmenes persistentes.
- **Migraciones:** Alembic se ejecuta al arrancar/desplegar la API.
- **Backups:** `pg_dump` programado hacia Google Drive con retención definida y pruebas de
  restauración periódicas.

## Flujo de trabajo y calidad

- Las features no triviales MUST seguir Spec Kit: specify → plan → tasks → implement; no se
  implementa sin spec y plan aprobados. Specs en `specs/`.
- Cada plan MUST incluir una verificación explícita contra esta constitución (Constitution Check).
- La lógica de cálculo de montos/saldos y la de sincronización MUST tener pruebas automatizadas.
- Commits pequeños y descriptivos; no se hace commit ni push sin solicitud explícita.

## Governance

- Esta constitución prevalece sobre otras prácticas del repositorio; `CLAUDE.md` es la guía
  operativa de desarrollo y MUST mantenerse coherente con ella.
- **Enmiendas:** se proponen con `/speckit-constitution`, documentando el cambio en el Sync Impact
  Report y revisando el impacto en specs y planes activos.
- **Versionado semántico:** MAJOR para eliminar o redefinir principios de forma incompatible;
  MINOR para añadir principios/secciones o ampliar guías de forma material; PATCH para
  aclaraciones y redacción.
- **Cumplimiento:** cada plan y cada revisión de código verifican los principios; toda desviación
  MUST justificarse por escrito en el plan (sección de complejidad).

**Version**: 1.0.0 | **Ratified**: 2026-10-17 | **Last Amended**: 2026-10-17
