# Contrato HTTP: API v1 (auth, usuarios, categorías, estado)

**Feature**: [spec.md](../spec.md) · **Modelo**: [data-model.md](../data-model.md)

## Convenciones

- **Base**: `/api/v1`. La ruta de estado está fuera de la versión (`/health`).
- **JSON**: camelCase (research R10). Las fechas van en ISO-8601 UTC con `Z` (`2026-10-18T14:03:00Z`). Los montos, cuando existan, van como string.
- **Autenticación**: `Authorization: Bearer <accessToken>`. Toda ruta exige token salvo las marcadas 🌐 **pública**.
- **Sobre de error** (todas las respuestas 4xx/5xx):

  ```json
  { "error": { "code": "INVALID_CREDENTIALS", "message": "Correo o contraseña incorrectos.", "details": null } }
  ```

  `details` solo se llena en `VALIDATION_ERROR`: `[{ "field": "newPassword", "message": "Debe tener entre 8 y 128 caracteres." }]`.

### Errores comunes

| HTTP | `code` | Cuándo |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Ruta protegida sin token, con token mal formado, con firma inválida, vencido, de tipo `refresh`, o de un usuario inexistente. Incluye `WWW-Authenticate: Bearer`. |
| 404 | `NOT_FOUND` | El recurso no existe **o pertenece a otro usuario**: ambos casos son indistinguibles (FR-021). |
| 422 | `VALIDATION_ERROR` | El cuerpo o los parámetros no cumplen el esquema. |
| 500 | `INTERNAL_ERROR` | Error inesperado; mensaje genérico, sin traza. |

---

## Estado

### `GET /health` 🌐

| HTTP | Cuerpo |
|---|---|
| 200 | `{ "status": "ok", "database": "ok" }` |
| 503 | `{ "status": "degraded", "database": "unavailable" }` |

Ejecuta `SELECT 1` con un timeout de 2 s. Lo usan el healthcheck de Docker y Coolify.

---

## Autenticación (`/api/v1/auth`)

### `POST /auth/login` 🌐

```json
{ "email": "yo@ejemplo.com", "password": "********" }
```

- `email`: correo válido. Se normaliza (minúsculas y sin espacios alrededor).
- `password`: string de 1 a 128 caracteres. Al iniciar sesión no se aplica el mínimo de 8, para no revelar la regla con un error distinto.

| HTTP | Cuerpo / `code` |
|---|---|
| 200 | **TokenPair** (ver abajo) |
| 401 | `INVALID_CREDENTIALS`: idéntico si el correo no existe o la contraseña es incorrecta |
| 429 | `TOO_MANY_ATTEMPTS`, con cabecera `Retry-After: <segundos>`: 5 fallos para correo + IP en 15 min |
| 422 | `VALIDATION_ERROR` |

**TokenPair**:

```json
{
  "accessToken": "<JWT>",
  "refreshToken": "<opaco>",
  "tokenType": "bearer",
  "expiresIn": 900,
  "refreshExpiresIn": 604800
}
```

Claims del JWT de acceso: `sub` (UUID del usuario), `typ` = `"access"`, `iat`, `exp`, `jti`. El algoritmo es HS256.

### `POST /auth/refresh` 🌐

```json
{ "refreshToken": "<opaco>" }
```

| HTTP | Cuerpo / `code` |
|---|---|
| 200 | **TokenPair** nuevo. El token de renovación enviado queda rotado. |
| 401 | `INVALID_REFRESH_TOKEN`: inexistente, vencido o revocado. Si ya había sido rotado, además se revoca **esa sesión** (todos sus tokens). Las sesiones de otros dispositivos siguen activas. |

### `POST /auth/logout` (protegida)

```json
{ "refreshToken": "<opaco>" }
```

| HTTP | Cuerpo / `code` |
|---|---|
| 204 | Sin cuerpo. Revoca la sesión de ese token de renovación; las demás sesiones del usuario siguen activas. Es idempotente: si ya estaba revocado, también responde 204. |
| 401 | `UNAUTHENTICATED` |

