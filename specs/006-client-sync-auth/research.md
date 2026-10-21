# Research: Datos locales reales, sincronización e inicio de sesión en la app

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Fecha**: 2026-10-20

Referencias de Expo verificadas contra la documentación de SDK 58 (`docs.expo.dev/versions/v58.0.0`), como exige `apps/mobile/AGENTS.md`.

---

## R1. Base local: Expo SQLite en Android y web

- **Decision**: `expo-sqlite` (instalado con `npx expo install expo-sqlite`), una sola base `bermudeztech.db` abierta al arrancar con `openDatabaseAsync`. En web usa la build WebAssembly de SQLite. Configuración necesaria:
  - `metro.config.js` (creado con `npx expo customize metro.config.js`): añadir `wasm` a `resolver.assetExts` y, en el servidor de desarrollo, las cabeceras `Cross-Origin-Embedder-Policy: credentialless` y `Cross-Origin-Opener-Policy: same-origin` (vía `server.enhanceMiddleware`). El snippet exacto se toma de la guía de SQLite de SDK 58 al implementar.
  - En el hosting de la web (cuando se despliegue), las mismas dos cabeceras.
- **Rationale**: lo fija la constitución (Principio VI y restricciones técnicas). SDK 58 lista web como plataforma soportada para casi toda la API. `credentialless` (en lugar de `require-corp`) permite seguir llamando a la API por CORS y cargar recursos de otros orígenes sin cabeceras CORP.
- **Limitaciones confirmadas en la doc**: `withExclusiveTransactionAsync` **no existe en web**, y `withTransactionAsync` no es exclusiva (otra consulta asíncrona concurrente puede colarse en la transacción). Ver R3.
- **Verificación previa obligatoria** (Principio VI): la primera tarea de implementación es un *spike* que abre la base en web (Chrome y Firefox, dev server), escribe, recarga la página y lee. Si falla, se detiene la feature y se replantea el plan para web antes de migrar las pantallas.
- **Alternatives considered**: IndexedDB propio en web + SQLite en Android (dos implementaciones del almacén, doble superficie de bugs); `expo-sqlite/kv-store` (no relacional, no sirve para 8 tablas con consultas).

## R2. Cómo leen las pantallas: espejo en memoria de la base local

- **Decision**: SQLite es la fuente de verdad. El store de zustand actual (`useFinanceStore`) se conserva como **espejo en memoria** de las ocho tablas:
  - Al arrancar con sesión, se cargan todas las filas de SQLite al store (hidratación) antes de ocultar el splash.
  - Toda escritura (repositorios o sync) escribe **primero** en SQLite dentro de una transacción y, solo si confirma, aplica el mismo cambio al store.
  - Los hooks y la lógica de dominio no cambian: siguen leyendo el store con selectores síncronos.
- **Rationale**: es el cambio mínimo que mantiene intactas ~40 pantallas, hooks y pruebas de dominio (FR-008: "las pantallas mantienen su comportamiento"). El volumen es pequeño (≈ 5.000 transacciones/año, unos pocos MB en memoria), y la hidratación es una lectura secuencial por tabla. Cumple el Principio I: la UI nunca espera a la red y lo escrito queda en la base del dispositivo antes de reflejarse.
- **Alternatives considered**: reescribir los hooks para consultar SQLite (async en cada pantalla, estados de carga nuevos, reescritura de pruebas: mucho más trabajo sin beneficio para el MVP); `addDatabaseChangeListener` para refrescar el store (innecesario: todas las escrituras pasan por nuestro código).
- **Revisión futura**: si el volumen crece (varios años), se puede paginar `transactions` por periodo sin cambiar el contrato de los hooks.

## R3. Atomicidad y concurrencia de escrituras

- **Decision**: un **mutex asíncrono global** (`dbWriteLock`) serializa todas las transacciones de escritura (repositorios, sync, borrado al cerrar sesión). Dentro del lock se usa `withTransactionAsync`. Las lecturas de la sync (registros sucios) también se hacen dentro del lock para obtener un snapshot coherente.
- **Rationale**: como `withTransactionAsync` no es exclusiva y `withExclusiveTransactionAsync` no existe en web, la única forma portable de garantizar FR-011 (escrituras multi-registro atómicas) y que la sync no intercale con una edición es serializar en JS. El coste es despreciable: las escrituras son de milisegundos y la red nunca se espera con el lock tomado.
- **Regla**: el lock **nunca** se mantiene durante una petición HTTP. La sync toma el lock para leer, lo suelta, hace la petición, y lo vuelve a tomar para aplicar el resultado.
- **Alternatives considered**: `withExclusiveTransactionAsync` en nativo y otra cosa en web (dos caminos); confiar en que no haya concurrencia (falla con el disparador de 5 s tras cambios).

