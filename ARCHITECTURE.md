# BermudezTechOS — Ficha Técnica de Arquitectura

## 1. Visión general

BermudezTechOS es una aplicación multiplataforma (móvil primero, con soporte web) para la gestión integral de la vida personal. Se construye por módulos independientes que comparten una base técnica común. El primer módulo en desarrollo es **Finanzas**; módulos futuros incluyen **Checklist/Tareas**, **Calendario**, y otros por definir (hábitos, metas, propósito).

Cada módulo debe poder evolucionar de forma aislada (su propio dominio, sus propias tablas, su propio conjunto de endpoints) sin acoplarse fuertemente a los demás, para permitir que se agreguen o remuevan módulos con el tiempo.

## 2. Stack tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | React Native (Expo) | Móvil primero, con soporte a Expo Web. Vive en `my-app/`. Ver nota de versión Expo abajo. |
| Backend | NestJS | API HTTP (REST, posible GraphQL a futuro). Vivirá en una carpeta en el root, ej. `backend/` o `api/`. |
| ORM | Prisma | Acceso a datos tipado, migraciones versionadas. |
| Base de datos | PostgreSQL | Motor relacional principal. |
| Lenguaje | TypeScript (obligatorio, `strict: true`) | En todo el monorepo: frontend, backend, y paquetes compartidos. |
| Gestor de paquetes | Yarn 4 (Berry), workspaces | Monorepo gestionado desde `package.json` raíz. |

**Nota importante — Expo:** el frontend usa una versión reciente de Expo cuyo comportamiento cambió respecto a versiones anteriores. Antes de escribir código en `my-app/`, se debe consultar la documentación versionada exacta en `https://docs.expo.dev/versions/v57.0.0/` (regla definida en `AGENTS.md`, aplica a todo el repo).

## 3. Estructura del monorepo

```
BermudezTechOS/
├── my-app/              # Frontend React Native (Expo) — móvil + web
├── backend/             # (futuro) API NestJS
├── docs/                # Documentación (ya referenciada como workspace)
├── package.json         # Root — yarn workspaces
└── ARCHITECTURE.md       # Este documento
```

- `my-app` y `backend` son workspaces independientes de Yarn, cada uno con su propio `package.json`, `tsconfig.json` y reglas de lint.
- Los tipos/contratos compartidos entre frontend y backend (ej. DTOs, enums, tipos de dominio financiero) se plantean como un paquete compartido futuro, ej. `packages/shared` (a evaluar cuando exista necesidad real de duplicación — no crear prematuramente).

## 4. Principios de diseño transversales

1. **TypeScript estricto en todo el repo.** `strict: true` en todos los `tsconfig.json` (frontend, backend, paquetes compartidos). No `any` implícitos, no `// @ts-ignore` como solución permanente.
2. **Modularidad por dominio.** Cada módulo funcional (Finanzas, Checklist, Calendario, …) se modela como un dominio separado en el backend (módulo de NestJS con su propio `*.module.ts`, controladores, servicios) y como una sección separada en el frontend (navegación propia, pantallas propias).
3. **Un solo backend, múltiples módulos de dominio.** No se plantean microservicios por ahora — un solo servicio NestJS con módulos internos bien delimitados. Se revisará esta decisión solo si la complejidad operativa lo justifica.
4. **Base de datos compartida, esquema por dominio.** Un único PostgreSQL gestionado con Prisma; las tablas se organizan por prefijo/dominio (ej. `finance_*`) para mantener claridad, ya que Prisma no soporta múltiples esquemas de forma nativa sin fricción.
5. **Mobile-first, web como extensión.** El diseño de UI y de estado se piensa primero para pantallas móviles; el soporte web (Expo for Web) se valida después, no se diseñan flujos exclusivos de escritorio.

## 5. Módulo 1: Finanzas (prioridad actual)

### 5.1 Alcance funcional inicial (a refinar)
- Registro de transacciones (ingresos/egresos).
- Categorización de transacciones.
- Cuentas/billeteras (efectivo, banco, tarjeta, etc.).
- Balance y reportes básicos por período.
- (Pendiente de definir con el usuario: presupuestos, metas de ahorro, moneda múltiple, recurrencias.)

### 5.2 Entidades de dominio (borrador, sujeto a validación)
- `Account` (cuenta/billetera)
- `Transaction` (transacción: ingreso, egreso, transferencia)
- `Category` (categoría de transacción)
- `User` (dueño de los datos — aplica a todos los módulos, no solo finanzas)

Este modelo se formalizará en el `schema.prisma` cuando se inicie el backend.

## 6. Roadmap de módulos

1. **Finanzas** — en definición (actual).
2. **Checklist / Tareas** — pendiente.
3. **Calendario** — pendiente.
4. Otros módulos (hábitos, metas, propósito) — mencionados por el usuario, sin definir aún.

## 7. Estrategia de testing

El proyecto requiere cobertura de pruebas obligatoria en tres niveles, en todo el monorepo (frontend y backend):

| Tipo | Herramienta | Alcance |
|---|---|---|
| Unitarias | Jest | Lógica pura: servicios, utilidades, helpers, funciones de dominio (backend y frontend), sin dependencias externas reales. |
| Integración | Testcontainers | Backend: pruebas contra una instancia real de PostgreSQL levantada en contenedor (vía Prisma), validando repositorios/servicios contra la base de datos real en lugar de mocks. |
| Componentes / UI | React Native Testing Library | Frontend: render e interacción de pantallas y componentes (inputs, navegación, estados de carga/error), sobre Jest como test runner. |

Notas:
- Jest es el test runner base tanto para las pruebas unitarias como para las de componentes (RNTL corre sobre Jest).
- Testcontainers evita el uso de mocks de base de datos en pruebas de integración del backend, para no repetir el problema de que un mock pase pero la integración real falle.
- Cada módulo de dominio (Finanzas, Checklist, Calendario, …) debe incluir sus tres niveles de test a medida que se implementa, no como tarea posterior.

## 8. Pendientes / próximas decisiones

- Definir alcance funcional detallado del módulo Finanzas (presupuestos, multi-moneda, recurrencias, adjuntos/recibos).
- Definir estrategia de autenticación (dado que es una app personal, evaluar si se requiere multiusuario o autenticación simple).
- Crear el workspace `backend/` con NestJS + Prisma cuando se inicie la implementación.
- Definir convenciones de lint/formato compartidas (ESLint + Prettier) para todo el monorepo.
- Evaluar necesidad de un paquete `shared` de tipos una vez el backend exista.