Si el token de renovación no existe o pertenece a otro usuario, también responde **204** y no revoca nada, para no revelar si el token existe.

### `POST /auth/password/forgot` 🌐

```json
{ "email": "yo@ejemplo.com" }
```

| HTTP | Cuerpo |
|---|---|
| 202 | `{ "message": "Si el correo está registrado, recibirás un código para restablecer tu contraseña." }` |
| 422 | `VALIDATION_ERROR`: solo si el correo tiene formato inválido |

Responde siempre **202** con el mismo cuerpo, aunque el usuario no exista, haya superado el límite de 3 por hora o el correo no esté configurado. El envío del correo ocurre en segundo plano.

### `POST /auth/password/verify` 🌐

```json
{ "email": "yo@ejemplo.com", "code": "042917" }
```

- `code`: exactamente 6 dígitos (`^\d{6}$`).

| HTTP | Cuerpo / `code` |
|---|---|
| 200 | `{ "resetToken": "<opaco>", "expiresIn": 600 }` |
| 400 | `INVALID_CODE`: incorrecto, vencido, usado, reemplazado, invalidado por 5 fallos, o correo inexistente; todos igual |
| 422 | `VALIDATION_ERROR` |

### `POST /auth/password/reset` 🌐

```json
{ "resetToken": "<opaco>", "newPassword": "********" }
```

- `newPassword`: de 8 a 128 caracteres.

| HTTP | Cuerpo / `code` |
|---|---|
| 204 | Sin cuerpo. Cambia la contraseña, consume el permiso, revoca todas las sesiones y borra los bloqueos del correo. |
| 400 | `INVALID_RESET_TOKEN`: inexistente, vencido o usado |
| 422 | `VALIDATION_ERROR`: contraseña fuera de la regla. El permiso sigue vigente. |

---

## Usuarios (`/api/v1/users`)

### `GET /users/me` (protegida)

| HTTP | Cuerpo |
|---|---|
| 200 | `{ "id": "uuid", "email": "yo@ejemplo.com", "displayName": "Juan", "createdAt": "…Z" }` |
| 401 | `UNAUTHENTICATED` |

---

## Categorías (`/api/v1/categories`)

### `GET /categories` (protegida)

Lista las categorías **no borradas** del usuario de la sesión, ordenadas por `kind` (EXPENSE y luego INCOME) y después por `sortOrder` y `name`.

| HTTP | Cuerpo |
|---|---|
| 200 | `{ "items": [Category, …] }` |
| 401 | `UNAUTHENTICATED` |

**Category**:

```json
{
  "id": "uuid",
  "name": "Transporte",
  "kind": "EXPENSE",
  "icon": "car-outline",
  "color": "#06B6D4",
  "sortOrder": 0,
  "createdAt": "…Z",
  "updatedAt": "…Z",
  "deletedAt": null,
  "serverUpdatedAt": "…Z"
}
```

Nunca incluye `userId` (FR-019). Si la solicitud trae parámetros como `userId`, se ignoran.

---

## Resumen de rutas

| Método | Ruta | Pública | FR |
|---|---|---|---|
| GET | `/health` | 🌐 | FR-023 |
| POST | `/api/v1/auth/login` | 🌐 | FR-008, FR-009, FR-014 |
| POST | `/api/v1/auth/refresh` | 🌐 | FR-011 |
| POST | `/api/v1/auth/logout` | | FR-012 |
| POST | `/api/v1/auth/password/forgot` | 🌐 | FR-027, FR-028, FR-031, FR-032 |
| POST | `/api/v1/auth/password/verify` | 🌐 | FR-029 |
| POST | `/api/v1/auth/password/reset` | 🌐 | FR-030 |
| GET | `/api/v1/users/me` | | FR-013 |
| GET | `/api/v1/categories` | | FR-021a |

No existe ninguna ruta para crear usuarios (FR-006). `/docs` y `/openapi.json` de FastAPI son públicas solo en desarrollo (`DOCS_ENABLED`, apagado por defecto en producción); en producción no se publican.