## R4. Varias pestañas en web

- **Decision**: al arrancar en web, la app pide el lock `bermudeztech-db` de la Web Locks API (`navigator.locks.request` con `ifAvailable: true`) y lo mantiene mientras la pestaña está abierta. Si otra pestaña ya lo tiene, esta muestra una pantalla "BermudezTechOS ya está abierto en otra pestaña" con un botón para reintentar, sin abrir la base.
- **Rationale**: dos pestañas escribiendo y sincronizando sobre el mismo archivo romperían el espejo en memoria de la otra y podrían corromper la base. La Web Locks API está disponible en todos los navegadores actuales y se libera sola al cerrar la pestaña.
- **Alternatives considered**: `BroadcastChannel` para coordinar pestañas (mucho más complejo); ignorarlo (riesgo de datos).

## R5. Almacenamiento de la sesión

- **Decision**: módulo `tokenStorage` con dos implementaciones por plataforma:
  - `tokenStorage.ts` (Android): `expo-secure-store` (`setItemAsync`/`getItemAsync`/`deleteItemAsync`), claves `bt.session` (JSON con tokens y vencimientos) y `bt.profile`.
  - `tokenStorage.web.ts`: `window.localStorage` con las mismas claves (Clarificación 2026-10-20: la sesión persiste en web). Al arrancar en web se llama a `navigator.storage.persist()` para pedir almacenamiento persistente.
- **Rationale**: `expo-secure-store` **no soporta web** (SDK 58). `localStorage` es síncrono, sobrevive al cierre del navegador y es suficiente con el riesgo aceptado en la clarificación (sin scripts de terceros). En Android, SecureStore cifra con Keystore. Los tokens nunca van a SQLite ni a logs (FR-028).
- **Plugin**: `expo-secure-store` se añade a `plugins` de `app.json` con `configureAndroidBackup: true` (por defecto) para que no se restauren tokens de otro dispositivo desde un backup.
- **Alternatives considered**: cookies `HttpOnly` en web (requiere cambios en el backend, que usa tokens en el cuerpo); guardar en `expo-sqlite/kv-store` (sin cifrado en Android, y mezclaría credenciales con datos que se borran).

## R6. Cliente HTTP y renovación de sesión

- **Decision**: `apiClient` propio sobre `fetch` (sin dependencias nuevas):
  - Base `EXPO_PUBLIC_API_URL` (p. ej. `http://192.168.1.10:8000/api/v1` en desarrollo, la URL de Coolify en producción), validada al arrancar.
  - Añade `Authorization: Bearer` a las rutas protegidas. Antes de cada petición, si el acceso vence en menos de 30 s, renueva primero.
  - Ante `401 UNAUTHENTICATED`, renueva **una vez** y reintenta la petición.
  - **Single-flight**: una sola promesa de renovación compartida por todas las peticiones concurrentes (FR-030).
  - Renovación con `401 INVALID_REFRESH_TOKEN` ⇒ sesión **vencida** (FR-031): no se borra nada, el estado de sesión pasa a `expired` y la sync se pausa. Un error de red durante la renovación **no** es vencimiento: se trata como "sin conexión".
  - Errores tipados: `NetworkError`, `ApiError { status, code, message, details, retryAfter }`, con el sobre de error común de la spec 003.
  - Timeout de 20 s por petición con `AbortController`.
- **Rationale**: el contrato es pequeño (8 rutas) y la lógica crítica (single-flight, clasificación de errores) necesita pruebas propias; una librería no la evita.
- **Alternatives considered**: axios + interceptores (dependencia extra, mismo trabajo para single-flight); TanStack Query (no aporta: la UI no consulta la red).

## R7. Conectividad

- **Decision**: `expo-network` (`addNetworkStateListener` y `getNetworkStateAsync`). "Online" = `isConnected && isInternetReachable !== false`. Además, cualquier `NetworkError` del `apiClient` pone el estado en "sin conexión" hasta el siguiente evento de red o disparador.
- **Rationale**: es el módulo de Expo recomendado y soporta web (en web solo distingue conectado/no conectado, suficiente).
- **Alternatives considered**: `@react-native-community/netinfo` (módulo de terceros con la misma función).

## R8. Algoritmo de sincronización en el cliente

