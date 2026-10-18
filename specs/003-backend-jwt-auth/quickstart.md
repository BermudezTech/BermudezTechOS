# Quickstart: validar el backend base

**Feature**: [spec.md](./spec.md) · **Contratos**: [http-api.md](./contracts/http-api.md), [configuration.md](./contracts/configuration.md)

Guía para comprobar de punta a punta que la feature funciona. Las rutas y los cuerpos están en el contrato HTTP; aquí solo se indica qué hacer y qué esperar.

## Requisitos

- Docker con Compose v2.
- Para desarrollar y ejecutar las pruebas fuera del contenedor: **uv** y Python 3.13+.
- `curl` y `jq` (opcional).

## 1. Configurar y levantar (US4, SC-007)

```bash
cp apps/api/.env.example apps/api/.env
# Editar apps/api/.env:
#   JWT_SECRET y PASSWORD_RESET_PEPPER  → openssl rand -base64 48
#   INITIAL_USER_EMAIL / INITIAL_USER_PASSWORD / INITIAL_USER_DISPLAY_NAME
#   (opcional) RESEND_API_KEY y MAIL_FROM
docker compose up --build -d
docker compose logs -f api
```

**Esperado**:
- Los logs muestran que las migraciones se aplicaron, `Usuario inicial creado: <correo>` y que uvicorn está escuchando. Todo en menos de 2 min.
- `curl -s localhost:8000/health` devuelve `{"status":"ok","database":"ok"}`.
- `docker compose exec db psql -U bt bermudeztech -c '\dt'` lista todas las tablas de [data-model.md](./data-model.md).

## 2. La seed es idempotente (US1, SC-001)

```bash
docker compose restart api
docker compose exec db psql -U bt bermudeztech -c 'select count(*) from users; select count(*) from categories;'
```

**Esperado**: el log dice `Seed omitida: ya existe un usuario`; quedan 1 usuario y 15 categorías.

**Caso de error**: con la base vacía (`docker compose down -v`) y sin `INITIAL_USER_PASSWORD`, el contenedor `api` sale con un error que nombra la variable y no crea nada.

## 3. Iniciar sesión y usar rutas protegidas (US1, US2)

1. `POST /api/v1/auth/login` con las credenciales iniciales: responde 200 con un **TokenPair**.
2. `GET /api/v1/users/me` con `Authorization: Bearer <accessToken>`: devuelve el perfil, sin la contraseña.
3. `GET /api/v1/categories`: devuelve 12 de gasto y 3 de ingreso, en el orden de [data-model.md](./data-model.md), sin `userId`.
4. Repetir el paso 2 sin token, con un token alterado y con el `refreshToken` como bearer: las tres responden 401 `UNAUTHENTICATED`.
5. Login con una contraseña incorrecta y con un correo inexistente: ambos responden 401 `INVALID_CREDENTIALS` con el mismo cuerpo.

## 4. Bloqueo por correo + IP (FR-014)

1. Seis logins fallidos seguidos con el mismo correo: el 6.º responde 429 `TOO_MANY_ATTEMPTS` con `Retry-After`.
2. Un login correcto desde otra IP (otra máquina, o la prueba automatizada que simula la IP) funciona.

## 5. Renovación y cierre de sesión (US3)

1. `POST /auth/refresh` con el `refreshToken`: responde 200 con un par nuevo.
2. Repetir con el token **anterior**: responde 401, y el token nuevo también deja de servir, porque la reutilización cierra esa sesión.
3. **Varios dispositivos**: iniciar sesión dos veces (A y B). Reutilizar un token rotado de A cierra A, pero B sigue renovando con 200. Cerrar sesión en B no afecta una sesión C abierta aparte.
4. Iniciar sesión otra vez, `POST /auth/logout` con ese `refreshToken` (responde 204) y luego `POST /auth/refresh` con él: responde 401.

## 6. Recuperación de contraseña (US5)

Requiere `RESEND_API_KEY` y `MAIL_FROM` válidos, y que `INITIAL_USER_EMAIL` sea un buzón real.

1. `POST /auth/password/forgot`: responde 202. Llega un correo en español con un código de 6 dígitos.
2. `POST /auth/password/verify` con un código incorrecto: responde 400 `INVALID_CODE`. Con el correcto: responde 200 con un `resetToken`.
3. `POST /auth/password/reset` con una contraseña de 5 caracteres: responde 422. Con una válida: responde 204.
4. El login con la contraseña anterior responde 401 y con la nueva responde 200. Los `refreshToken` previos responden 401.
5. `forgot` con un correo inexistente responde el mismo 202 y no se envía ningún correo.

Sin Resend configurado, `forgot` sigue respondiendo 202 y el log muestra `Envío de correo no configurado`.

## 7. Pruebas automatizadas

```bash
cd apps/api
uv sync
uv run pytest            # unit + integration + contract (PostgreSQL vía testcontainers)
uv run ruff check . && uv run ruff format --check .
uv run mypy app
```

**Esperado**: todo en verde. Las pruebas que más importan:

| Prueba | Verifica |
|---|---|
| `tests/contract/test_routes_protected.py` | SC-002: toda ruta no pública responde 401 sin token. |
| `tests/contract/test_architecture.py` | Ningún controlador importa la sesión de base de datos. |
| `tests/integration/test_isolation.py` | SC-003: dos usuarios ven solo sus categorías, y una FK cruzada falla en la base. |
| `tests/integration/test_refresh_rotation.py` | SC-005: reutilizar un token cierra solo su sesión, otra sesión del mismo usuario sigue activa, y dos renovaciones concurrentes terminan con solo una exitosa. |
| `tests/integration/test_password_reset.py` | SC-009: los casos de código y permiso, el 5.º fallo y el reemplazo. |
| `tests/integration/test_bootstrap.py` | SC-001: idempotencia, variables faltantes y dos bootstraps en paralelo. |
| `tests/integration/test_secrets_at_rest.py` | SC-006: no hay valores en claro en la base ni en los logs capturados. |
