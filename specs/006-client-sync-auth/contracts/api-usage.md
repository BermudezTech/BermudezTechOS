# Contrato: uso de la API desde la app

La app consume, sin cambios, las rutas de [`003-backend-jwt-auth/contracts/http-api.md`](../../003-backend-jwt-auth/contracts/http-api.md) y [`004-data-sync/contracts/http-api.md`](../../004-data-sync/contracts/http-api.md). Este documento fija **cómo responde la app** a cada resultado.

Base: `EXPO_PUBLIC_API_URL` (incluye `/api/v1`). JSON camelCase. Timeout: 20 s.

## Clasificación de errores en `apiClient`

| Situación | Error tipado | Efecto global |
|---|---|---|
| `fetch` falla, timeout o sin red | `NetworkError` | `connectivity = 'offline'` |
| Respuesta con sobre `{ error: { code, message, details } }` | `ApiError(status, code, message, details, retryAfter?)` | — |
| 5xx o cuerpo no JSON | `ApiError(status, 'SERVER_ERROR')` | `lastError = server` |
| `401 UNAUTHENTICATED` en ruta protegida | Renovar una vez (single-flight) y reintentar | Si la renovación da `401 INVALID_REFRESH_TOKEN` ⇒ `session.expired = true` |

## Autenticación

| Ruta | Cuándo la llama la app | Éxito | Errores → mensaje al usuario |
|---|---|---|---|
| `POST /auth/login` | Pantalla de login y `reauth` | Guarda `bt.session`, luego `GET /users/me` | `401 INVALID_CREDENTIALS` → "Correo o contraseña incorrectos." · `429 TOO_MANY_ATTEMPTS` → "Demasiados intentos. Intenta de nuevo en N minutos." (de `Retry-After`) · `NetworkError` → "Necesitas conexión para iniciar sesión." · 5xx → "No pudimos conectar con el servidor. Intenta más tarde." |
| `GET /users/me` | Tras login/reauth y al recuperar la red si el perfil guardado falta | Guarda `bt.profile` | Si falla tras un login correcto, se reintenta una vez; si sigue fallando, el login se considera fallido y se borra `bt.session`. |
| `POST /auth/refresh` | Antes de una petición si el acceso vence en < 30 s, o tras un `401 UNAUTHENTICATED` | Rota y guarda `bt.session` | `401 INVALID_REFRESH_TOKEN` → sesión vencida (aviso no bloqueante "Tu sesión venció. Inicia sesión para sincronizar.") · `NetworkError` → sin conexión (no vence). |
| `POST /auth/logout` | Al cerrar sesión, si hay conexión | — | Cualquier error se ignora; el borrado local ocurre igual (FR-033). |
| `POST /auth/password/forgot` | Paso 1 de recuperación | Siempre el mismo mensaje de la respuesta | `422` → "Escribe un correo válido." · `NetworkError` → "Necesitas conexión." |
| `POST /auth/password/verify` | Paso 2 | Guarda `resetToken` **solo en memoria** de la pantalla | `400 INVALID_CODE` → "El código no es válido o venció. Pide uno nuevo." |
| `POST /auth/password/reset` | Paso 3 | Vuelve a `/login` con el correo precargado y un aviso de éxito | `400 INVALID_RESET_TOKEN` → "El permiso venció. Empieza de nuevo." (vuelve al paso 1) · `422` → error en el campo. |

Validación local previa (no se envía si falla): correo con formato válido; contraseña de login 1–128; contraseña nueva 8–128 e igual a la confirmación; código `^\d{6}$`.

## Sincronización

| Ruta | Uso | Manejo |
|---|---|---|
| `POST /sync/push` | Paso PUSH del ciclo (research R8), trozos ≤ 500 en orden de dependencias | Resultado por registro según research R8 · `413 PUSH_TOO_LARGE` → partir el trozo y reintentar · `422 VALIDATION_ERROR` → error de programación: se aborta el ciclo y se registra `lastError` · `401` → manejo común |
| `POST /sync/pull` | Paso PULL, repetido mientras `hasMore` | Aplicar páginas (FR-017) · `422 INVALID_CURSOR` → `pull_cursor = NULL` de la tabla en `details` y repetir · `401` → manejo común |

### Mensajes de rechazo para el usuario (Ajustes)

| `code` | Mensaje mostrado |
|---|---|
| `VALIDATION_ERROR` | "Datos no válidos: {message}" |
| `INVALID_REFERENCE` | "Hace referencia a algo que ya no existe." |
| `DEPENDENCY_REJECTED` | "Depende de otro cambio que no se pudo guardar." |
| `INCOHERENT` | "{message}" (el servidor lo envía en español) |
| `DUPLICATE` | "Ya existe un registro igual." |
| `ID_CONFLICT` | "No se pudo guardar este registro." |
| `CLOCK_AHEAD` | "La fecha de tu dispositivo está adelantada. Revisa la fecha y hora." |
| `LOCAL_PARSE_ERROR` | "Llegó un dato del servidor con un formato inesperado." |

Cada rechazo muestra además el tipo de registro y su nombre o descripción legible (cuenta, categoría, movimiento de {monto} del {fecha}…).