- **Decision**: motor `syncEngine.run()` sin dependencias de React, inyectable (base, `apiClient`, reloj) para probarlo:
  1. **Guardas**: online, sesión no vencida y sin otro ciclo en curso (si lo hay, se marca `rerunRequested` y el ciclo actual se repite una vez al terminar; FR-020).
  2. **PUSH**: dentro del lock, leer todas las filas `is_dirty = 1`, ordenadas por dependencias (`categories` → `reimbursement_groups` → `assets` → `accounts` [padres antes que subcuentas] → `subscriptions` → `recurring_incomes` → `cdts` [anteriores antes que renovaciones] → `transactions`), y recordar el `updated_at` enviado de cada una. Fuera del lock, enviar en trozos de ≤ 500 en ese orden (un trozo posterior puede referenciar a uno anterior porque el servidor ya lo aplicó).
  3. **Resultado del PUSH** (dentro del lock, por trozo):
     - `APPLIED` / `DISCARDED`: `UPDATE … SET is_dirty = 0 WHERE id = ? AND updated_at = ?enviado` (FR-014: si se editó mientras tanto, sigue sucio) y borrar su fila de `sync_rejections`.
     - `DISCARDED` además pone `pull_cursor = NULL` en `sync_metadata` para esa tabla (ver R9).
     - `REJECTED`: upsert en `sync_rejections` (código, mensaje, `updated_at` enviado). Sigue sucio.
     - `413 PUSH_TOO_LARGE`: partir el trozo a la mitad y reintentar (defensa ante el límite de 2 MB).
  4. **PULL**: cursores de `sync_metadata`; repetir `POST /sync/pull` mientras `hasMore` total sea `true`. Cada página se aplica en una transacción con la regla de FR-017:
     - Si no existe localmente o `is_dirty = 0` ⇒ upsert con los datos del servidor y `server_updated_at`.
     - Si `is_dirty = 1` y `incoming.updatedAt > local.updated_at` ⇒ upsert, `is_dirty = 0` y borrar el rechazo.
     - En otro caso, conservar la local.
     - Un registro con montos o fechas que no se puedan convertir exactamente se omite y se registra como error de sync (no rompe la página).
  5. **Cursores**: el cursor de una tabla se guarda (con `last_synced_at`) en la misma transacción en que se aplica la página donde esa tabla llega con `hasMore = false`. Así un primer sync interrumpido no repite las tablas ya completas. Como el PUSH de todas las tablas ya terminó en el paso 2, se cumple FR-018 ("tras PUSH y PULL de la tabla").
  6. `422 INVALID_CURSOR` ⇒ poner a `NULL` el cursor de la tabla indicada en `details` y repetir el PULL.
  7. Tras aplicar cada transacción, actualizar el espejo en memoria (R2) y los contadores de estado.
- **Idempotencia (FR-019)**: interrumpir en cualquier punto deja filas sucias que se reenvían (el servidor responde `DISCARDED` a lo ya aplicado) y cursores antiguos que hacen re-aplicar páginas (upsert por id). Ninguna operación crea filas nuevas con IDs nuevos.
- **Alternatives considered**: guardar todos los cursores al final del ciclo, como sugiere el flujo de referencia de la spec 004 (igual de correcto, pero un primer sync de 5.000 registros interrumpido empezaría de cero); un `dirty_version` contador en vez de comparar `updated_at` (columna extra; `updated_at` en milisegundos basta, porque dos ediciones del mismo registro en el mismo milisegundo no ocurren por interacción humana).

## R9. Recuperar la versión del servidor sin endpoint por ID

- **Problema**: hay dos casos en los que la app necesita la versión actual del servidor de un registro que **no** volverá a llegar con el cursor actual:
  1. `DISCARDED` porque el servidor tenía una versión más reciente que la app ya había bajado antes de editar localmente (reloj atrasado).
  2. "Descartar mi cambio" de un registro rechazado (FR-015a).
- **Decision**: poner `pull_cursor = NULL` para esa tabla. El siguiente PULL trae la tabla completa y, como el registro ya no está sucio, se sobrescribe con la versión del servidor. Las demás filas limpias se re-aplican sin efecto y las sucias se protegen con la regla de FR-017.
- **Rationale**: no requiere cambios en el backend (Assumption de la spec). Ocurre rara vez (conflictos reales, reintentos o acción manual). El peor caso, `transactions` con 5.000 filas, son 5 páginas.
- **Alternatives considered**: nueva ruta "traer registros por ID" en la API (cambio de backend para un caso raro); guardar una copia de la última versión del servidor por registro (duplica la base).

## R10. "Descartar mi cambio" (FR-015a)

