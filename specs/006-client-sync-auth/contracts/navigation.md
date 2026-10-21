# Contrato: rutas y guarda de sesión

Implementación: research R11. Las URLs de las pantallas existentes **no cambian** (los grupos `(app)` y `(tabs)` no aparecen en la URL).

## Árbol de rutas

```text
src/app/
├── _layout.tsx                 # Raíz: carga (splash), Stack.Protected por sesión
├── +not-found.tsx              # Pública
├── (auth)/                     # Públicas — solo accesibles SIN sesión
│   ├── _layout.tsx
│   ├── login.tsx               # /login
│   ├── forgot-password.tsx     # /forgot-password       (paso 1)
│   ├── verify-code.tsx         # /verify-code?email=…   (paso 2)
│   └── reset-password.tsx      # /reset-password        (paso 3; resetToken en memoria)
└── (app)/                      # Privadas — solo accesibles CON sesión (vigente o vencida)
    ├── _layout.tsx             # Monta syncScheduler y el aviso de sesión vencida
    ├── reauth.tsx              # /reauth (modal): login con sesión vencida
    └── (tabs)/                 # Movido desde src/app/(tabs) sin cambios de URL
        ├── index.tsx           # /
        ├── settings.tsx        # /settings
        └── finance/…           # /finance/…
```

## Reglas

| # | Estado | Navegación | Resultado |
|---|---|---|---|
| N1 | `loading` | Cualquiera | Splash visible; no se renderiza ninguna ruta (FR-038). |
| N2 | `signedOut` | Ruta de `(app)` (interna, enlace profundo o URL web) | Redirige a `/login` sin renderizar la ruta (FR-036). Si fue la URL inicial, se recuerda como ruta pendiente. |
| N3 | `signedOut` | Login correcto | `router.replace(pendiente ?? '/')` y se olvida la pendiente. |
| N4 | `signedIn` | Ruta de `(auth)` | Redirige a `/` (FR-037). |
| N5 | `signedIn` + `expired` | Cualquier ruta de `(app)` | Accesible. Aviso no bloqueante con acción "Iniciar sesión" → `/reauth`. |
| N6 | `signedIn` → `signedOut` (cerrar sesión) | — | La historia de `(app)` se elimina y se muestra `/login`. Atrás no vuelve a pantallas privadas. |
| N7 | Web, otra pestaña tiene el lock | Cualquiera | Pantalla "Ya está abierta en otra pestaña" con "Reintentar"; ni la base ni las rutas se cargan (research R4). |
| N8 | `+not-found` | — | Pública; su enlace "Ir al inicio" lleva a `/` (y la guarda decide). |

## Pantallas nuevas

- **Login** (`/login`): logo, correo, contraseña (con mostrar/ocultar), botón "Iniciar sesión" con carga, enlace "¿Olvidaste tu contraseña?". Conserva el correo tras un error. Acepta `?email=` para precargarlo.
- **Recuperación** (3 pantallas): correo → código de 6 dígitos (con "Reenviar código") → contraseña nueva + confirmación. Mensajes en [api-usage.md](./api-usage.md).
- **Reauth** (`/reauth`, modal): igual que el login, con el correo del perfil precargado. Si el usuario del nuevo login difiere del dueño de los datos, pide confirmación de borrado indicando los pendientes (FR-032).
- **Ajustes** (modificada): tarjeta de perfil real; sección **Sincronización** (estado, último sync, pendientes, "Sincronizar ahora", lista de rechazos con "Descartar mi cambio"); botón **Cerrar sesión**. Se elimina la sección de datos de prueba.
- **Inicio** (modificada): saludo con el nombre del perfil (o el correo). Indicador "Descargando tus datos…" mientras `initialSyncComplete = false` (FR-025).

Todas usan los componentes existentes (`Screen`, `GlassCard`, `TextField`, `Button`, …) y los tokens del tema (FR-040).
