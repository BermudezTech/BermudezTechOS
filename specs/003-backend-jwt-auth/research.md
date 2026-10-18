# Research: Backend base con autenticación JWT y datos privados por usuario

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Fecha**: 2026-10-18

Cada decisión resuelve una incógnita del Technical Context o fija una práctica para el stack que ya imponen la constitución y `CLAUDE.md` (FastAPI, SQLAlchemy 2 async, Alembic, PostgreSQL, Docker Compose, Coolify).

---

## R1. Patrón controlador/servicio al estilo NestJS en FastAPI

**Decision**: cada módulo vive en `app/modules/<módulo>/` con estos archivos:

- `<módulo>_controller.py`: un `APIRouter` con funciones de ruta que solo validan la entrada (DTO de Pydantic), obtienen el servicio por `Depends` y devuelven el DTO de salida.
- `<módulo>_service.py`: una clase con la lógica, que recibe sus dependencias (sesión, repositorios, otros servicios) por constructor. Se registra con un *provider* (`get_<módulo>_service`) usado en `Depends`.
- `schemas.py`: los DTOs de entrada y salida.
- `dependencies.py`: los *providers* del módulo.

`app/main.py` registra los routers de todos los módulos desde una lista (`app/modules/__init__.py: CONTROLLERS`), así que añadir un módulo solo agrega una entrada.

**Rationale**:
- Separa la ruta de la lógica, como pidió el usuario.
- El servicio se puede probar sin HTTP.
- `Depends` hace el papel de la inyección de dependencias de NestJS sin librerías extra.
- Los controladores nunca importan la sesión de base de datos (lo verifica una regla de pruebas, ver R13).

**Nota de implementación**: la sesión de base de datos se inyecta con `Depends(get_session, scope="function")` (alias `SessionDep`). Con el scope por defecto de FastAPI (`"request"`), el `commit` ocurría después de enviar la respuesta, y un cliente rápido podía usar un token recién revocado. Lo cubre `tests/integration/test_commit_before_response.py`.

**Alternatives considered**:
- Vistas basadas en clase (`fastapi-utils` `@cbv`, `fastapi-controllers`): dependencias poco mantenidas que añaden magia.
- Un contenedor de DI (`dependency-injector`): sobra para un solo servicio.

## R2. Guards: protección por defecto y rutas públicas explícitas

**Decision**:
- El guard global es `AuthGuard`, registrado en `FastAPI(dependencies=[Depends(auth_guard)])`.
- Lee `request.scope["endpoint"]`: si la función tiene el atributo `__public__` (lo pone el decorador `@public`, equivalente a `@Public()` de NestJS), deja pasar la solicitud.
- Si no, exige `Authorization: Bearer <access>`. Valida firma, vencimiento, `typ == "access"` y que el usuario exista, y guarda el usuario en `request.state.user`.
- Los controladores reciben el usuario con `CurrentUser = Annotated[User, Depends(current_user)]`.

**Rationale**:
- Una ruta nueva queda protegida aunque se olvide declarar algo (spec, Edge Cases).
- Satisface FR-017 y FR-018.
- La prueba SC-002 recorre `app.routes` y verifica que toda ruta sin `__public__` responde 401 sin token.
- FastAPI resuelve las dependencias globales después del *routing*, así que `scope["endpoint"]` ya está disponible.

**Alternatives considered**:
- `dependencies=[...]` por router, poniendo las rutas públicas en otro router: más fácil de olvidar.
- Middleware ASGI: no ve el endpoint y no se integra con OpenAPI (candado en Swagger).

## R3. Tokens: acceso JWT y renovación opaca

**Decision**:
- **Token de acceso**: JWT HS256 firmado con `JWT_SECRET` (mínimo 32 bytes) mediante **PyJWT**.
  - Claims: `sub` (UUID del usuario), `typ: "access"`, `iat`, `exp` = 15 min, `jti`. Sin `leeway`.
- **Token de renovación**: **opaco**, 32 bytes aleatorios (`secrets.token_urlsafe(32)`) con 7 días de vigencia. Se guarda solo su SHA-256 en `refresh_tokens.token_hash`.
- **Sesiones por dispositivo**: cada login genera un `session_id` (UUID) nuevo. Cada token de renovación guarda su `session_id`, y el sucesor lo hereda al rotar. Un usuario puede tener tantas sesiones como dispositivos, sin límite.
- **Rotación** (`/auth/refresh`):
  1. `SELECT … FOR UPDATE` del token por hash.
  2. Si está vigente: se revoca, se crea el sucesor con el mismo `session_id` y se enlaza con `replaced_by_id`.
  3. Si ya fue rotado (`replaced_by_id IS NOT NULL`): se revocan los tokens **de esa sesión** (`WHERE session_id = …`), incluido el sucesor vigente (FR-011), y se responde 401. Las demás sesiones no se tocan.
  4. Vencido o revocado sin sucesor (logout): 401.