- **Decision**:
  - **Registro que ya existía en el servidor** (`server_updated_at` no nulo): `is_dirty = 0`, borrar el rechazo y `pull_cursor = NULL` de su tabla (R9).
  - **Registro que nunca llegó al servidor** (`server_updated_at` nulo): calcular sus **dependientes locales sucios** (filas sucias que lo referencian, de forma transitiva, según el mapa de referencias de [data-model.md](./data-model.md) §3), mostrar el número en la confirmación y, si se acepta, borrarlos **físicamente** junto con él, con sus rechazos. Se pone además `pull_cursor = NULL` de esas tablas por si alguno sí existía en el servidor (p. ej. un PULL fallido dejó `server_updated_at` sin actualizar); en ese caso, volverá.
- **Rationale**: un registro que el servidor nunca vio no tiene "versión del servidor"; borrarlo físicamente es lo que el usuario espera de "descartar". El borrado físico no se propaga a nadie porque nunca salió del dispositivo.

## R11. Guarda de rutas con Expo Router

- **Decision**: grupos de rutas `src/app/(auth)/` (públicas) y `src/app/(app)/` (privadas; `(tabs)` se mueve dentro). En el `_layout.tsx` raíz:
  ```tsx
  <Stack.Protected guard={isSignedIn} redirectTo="/login"> <Stack.Screen name="(app)" /> </Stack.Protected>
  <Stack.Protected guard={!isSignedIn}> <Stack.Screen name="(auth)" /> </Stack.Protected>
  ```
  `Stack.Protected` con `redirectTo` está disponible desde SDK 58. Al cambiar el guard (cerrar sesión), la historia de las pantallas protegidas se elimina.
- **Volver a la ruta pedida (FR-036)**: `Stack.Protected` no conserva la ruta original. Al arrancar sin sesión, la app guarda en memoria la URL inicial (`Linking.getInitialURL()` en nativo, `window.location` en web) si apunta a una ruta privada. Tras el login, si hay una ruta pendiente, `router.replace(pending)`; si no, `/`.
- **Carga (FR-038)**: el splash nativo (`SplashScreen.preventAutoHideAsync`, ya usado) se mantiene hasta resolver fuentes, sesión, base e hidratación. Mientras tanto el layout raíz devuelve `null`, así que no se renderiza ninguna ruta.
- **Módulos futuros (FR-039)**: todo lo que se añada bajo `(app)/` es privado sin configuración extra.
- **"Sesión iniciada" para la guarda**: hay sesión guardada, **esté vigente o vencida**. Con la sesión vencida (FR-031) el usuario sigue en las pantallas privadas usando sus datos locales. La re-autenticación es una pantalla privada `(app)/reauth` (modal), no la pública `/login`.
- **Alternatives considered**: `<Redirect>` dentro de un layout de grupo (válido, pero `Stack.Protected` limpia la historia al cerrar sesión y es el patrón oficial); proteger cada pantalla (no escala).

## R12. Propietario de los datos locales (FR-032)

- **Decision**: guardar el `id` del usuario (del perfil `GET /users/me`) dentro de `bt.profile` en el almacenamiento de sesión, **no** en SQLite. En la re-autenticación se compara con el `id` del nuevo perfil. Si difiere, se avisa del borrado con el número de pendientes; si se confirma, se vacía la base y se guarda la sesión nueva.
- **Rationale**: la constitución prohíbe `user_id` en la base local; el perfil ya vive en el almacenamiento de sesión y se borra con ella.

## R13. Cierre de sesión y borrado local

- **Decision**: `signOut()`:
  1. Si hay pendientes y conexión, ejecuta un ciclo de sync.
  2. Si siguen quedando pendientes (sin red o rechazados), la pantalla pide confirmación indicando cuántos se perderán.
  3. `POST /auth/logout` con el refresh token, "best effort" (sin red o con error se ignora).
  4. Dentro del lock: `DELETE FROM` las ocho tablas, `sync_metadata` y `sync_rejections` en una transacción. La base y su esquema se conservan.
  5. Vaciar el espejo en memoria, borrar `bt.session` y `bt.profile`, y poner la sesión en `signedOut` (la guarda lleva a `/login`).
- **Rationale**: `DELETE` funciona igual en Android y web, y evita cerrar y reabrir la base (en web el archivo está bloqueado por el handle abierto). Cumple SC-009.
- **Alternatives considered**: `deleteDatabaseAsync` (requiere cerrar la conexión y reabrirla; más frágil en web).

## R14. Disparadores de sincronización

