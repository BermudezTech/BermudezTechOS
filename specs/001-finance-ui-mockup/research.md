# Research — 001-finance-ui-mockup

Decisiones técnicas para construir la UI con datos de prueba. Cada una indica qué se eligió, por qué y
qué alternativas se descartaron. Las versiones exactas se fijan al crear el proyecto (`npx
create-expo-app`) con el SDK estable vigente; aquí se indican mínimos.

## R1. Base del proyecto y enrutamiento

- **Decision**: Expo (SDK estable más reciente, ≥ 54) con TypeScript estricto y **Expo Router**
  (rutas por archivos), en `apps/mobile`. Nueva Arquitectura de React Native activada (por defecto).
- **Rationale**: Expo Router funciona igual en Android y web, da URLs reales en web (botón atrás del
  navegador, recarga — FR-006), *deep links* gratis y layouts anidados (tabs → stack) que encajan con
  la estructura módulo → pantallas.
- **Alternatives considered**: React Navigation "a mano" (más código de configuración, URLs web
  manuales); proyecto *bare* (pierde la comodidad de Expo sin necesidad).

## R2. Menú adaptable (barra inferior ↔ barra lateral)

- **Decision**: un único navegador de pestañas (`Tabs` de Expo Router, basado en React Navigation 7)
  con un componente `tabBar` propio (`AppNavBar`) que, según `useWindowDimensions().width`, se
  dibuja como barra inferior (< 1024 px) o barra lateral izquierda (≥ 1024 px). Las entradas salen
  del **registro de módulos** (R3).
- **Rationale**: una sola jerarquía de rutas: al redimensionar la ventana cambia solo la
  presentación y no se pierde la pantalla actual (edge case de la spec). Un `tabBar` propio permite
  la estética glass y mostrar entradas "Próximamente" no navegables, que las pestañas estándar no
  soportan.
- **Alternatives considered**: `Drawer` en web + `Tabs` en móvil (dos árboles de navegación,
  estado que se pierde al cambiar); `tabBarPosition: 'left'` nativo (no admite entradas
  deshabilitadas ni el estilo deseado sin sobrescribirlo igualmente).

## R3. Extensibilidad de módulos (FR-005, SC-007)

- **Decision**: `src/modules/registry.ts` exporta una lista de `AppModule` (`id`, `label`, `icon`,
  `route`, `status: 'active' | 'coming_soon'`). El menú y Ajustes se generan desde ella. Cada módulo
  activo tiene su carpeta en `src/modules/<id>/` y su grupo de rutas en `app/(tabs)/<id>/`.
- **Rationale**: añadir un módulo = una entrada en el registro + su carpeta; ninguna otra pantalla
  cambia.
- **Alternatives considered**: menú escrito a mano en el layout (cada módulo nuevo toca el layout y
  el menú).

## R4. Estado y datos de prueba

- **Decision**: **Zustand** como store en memoria por entidad (cuentas, categorías, movimientos,
  suscripciones, grupos, CDTs, bienes), inicializado con un *seed* tipado (`mock/seed.ts`). Las
  pantallas **no** usan el store directamente: consumen *hooks* de un contrato `FinanceRepository`
  ([contracts/finance-repository.md](./contracts/finance-repository.md)) cuya implementación actual
  es `InMemoryFinanceRepository`. Los valores derivados (saldos, totales, estadísticas) los calculan
  funciones puras del dominio, memoizadas con selectores.
- **Rationale**: FR-031/FR-032: cuando exista la capa SQLite se cambia la implementación del
  repositorio, no las pantallas. Zustand es mínimo, sin *boilerplate*, y sus selectores evitan
  re-renders en Android gama media. El borrado es lógico (`deletedAt`) desde ya.
- **Alternatives considered**: React Context + `useReducer` (re-renders amplios, más código);
  Redux Toolkit (sobredimensionado para datos en memoria); TanStack Query (pensado para datos
  remotos; se puede reconsiderar con la capa real).