- **Logout**: revoca los tokens de la sesión del token enviado, que debe pertenecer al usuario autenticado.
- **Restablecer la contraseña**: revoca todas las sesiones del usuario (FR-030).

**Rationale**:
- Un token opaco se puede revocar y detectar su reutilización sin firmarlo.
- SHA-256 basta: el token tiene 256 bits de entropía, así que no hace falta un hash lento.
- El `FOR UPDATE` serializa dos renovaciones simultáneas. La segunda ve el token ya rotado y se trata como reutilización, como pide la spec.
- Revocar por sesión ("familia" de tokens, como recomienda el borrador OAuth 2.0 Security BCP) invalida igualmente lo que un atacante podría tener de esa sesión, sin cerrar los otros dispositivos del usuario.
- PyJWT es la librería que recomienda hoy la documentación de FastAPI.
- Rotar `JWT_SECRET` invalida todos los accesos (Edge Case).

**Alternatives considered**:
- Renovación también como JWT: igual hay que guardarlo para revocarlo.
- `python-jose`: sin mantenimiento.
- RS256: sin beneficio con un solo servicio emisor y verificador.
- Revocar todas las sesiones del usuario ante una reutilización: descartado por el usuario, porque un fallo de red en un dispositivo cerraría la sesión en todos.
- Recorrer la cadena `replaced_by_id` para encontrar la sesión: funciona, pero `session_id` lo resuelve con una sola consulta indexada.

**Nota para el cliente** (feature de integración): la app debe serializar las renovaciones. Dos renovaciones en paralelo cierran la sesión de ese dispositivo, aunque no las demás.

## R4. Hash de contraseñas

**Decision**: Argon2id con **pwdlib** (`pwdlib[argon2]`, parámetros por defecto, que son los recomendados de `argon2-cffi`). Longitud de 8 a 128 caracteres, validada en el DTO y en la seed.

**Rationale**:
- Algoritmo lento y con sal (FR-007).
- El límite de 128 evita usar el hash como vector de DoS.
- pwdlib es la librería que usa la documentación actual de FastAPI; passlib ya no se mantiene.

**Alternatives considered**: bcrypt (trunca a 72 bytes) y passlib.

## R5. Bloqueo de inicio de sesión por correo + IP

**Decision**:
- Tabla `login_attempts` (correo normalizado, IP, fecha) con índice (`email`, `ip`, `attempted_at`).
- Antes de verificar la contraseña: si hay 5 o más fallos para (correo, IP) en los últimos 15 min, se responde **429** con `Retry-After` (segundos hasta que el 5.º fallo más reciente cumpla 15 min).
- Un fallo inserta una fila. Un éxito borra las filas de (correo, IP). Restablecer la contraseña borra todas las del correo (FR-030).
- Las filas de más de 1 día se purgan de forma oportunista en cada inserción.
- **IP real detrás del proxy**: uvicorn con `--proxy-headers` y `FORWARDED_ALLOW_IPS` (variable que uvicorn lee de forma nativa), configurada con la red del proxy de Coolify. Así `request.client.host` es la IP del cliente.

**Rationale**:
- Funciona con varios workers o instancias y sobrevive a reinicios.
- El volumen es mínimo.
- Responder 429 antes de verificar evita gastar Argon2 en intentos bloqueados.

**Alternatives considered**:
- Memoria del proceso: se pierde al reiniciar y no se comparte entre workers.
- Redis: un servicio más sin necesidad.
- `slowapi`: limita por ruta o IP, no por correo + IP con desbloqueo manual.

## R6. Recuperación de contraseña con código de 6 dígitos

**Decision**: una tabla, `password_reset_codes`, guarda el código y el permiso de cambio (la spec permite una o dos tablas).

1. **`POST /auth/password/forgot`**:
   - Responde siempre **202** con el mismo cuerpo.
   - Si el correo existe y hay menos de 3 solicitudes en la última hora (contando filas por `created_at`): invalida los códigos vigentes del usuario y crea uno nuevo. El código es `secrets.randbelow(10**6)` con ceros a la izquierda y se guarda como `code_hash = HMAC-SHA256(PASSWORD_RESET_PEPPER, user_id:code)`. Vigencia: 30 min.
   - El envío del correo se programa como `BackgroundTask`.
   - Si el envío falla, o falta la configuración de Resend, el código se marca `invalidated_at` y se registra el error sin el código.