- **Decision**: `syncScheduler`, montado una vez en `(app)/_layout.tsx`:
  - Al montar (tras login o al abrir la app con sesión).
  - `AppState` pasa a `active` ⇒ sync. Al pasar a `background` se cancelan los timers.
  - `addNetworkStateListener`: de offline a online ⇒ sync.
  - Escrituras locales: los repositorios llaman a `notifyLocalChange()`, que reinicia un debounce de **5 s**.
  - Intervalo de **5 min** solo con `AppState` activo (en web, `document.visibilityState === 'visible'`, que `AppState` refleja).
  - "Sincronizar ahora" en Ajustes llama a `run()` directamente.
- Sin red, los disparadores se ignoran sin error (FR-022), y no hay reintentos en bucle: el siguiente disparador lo intenta.
- **Rationale**: es la Clarificación 2026-10-20 (FR-021).

## R15. Conversión de formatos (cliente ↔ API)

- **Decision**: un `mapper` por tabla con dos funciones puras, `toWire(row)` y `fromWire(json)`, basadas en una descripción declarativa de columnas (nombre, tipo: `money` | `rate` | `date` | `datetime` | `bool` | `int` | `text` | `enum`):
  - `money`: `Cents` ↔ string con exactamente 2 decimales, conversión **por texto** (`"1234.56"` ↔ `123456`), sin `Number(parseFloat(...))`. Se rechaza más de 2 decimales y todo valor fuera de `MAX_CENTS`.
  - `rate` (`annualRateEa`, `annualRateNominal`, `withholdingRate`): string sin transformar (el cliente ya los maneja como string con `decimal.js`).
  - `datetime`: ISO-8601 UTC tal cual. `date`: `YYYY-MM-DD`.
  - Los nombres JSON coinciden con los campos camelCase del modelo actual del cliente ([data-model.md](./data-model.md) §2), así que el mapper solo convierte tipos.
- Se prueban con valores que fallan en punto flotante (`0.10`, `0.20`, `0.30`, `999999999999.99`) para SC-007.

## R16. Pruebas

- **Decision**:
  - Lógica pura (mappers, orden de dependencias, regla de FR-017, cálculo de dependientes, clasificación de errores, single-flight): Jest, como hoy.
  - Motor de sync y repositorios contra SQL real: la capa de base expone una interfaz mínima `SqlDatabase` (`runAsync`, `getAllAsync`, `getFirstAsync`, `execAsync`, `withTransactionAsync`) que implementa `expo-sqlite`. En pruebas se usa un adaptador sobre **`better-sqlite3`** (devDependency) con base en memoria. Se simula la API con un servidor falso en memoria que implementa LWW y paginación según el contrato de la spec 004.
  - Guarda de rutas: pruebas de `@testing-library/react-native` sobre el árbol de layouts con el estado de sesión simulado.
  - De punta a punta: el [quickstart](./quickstart.md) contra la API real en Docker, en Android y web.
- **Rationale**: la constitución exige pruebas automatizadas para la lógica de sincronización. Probar contra SQLite real (mismo dialecto) evita que pasen pruebas con SQL inválido.
- **Alternatives considered**: `sql.js` (WASM, más lento al arrancar en Jest); mockear SQLite (no detecta errores de SQL).

## R17. Red en desarrollo para Android

- **Decision**: en desarrollo, la API se sirve por HTTP en la LAN. Android bloquea el tráfico sin cifrar por defecto, así que se añade `expo-build-properties` con `android.usesCleartextTraffic: true` **solo** en el perfil de desarrollo (configuración condicionada en `app.config.ts` por `APP_VARIANT`), o bien se usa la URL HTTPS de Coolify. Producción siempre HTTPS.
- **CORS**: el backend ya soporta `CORS_ORIGINS`. Para desarrollo web hay que incluir `http://localhost:8081` en `.env` de la API.

## R18. Retiro de los datos de prueba

- **Decision**: eliminar `data/mock/` (`seed.ts`, `seed.test.ts`), `seededId` de `lib/ids.ts`, `session/mockUser.ts`, `hooks/useMockData.ts`, el campo `seedMode` del store y la sección de datos de prueba de Ajustes. `data/inMemory/` pasa a `data/local/` (repositorios sobre SQLite + espejo). La regla de ESLint que impide a las pantallas importar la capa de datos se actualiza a la nueva ruta.
- Las pruebas de dominio que usaban el seed siguen usando `domain/testUtils.ts` (fábricas propias).
- **Débitos de suscripciones**: hoy la app **no** genera débitos automáticos (las suscripciones solo se listan). No hay nada que adaptar en esta feature; el caso límite de la spec queda cubierto por el servidor (spec 004) cuando se implemente la generación.