## R5. Representación de montos (Principio IV)

- **Decision**: los montos se manejan como **enteros en centavos** (tipo marcado
  `Cents = number & { __brand: 'Cents' }`), igual que en la futura base SQLite. Toda la aritmética
  pasa por `src/lib/money.ts` (`add`, `sub`, `sum`, `negate`, `parse`, `format`, `abbreviate`), que
  valida `Number.isSafeInteger` en cada resultado. Los cálculos con tasas (intereses de CDT,
  retención, prorrateo de anuales, porcentajes) usan **decimal.js** y redondean a centavos
  (*half-up*) una sola vez al final.
- **Rationale**: el máximo de la spec (999.999.999.999,99 → 9,99·10¹³ centavos) cabe de sobra en un
  entero seguro de JS (9·10¹⁵), así que las sumas/restas de enteros son exactas. Coincide con el
  esquema cliente de `docs/db-finanzas.md` y con `CLAUDE.md`. El tipo marcado impide mezclar montos
  con números sueltos en TypeScript.
- **Alternatives considered**: `bigint` (exacto, pero no serializa a JSON y complica la interop con
  SQLite y las gráficas); `dinero.js` v2 (API cómoda pero aún en pre-release prolongado);
  `decimal.js` para todo (más pesado y verboso para sumas que ya son exactas).

## R6. Formato de montos y fechas (FR-034, FR-035)