2. **`POST /auth/password/verify`** (correo + código):
   - Busca el código vigente más reciente del usuario y compara con `hmac.compare_digest`.
   - Si falla: incrementa `failed_attempts`; al 5.º, `invalidated_at`.
   - Si acierta: `used_at` y genera el permiso, un token opaco de 32 bytes con su SHA-256 en `grant_hash` y vigencia de 10 min.
   - Toda falla responde 400 `INVALID_CODE`, sin distinguir la causa.
3. **`POST /auth/password/reset`** (permiso + contraseña nueva):
   - Valida el permiso (vigente y no usado) y la contraseña (FR-007).
   - En una transacción: actualiza el hash, marca `grant_used_at`, revoca todos los `refresh_tokens` del usuario y borra sus `login_attempts`.

**Rationale**:
- Enviar en segundo plano iguala el tiempo de respuesta exista o no el correo, así que no se puede enumerar usuarios por tiempos.
- El HMAC con *pepper* impide recuperar un código de 6 dígitos (10⁶ combinaciones) a partir de un volcado de la base, cosa que un SHA-256 simple sí permitiría.
- Con 5 intentos por código y 3 códigos por hora, adivinar tiene una probabilidad de 15/10⁶ por hora.

**Alternatives considered**:
- Enviar el correo en línea: filtra por tiempos si el usuario existe.
- Dos tablas: más JOINs sin beneficio.
- Usar el código mismo como permiso para el cambio: alarga la ventana del código de baja entropía.

## R7. Envío de correo con Resend

**Decision**:
- `app/modules/mail/mail_service.py` llama a la API REST de Resend (`POST https://api.resend.com/emails`) con **httpx.AsyncClient** y un timeout de 10 s.
- Configuración: `RESEND_API_KEY` y `MAIL_FROM` (remitente verificado en Resend), ambas opcionales.
- Si faltan, `MailService.is_configured` es falso: se registra una advertencia al arrancar y cada solicitud de recuperación invalida el código sin enviar nada (FR-032).
- La plantilla es HTML más texto plano, en español, con el código y su vigencia.

**Rationale**:
- El SDK oficial `resend` para Python es síncrono y bloquearía el event loop.
- httpx ya es dependencia de las pruebas y se simula con `respx`.
- Detrás de una interfaz (`MailSender`), el proveedor se puede cambiar.

**Alternatives considered**:
- SDK `resend` dentro de `asyncio.to_thread`: válido, pero añade una dependencia sin ventaja.
- SMTP de Resend: más configuración.

## R8. Seed automática del primer usuario y arranque

**Decision**:
- Arranque del contenedor: `docker-entrypoint.sh` ejecuta `python -m app.bootstrap` y luego `exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers`.
- `app.bootstrap`:
  1. Toma `pg_advisory_lock(<constante>)` en una conexión dedicada.
  2. Ejecuta `alembic upgrade head` de forma programática.
  3. Si `SELECT EXISTS(SELECT 1 FROM users)` es falso: valida `INITIAL_USER_EMAIL`, `INITIAL_USER_PASSWORD` e `INITIAL_USER_DISPLAY_NAME` (opcional) y registra el usuario con `UserRegistrationService`, que crea en una sola transacción el usuario y sus 15 categorías (FR-016).
  4. Libera el lock.
- Cualquier error (migración, variables faltantes o inválidas) termina con código ≠ 0 y un mensaje que nombra la variable, nunca su valor. El contenedor no arranca y Coolify marca el despliegue como fallido.
- La validación de la seed ocurre solo si no hay usuarios. Con un usuario existente, las variables se ignoran.

**Rationale**:
- El *advisory lock* cubre el caso de dos instancias arrancando a la vez.
- Ejecutarlo antes de uvicorn y no en el `lifespan` evita repetirlo en cada worker y hace visible el fallo.
- Cumple "Alembic se ejecuta al arrancar/desplegar" de `CLAUDE.md`.

**Alternatives considered**:
- Seed en el `lifespan`: se ejecuta por worker.
- Contenedor `init` aparte en compose: Coolify lo soporta peor y duplica la imagen.

## R9. Aislamiento por usuario en el acceso a datos

