# Quickstart: validar datos locales, sincronización e inicio de sesión

Guía de validación de punta a punta. Detalle de comportamiento: [contracts/](./contracts/) y [data-model.md](./data-model.md).

## Requisitos

1. API y PostgreSQL en marcha (ver `README.md` › API):
   ```bash
   docker compose up --build        # desde la raíz; API en http://localhost:8000
   ```
   En el `.env` de la raíz, añade el origen de la web de desarrollo: `CORS_ORIGINS=http://localhost:8081`.
2. Usuario de la seed (`INITIAL_USER_EMAIL` / `INITIAL_USER_PASSWORD`).
3. App configurada con la URL de la API en `apps/mobile/.env` (no versionado; `.env.example` sí):
   ```bash
   EXPO_PUBLIC_API_URL=http://<IP-de-tu-PC-en-la-LAN>:8000/api/v1   # Android
   # Para web basta http://localhost:8000/api/v1
   ```
4. Android: development build nuevo, porque se añaden módulos nativos (`expo-sqlite`, `expo-secure-store`, `expo-network`):
   ```bash
   cd apps/mobile && npm run build:dev:android   # o npx expo run:android
   ```

## Comprobaciones automáticas

```bash
cd apps/mobile
npm run typecheck && npm run lint && npm test
```

Deben pasar, entre otras, las pruebas de: mappers (montos `0.10`/`0.20`/`999999999999.99` ida y vuelta), motor de sync contra SQLite real + servidor falso (LWW, paginación, reintentos 1–5 veces sin duplicados, ack que no limpia ediciones concurrentes, `INVALID_CURSOR`, `413`), single-flight de renovación y guarda de rutas.

## 0. Verificación previa: SQLite en web (antes de migrar pantallas)

```bash
cd apps/mobile && npm run web
```

En Chrome y Firefox: la consola no muestra errores de WASM ni de `SharedArrayBuffer`; en DevTools › Network, el documento lleva `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: credentialless`. Crear un dato, recargar: sigue ahí.

## 1. Sin sesión todo es privado (US1)

1. Instalación limpia → se ve el login, nunca Inicio.
2. Web: abrir directamente `http://localhost:8081/finance/accounts` → redirige a `/login` sin destello de contenido. Iniciar sesión → aterriza en `/finance/accounts`.
3. Credenciales incorrectas → "Correo o contraseña incorrectos.", el correo sigue escrito. Seis intentos fallidos → mensaje de espera.
4. Con sesión, abrir `/login` → redirige a `/`.

## 2. Primer sync y datos reales (US2, US3)

1. Tras el primer login: indicador "Descargando tus datos…", luego Finanzas muestra las 15 categorías y los estados vacíos. Ningún dato de prueba ni "Alex"; Inicio saluda con el nombre de la seed.
2. Ajustes: sin sección de datos de prueba; "Sincronizado", 0 pendientes, hora del último sync.

## 3. Offline-first y persistencia (US2)

1. Modo avión. Crear una cuenta "Prueba" con saldo inicial `0.10` y una transacción de `0.20` → aparecen al instante. Ajustes: "Sin conexión", **2 pendientes**.
2. Cerrar la app por completo y reabrirla (aún en modo avión) → entra directo a Inicio; cuenta y transacción siguen; saldo `0,30`.

## 4. Sincronización entre dispositivos (US3)

1. Quitar el modo avión → en ≤ 5 s Ajustes pasa a 0 pendientes.
2. En la web (mismo usuario): la cuenta "Prueba" aparece con saldo exactamente `0,30` (SC-007).
3. Editar el nombre en la web; en Android, volver a primer plano → se ve el cambio.
4. Conflicto: ambos sin red, editar la misma cuenta (Android primero, web después); reconectar ambos y sincronizar → ambos muestran la versión de la web.
5. Reinstalar la app en Android, iniciar sesión → recupera todo.

## 5. Rechazos y "Descartar mi cambio" (US4)

1. Forzar un rechazo: adelantar el reloj del dispositivo 2 días, editar una cuenta, volver a la hora automática y sincronizar → Ajustes muestra el rechazo con el aviso de fecha adelantada (`CLOCK_AHEAD`).
2. "Descartar mi cambio" → confirmar → tras el siguiente sync, la cuenta muestra la versión del servidor y el rechazo desaparece.

## 6. Sesión vencida y reauth (US6)

1. En la API, revocar las sesiones del usuario (p. ej. completar "olvidé mi contraseña" desde la web, que revoca todas).
2. En Android, hacer un cambio y sincronizar → aviso "Tu sesión venció…", la app sigue usable con datos locales.
3. "Iniciar sesión" → reauth con la misma cuenta → el cambio pendiente se sube.

## 7. Cerrar sesión (US5)

1. Con 1 pendiente y sin red → "Cerrar sesión" advierte "Se perderá 1 cambio" → confirmar → login.
2. Volver a iniciar sesión → se descargan los datos del servidor (sin el cambio perdido). En web, DevTools › Application: `localStorage` sin `bt.session`/`bt.profile` tras cerrar sesión.

## 8. Recuperar contraseña (US7)

Con `RESEND_API_KEY` configurada: login › "¿Olvidaste tu contraseña?" → correo → código de 6 dígitos → contraseña nueva → vuelve al login con el correo precargado → iniciar sesión con la nueva.

## 9. Varias pestañas (web)

Abrir una segunda pestaña → "BermudezTechOS ya está abierto en otra pestaña". Cerrar la primera y pulsar "Reintentar" → carga normal.