- **Decision**: formateador propio de COP sobre centavos (`$ 1.234.567,89`; signo `−` explícito;
  sin decimales cuando son `,00` en tarjetas de resumen; abreviado `1,2 M` / `350 mil` con el valor
  completo en `accessibilityLabel`). Fechas con **date-fns** v4 + locale `es` + `@date-fns/tz` para
  convertir de UTC a la zona del dispositivo (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
- **Rationale**: `Intl.NumberFormat('es-CO')` produce salidas distintas entre Hermes y navegadores
  (espacios, símbolo); un formateador propio sobre enteros es determinista y testeable.
- **Alternatives considered**: `Intl.NumberFormat` (inconsistente entre plataformas); `dayjs`
  (manejo de zonas horarias menos sólido).

## R7. Estética liquid glass con rendimiento (Principio VI)

- **Decision**: componente base `GlassSurface` con tres niveles:
  1. **Web**: `backdrop-filter: blur()` real vía estilos web + borde y brillo sutiles.
  2. **Android**: blur real con `expo-blur` (método experimental de blur en Android) **solo** en
     superficies flotantes: barra de navegación, hojas modales y el botón de acción rápida.
  3. **Resto (tarjetas, listas)**: "glass simulado" — fondo translúcido sobre un fondo de
     degradado vibrante (`expo-linear-gradient`), borde claro semitransparente y sombra suave; sin
     blur.
  Animaciones con **Reanimated** (hilo de UI) y `react-native-gesture-handler`. Íconos con
  `@expo/vector-icons`. Tipografía con `expo-font` (p. ej. Inter).
- **Rationale**: el blur en Android es costoso; limitarlo a ≤ 2 capas visibles a la vez mantiene la
  fluidez en gama media (SC-004) conservando el efecto donde más se nota.
- **Alternatives considered**: blur en todas las tarjetas (caída de FPS en Android); `expo-glass-effect`
  (solo iOS 26+, no aplica a Android/web).

## R8. Tema y tokens

- **Decision**: `src/theme/` con tokens (`colors`, `gradients`, `radii`, `spacing`, `typography`,
  `glass` [opacidad, blur, borde], `motion`) para modo claro y oscuro; `ThemeProvider` que combina
  `useColorScheme()` con la preferencia de Ajustes (`system | light | dark`). Componentes leen el
  tema con `useTheme()`. La preferencia se guarda en memoria en esta fase.
- **Rationale**: FR-036 y `CLAUDE.md` piden tokens centralizados; un proveedor propio evita
  depender de una librería de estilos.
- **Alternatives considered**: NativeWind/Tailwind (rápido, pero la estética glass depende de valores
  dinámicos por tema y plataforma que se expresan mejor como tokens TS); Tamagui (curva de
  aprendizaje y configuración pesada para el alcance).

## R9. Gráficas (FR-021, FR-023)

- **Decision**: **react-native-gifted-charts** (sobre `react-native-svg`) para dona/torta de
  categorías, barras y línea de evolución.
- **Rationale**: funciona en Android y web sin motor nativo adicional, cubre los tres tipos de
  gráfica necesarios y admite colores/gradientes por tema.
- **Alternatives considered**: `victory-native` (requiere Skia; en web carga CanvasKit, varios MB);
  gráficas propias con `react-native-svg` (más trabajo sin beneficio claro).

## R10. Formularios y validación

- **Decision**: **react-hook-form** + **zod** (esquemas por entidad en el dominio de finanzas).
  Entrada de montos con teclado decimal y parseo a centavos con `money.parse` (rechaza > 2
  decimales, ≤ 0, valores no numéricos — FR-017). Formularios como rutas modales (`presentation:
  'modal'`) para que funcionen con URL en web.
- **Rationale**: validación declarativa reutilizable cuando llegue la API; buen rendimiento
  (inputs no controlados).
- **Alternatives considered**: Formik (más re-renders); validación manual (repetitiva).

## R11. IDs y fechas en datos de prueba

- **Decision**: IDs UUID v4 generados en cliente (`expo-crypto` `randomUUID`); el seed usa UUIDs
  fijos para que sea reproducible. Todas las fechas/hora en ISO-8601 UTC; fechas puras
  `YYYY-MM-DD`. El seed se genera **relativo a hoy** (últimos 13 meses) para que siempre haya datos
  del mes actual, CDTs próximos a vencer y bienes con valor vencido.
- **Rationale**: misma forma que la base futura (Principio I); datos útiles cualquier día que se
  abra la app.
- **Alternatives considered**: seed con fechas fijas (se "envejece" y deja vistas vacías).

## R12. Pruebas

- **Decision**: **Jest** (`jest-expo`) + **React Native Testing Library**. Obligatorio (constitución,
  "Flujo de trabajo y calidad"): pruebas unitarias de `lib/money`, `lib/dates` y de todas las
  funciones de dominio (saldos, saldo disponible, gasto por categoría con exclusiones, patrimonio,
  CDT, suscripciones, saldo de grupos). Pruebas de componentes para formularios clave (validación
  de movimiento). Verificación visual/manual en Android y web según
  [quickstart.md](./quickstart.md).
- **Rationale**: SC-003 (saldos exactos al centavo) se garantiza con pruebas del dominio.
- **Alternatives considered**: E2E con Maestro/Playwright desde ya (útil más adelante; costo alto
  para una UI que aún cambiará).

## R13. Pantalla Finanzas → Resumen (FR-004)

- **Decision**: la pantalla raíz de Finanzas es un **hub**: tarjetas de resumen (saldo disponible
  total, patrimonio neto, gasto del mes vs. anterior, últimos 5 movimientos) que llevan al detalle,
  más accesos a las 7 subsecciones. Es el contenido que antes estaba en el dashboard principal.
- **Rationale**: la spec lista "Resumen" pero no lo define; SC-006 requiere encontrar saldo
  disponible y gasto del mes partiendo del dashboard (Inicio → Finanzas). Confirmar con el usuario
  o con `/speckit-clarify`.
- **Alternatives considered**: solo accesos sin datos (SC-006 exigiría más pasos).

## R14. Compatibilidad web

- **Decision**: `expo start --web` con el bundler Metro y salida *single-page*. No se usa ninguna
  API nativa sin equivalente web en esta fase (no hay SQLite, SecureStore ni notificaciones); el
  blur web usa CSS. La verificación de Expo SQLite en web (OPFS/WASM) queda para la feature de datos.
- **Rationale**: Principio VI; evita bloquear la UI por dependencias que esta fase no necesita.