**Decision**:
- **Capa de aplicación**: `UserScopedRepository[ModelT]` (genérico) en `app/common/repository.py`.
  - Se construye con `(session, user_id)`.
  - Todas sus consultas parten de `self._query()`, que añade `Model.user_id == self.user_id` y `deleted_at IS NULL` (salvo `include_deleted=True`, que necesitará el PULL).
  - `add()` asigna `user_id` y `server_updated_at` desde el servidor. Una instancia con otro `user_id` levanta error.
  - Los repositorios concretos (`CategoriesRepository`) heredan de él, y su *provider* depende de `CurrentUser`, así que un servicio de datos no puede obtener un repositorio sin usuario.
  - `get(id)` de otro usuario devuelve `None`, y el servicio lo traduce a 404 (FR-021).
- **Capa de base de datos** (FR-004):
  - Cada tabla de datos tiene `UNIQUE (user_id, id)`.
  - Toda FK entre tablas de datos es **compuesta**: `(user_id, account_id) → accounts(user_id, id)`.
  - Con `MATCH SIMPLE` (por defecto), una FK con columna nula no se verifica, así que las referencias opcionales siguen funcionando.
- Los DTOs de salida nunca declaran `user_id` (FR-019).

**Rationale**:
- Doble barrera: un error en un servicio no puede crear una referencia cruzada entre usuarios.
- El repositorio común cumple FR-020.

**Alternatives considered**:
- Row-Level Security de PostgreSQL con `SET app.user_id`: es robusto, pero complica el pool de conexiones async y las migraciones. Queda como mejora futura.
- Filtrar a mano en cada servicio: es exactamente lo que FR-020 prohíbe.

## R10. Formato de la API y de los errores

**Decision**:
- Prefijo `/api/v1` para la API y `/health` fuera de la versión.
- JSON en **camelCase** (`alias_generator=to_camel`, `populate_by_name=True`), igual que los tipos del cliente (`createdAt`, `sortOrder`).
- Montos como string: Pydantic v2 serializa `Decimal` como string en JSON. Aún no hay rutas con montos.
- Fechas en ISO-8601 UTC con `Z`.
- Errores con un único sobre: `{"error": {"code": "INVALID_CREDENTIALS", "message": "Correo o contraseña incorrectos.", "details": [...]}}`.
  - `details` solo aparece en validación (422, con campo y regla).
  - Códigos HTTP: 401 sin sesión válida, 404 no encontrado, 422 validación, 429 límite, 503 base de datos caída en `/health`, 500 genérico sin traza.
- Los mensajes van en español.

**Rationale**:
- Encaja con el cliente TypeScript sin mapear nombres.
- El código estable (`code`) permite que la app muestre mensajes propios.
- Cumple FR-022.

**Alternatives considered**: snake_case, que obligaría a mapear todo en el cliente, y el `{"detail": ...}` por defecto de FastAPI, que es heterogéneo.

## R11. Configuración y secretos

**Decision**:
- `app/core/config.py` con **pydantic-settings**:
  - **Obligatorias**: `DATABASE_URL` (`postgresql+asyncpg://…`), `JWT_SECRET` (mínimo 32 caracteres) y `PASSWORD_RESET_PEPPER` (mínimo 32 caracteres).
  - **Opcionales**: `RESEND_API_KEY`, `MAIL_FROM`, `INITIAL_USER_*`, `LOG_LEVEL`, `CORS_ORIGINS` y `FORWARDED_ALLOW_IPS` (esta la lee uvicorn).
- Si una obligatoria falta o es inválida, `Settings()` falla al importar y el servicio no arranca (FR-024). El mensaje nombra la variable sin mostrar su valor.
- `.env.example` versionado y `.env` en `.gitignore`. Esta feature crea el `.gitignore` raíz, que hoy no existe.

**Rationale**: validación tipada y un solo lugar para la configuración.

**Alternatives considered**: `os.environ` disperso por el código.

## R12. Docker Compose compatible con Coolify

**Decision**:
- **`docker-compose.yml`** en la raíz, el que usa Coolify. Dos servicios:
  - `db`: `postgres:17-alpine`, volumen `pgdata`, healthcheck `pg_isready`.
  - `api`: build de `apps/api`, `depends_on: db: condition: service_healthy`, `expose: 8000` sin puertos fijos, y un healthcheck que llama a `/health` con `python -c "urllib.request…"` (la imagen slim no trae curl).
  - Todas las variables se definen con `${VAR}`. Coolify las detecta y muestra en su panel.
- **`docker-compose.override.yml`**: solo para desarrollo, lo carga solo `docker compose up`. Publica `8000:8000` y `5432:5432` y lee `.env`. Coolify usa únicamente el archivo configurado, así que no lo aplica.
- **Imagen**: `python:3.13-slim` multi-stage con **uv** (`COPY --from=ghcr.io/astral-sh/uv`), `uv sync --frozen --no-dev` y un usuario no root.

**Rationale**:
- Un solo comando local (FR-023, SC-007).
- Cumple los requisitos de Coolify: variables, healthchecks y volumen persistente.

**Alternatives considered**: Dockerfile sin compose, que no cumple el despliegue definido, y PostgreSQL gestionado por Coolify aparte, que sigue siendo posible cambiando `DATABASE_URL`.

## R13. Pruebas y calidad

**Decision**:
- **pytest** con `pytest-asyncio` (modo `auto`) y `httpx.AsyncClient` sobre `ASGITransport`, contra **PostgreSQL real** con **testcontainers**. Si existe `TEST_DATABASE_URL`, se usa esa base, por ejemplo la del compose.
- Cada prueba corre en una transacción con *rollback*.
- Envío de correo simulado con `respx`.
- Reloj inyectable (`app/core/clock.py`, `Clock.now()`, sobrescribible con `dependency_overrides`) para probar los vencimientos.
- Suites:
  - **unit**: hash, JWT, código HMAC.
  - **integration**: cada ruta y sus escenarios de aceptación, la seed (incluida la concurrencia con dos `bootstrap` en paralelo) y las FKs compuestas (insertar una referencia cruzada falla).
  - **contract**: SC-002 recorre las rutas. También hay una regla de arquitectura: ningún `*_controller.py` importa `AsyncSession` ni `app.core.database`.
- **ruff** (lint y formato) y **mypy** en modo `strict`.

**Rationale**:
- Las FKs compuestas, el `FOR UPDATE` y los *advisory locks* solo se pueden probar en PostgreSQL. SQLite no sirve.

**Alternatives considered**: SQLite en memoria (no soporta esas garantías) y mocks de sesión (no prueban lo importante).

## R14. Versión de Python y gestión de dependencias

**Decision**:
- Python **3.13** con **uv** (`pyproject.toml` + `uv.lock` versionado).
- Dependencias, con la versión exacta fijada en `uv.lock` al implementar:
  - **Runtime**: `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]>=2.0`, `asyncpg`, `alembic`, `pydantic>=2`, `pydantic-settings`, `email-validator`, `pyjwt`, `pwdlib[argon2]`, `httpx`.
  - **Desarrollo**: `pytest`, `pytest-asyncio`, `testcontainers[postgres]`, `respx`, `ruff`, `mypy`.

**Rationale**:
- 3.13 es estable y todas las dependencias tienen wheels. La 3.14 local también sirve para desarrollar.
- uv ya está instalado y simplifica la imagen Docker.

**Alternatives considered**: Poetry, más lento y sin ventaja aquí, y pip + requirements, sin lock reproducible.

## R15. Columnas de sincronización en el servidor

**Decision**:
- **Mixins de modelo**:
  - `SyncColumnsMixin`: `created_at`, `updated_at` y `deleted_at` (`TIMESTAMPTZ`), más `server_updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`).
  - `UserOwnedMixin`: `user_id UUID NOT NULL FK users ON DELETE CASCADE` e índice (`user_id`, `server_updated_at`).
- Los IDs son UUID que asigna el cliente. Solo el servidor genera, con uuid4, los de las categorías de la seed y los de usuarios y tokens.
- `server_updated_at` lo escribe siempre el repositorio, nunca el cliente.

**Rationale**:
- Deja la estructura lista para el PULL (Principio II).
- `clock_timestamp()` en lugar de `now()` da marcas distintas dentro de una misma transacción.
- Queda pendiente para la feature de sync: garantizar que un cursor no salte transacciones que se confirmen tarde. Por ejemplo, con un margen de solapamiento o con una secuencia en lugar de un timestamp.

**Alternatives considered**: triggers de base de datos para `server_updated_at`. Se pueden añadir en la feature de sync si el repositorio no basta.

## R16. Unicidad de categorías con borrado lógico

**Decision**: la regla `UNIQUE (user_id, name, kind)` de `docs/db-finanzas.md` se implementa como **índice único parcial** `WHERE deleted_at IS NULL`.

**Rationale**: si no, una categoría borrada impediría volver a crear otra con el mismo nombre (crear y eliminar categorías llegará en una feature posterior). Se documentará en `docs/db-finanzas.md`.

**Alternatives considered**: la restricción completa, que bloquea nombres para siempre.
