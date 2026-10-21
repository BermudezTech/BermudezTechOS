# Feature Specification: Datos locales reales, sincronización e inicio de sesión en la app

**Feature Branch**: `006-client-sync-auth`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Quita los datos de mockup del frontend, e implementa la base de datos con Expo SQLite incluyendo la columna de sincronización dirty. Luego, implementa la sincronización con los endpoints que están ya en el backend para sincronización y los endpoints de Auth. Crea en el frontend el login y los guards con las rutas privadas que sean solo accesibles con la sesión iniciada"

**Documentos de referencia**: [`CLAUDE.md`](../../CLAUDE.md), [`docs/db-finanzas.md`](../../docs/db-finanzas.md), y las specs [`001-finance-ui-mockup`](../001-finance-ui-mockup/spec.md), [`003-backend-jwt-auth`](../003-backend-jwt-auth/spec.md) y [`004-data-sync`](../004-data-sync/spec.md).

## Contexto

Hoy la app muestra datos de prueba generados en memoria: se pierden al cerrarla, el usuario es ficticio ("Alex") y Ajustes ofrece botones para restablecer o vaciar esos datos. El servidor ya tiene inicio de sesión, renovación, cierre de sesión, recuperación de contraseña, perfil (spec 003) y sincronización PUSH/PULL de las ocho tablas de finanzas (spec 004). La spec 004 dejó fuera explícitamente el lado de la app; esta feature lo cubre.

Esta feature conecta las pantallas existentes con datos reales:

1. **Base local persistente** en el dispositivo como única fuente de lectura y escritura de la interfaz, con la marca de "cambio pendiente de subir" en cada registro.
2. **Sincronización** con el servidor (primero subir, luego bajar) usando las operaciones existentes.
3. **Inicio de sesión y protección de rutas**: sin sesión solo se ven las pantallas públicas (inicio de sesión y recuperación de contraseña).
4. **Retiro de los datos de prueba** y de toda la interfaz asociada a ellos.

## Clarifications

### Session 2026-10-20

- Q: ¿Cuándo debe sincronizar la app: solo al abrirla o de forma constante? → A: Ninguna de las dos: por eventos (inicio de sesión, abrir o volver a la app, recuperar la conexión, ~5 s después de cambios locales agrupados) más un respaldo periódico cada 5 min solo con la app en primer plano, y manual desde Ajustes. Sin sync con la app cerrada ni en tiempo real.
- Q: En web, ¿la sesión persiste al cerrar el navegador o se pide iniciar sesión cada vez? → A: Persiste, igual que en Android: al reabrir se entra directo, también sin conexión.
- Q: Cuando el servidor rechaza un cambio, ¿qué puede hacer el usuario con ese registro? → A: Ver el motivo en Ajustes y corregirlo desde su pantalla habitual (se reintenta en cada sync), o pulsar "Descartar mi cambio" en Ajustes para recuperar la versión del servidor (o eliminar el registro local si nunca llegó al servidor).
- Q: ¿La app debe pedir huella, rostro o PIN para abrirse, además de la sesión? → A: No, queda fuera de alcance; será una feature posterior.

## Alcance

**Incluido**:

- Base local persistente con las ocho tablas de finanzas (`accounts`, `categories`, `reimbursement_groups`, `subscriptions`, `recurring_incomes`, `cdts`, `assets`, `transactions`) y la tabla de control de sincronización por tabla.
- Reemplazo del almacén en memoria por la base local, sin cambiar el comportamiento de las pantallas.
- Ciclo de sincronización PUSH → PULL, sus disparadores y su estado visible para el usuario.
- Pantallas de inicio de sesión y de recuperación de contraseña (pedir código, validar código, definir contraseña nueva).
- Guarda de rutas: todas las pantallas actuales pasan a ser privadas.
- Persistencia segura de la sesión, renovación automática y cierre de sesión con borrado de la base local.
- Perfil real del usuario (nombre y correo) en Inicio y Ajustes.
- Eliminación de los datos de prueba, del usuario ficticio y de los controles de restablecer/vaciar.

**Excluido**:

- Cambios en las operaciones del servidor (auth y sync se usan tal como están).
- Registro de usuarios desde la app (no existe en el servidor).
- Crear, editar o eliminar categorías desde la app (la app recibe las del servidor).
- Sincronización en segundo plano con la app cerrada y notificaciones push.
- Bloqueo de la app con huella, rostro o PIN (feature posterior).
- Módulos distintos de finanzas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Iniciar sesión y acceder solo con sesión (Priority: P1)

El usuario abre la app por primera vez y ve la pantalla de inicio de sesión. Escribe su correo y contraseña y entra a Inicio. Si cierra la app y la vuelve a abrir, entra directamente sin volver a escribir sus credenciales, incluso sin conexión. Nadie sin sesión puede ver Inicio, Finanzas ni Ajustes, ni siquiera abriendo un enlace directo a esas pantallas.

**Why this priority**: sin sesión no hay sincronización posible (el servidor exige identidad) y los datos financieros quedarían expuestos. Es la puerta de entrada a todo lo demás.

**Independent Test**: con el usuario de la seed del servidor, abrir la app sin sesión, comprobar que cualquier ruta redirige al inicio de sesión, iniciar sesión, ver el nombre real en Inicio, cerrar y reabrir la app (también en modo avión) y comprobar que sigue dentro.

**Acceptance Scenarios**:

1. **Given** la app sin sesión guardada, **When** se abre, **Then** muestra la pantalla de inicio de sesión y ninguna pantalla privada.
2. **Given** la app sin sesión, **When** se intenta abrir una ruta privada (p. ej. un enlace directo a Finanzas › Cuentas), **Then** se redirige al inicio de sesión y, tras iniciar sesión, se lleva al usuario a la pantalla que pidió.
3. **Given** credenciales correctas, **When** el usuario inicia sesión, **Then** entra a Inicio y ve su nombre real (o su correo si no tiene nombre).
4. **Given** correo o contraseña incorrectos, **When** intenta iniciar sesión, **Then** ve un mensaje genérico de credenciales inválidas, sin indicar cuál de los dos falló, y conserva el correo escrito.
5. **Given** demasiados intentos fallidos (bloqueo temporal del servidor), **When** intenta de nuevo, **Then** ve un mensaje que indica que espere antes de reintentar.
6. **Given** que no hay conexión y no hay sesión guardada, **When** intenta iniciar sesión, **Then** ve un mensaje claro de que se necesita conexión para el primer inicio de sesión.
7. **Given** una sesión guardada, **When** abre la app sin conexión, **Then** entra directamente a Inicio con sus datos locales.
8. **Given** la sesión iniciada, **When** abre la pantalla de inicio de sesión (p. ej. con un enlace directo), **Then** se le lleva a Inicio.

---

### User Story 2 - Mis datos se guardan en el dispositivo y no se pierden (Priority: P1)

El usuario registra un gasto, crea una cuenta o edita una suscripción, con o sin conexión. Al cerrar y reabrir la app, todo sigue ahí. Ya no aparecen datos de ejemplo: lo que ve es lo suyo. Cada cambio queda marcado como pendiente de subir hasta que se sincroniza.

**Why this priority**: es el corazón offline-first. Sin persistencia local la app no sirve para el uso diario, aunque haya sincronización.

**Independent Test**: con sesión iniciada y en modo avión, crear una cuenta y una transacción, cerrar la app por completo, reabrirla y comprobar que ambas siguen, con saldos correctos, y que aparecen como pendientes de sincronizar.

**Acceptance Scenarios**:

1. **Given** la sesión iniciada, **When** el usuario crea, edita o borra cualquier registro de finanzas, **Then** el cambio se refleja de inmediato en pantalla, sin esperar a la red.
2. **Given** cambios hechos, **When** se cierra y reabre la app, **Then** todos los cambios siguen ahí, con los mismos montos al centavo.
3. **Given** un registro creado o modificado localmente, **When** se guarda, **Then** queda marcado como pendiente de subir y su fecha de modificación se actualiza.
4. **Given** un registro borrado por el usuario, **When** se guarda, **Then** desaparece de las pantallas pero se conserva como borrado lógico pendiente de subir.
5. **Given** la app en cualquier estado, **When** el usuario recorre Inicio, Finanzas y Ajustes, **Then** no aparece ningún dato de prueba, ni el usuario ficticio, ni los botones de restablecer o vaciar datos de prueba.
6. **Given** un usuario sin datos aún (aparte de las categorías iniciales), **When** abre cada sección, **Then** ve los estados vacíos ya diseñados con su acción principal.
7. **Given** las reglas de validación existentes (montos positivos, transferencia con cuentas distintas, categoría del tipo correcto, etc.), **When** el usuario guarda datos inválidos, **Then** recibe los mismos mensajes que hoy y no se guarda nada.

---

### User Story 3 - Sincronizar con el servidor (Priority: P1)

Cuando hay conexión, la app sube los cambios pendientes y luego baja los cambios del servidor. En el primer inicio de sesión en un dispositivo descarga todos los datos del usuario, incluidas sus categorías. Así el usuario puede reinstalar la app, cambiar de teléfono o usar la web y ver lo mismo.

**Why this priority**: sin sincronización los datos solo viven en un dispositivo y se pierden con él. Con las historias 1 y 2 forma el MVP completo de esta feature.

**Independent Test**: con dos instancias de la app (Android y web) y el mismo usuario, crear un registro en una sin conexión, recuperar la red, y comprobar que aparece en la otra tras sincronizar. Reinstalar una de ellas y comprobar que recupera todos los datos.

**Acceptance Scenarios**:

1. **Given** un dispositivo sin datos locales, **When** el usuario inicia sesión, **Then** la app descarga todos sus datos (incluidas sus 15 categorías iniciales en el primer uso), muestra que está descargando, y al terminar las pantallas muestran esos datos.
2. **Given** cambios pendientes y conexión, **When** se dispara una sincronización, **Then** la app primero sube los pendientes y luego baja los cambios del servidor, en ese orden.
3. **Given** que el servidor confirmó un registro como aplicado o descartado, **When** termina la subida, **Then** ese registro deja de estar pendiente, salvo que el usuario lo haya vuelto a modificar mientras se sincronizaba.
4. **Given** que el servidor descartó un cambio local porque tenía una versión más reciente, **When** termina la bajada, **Then** el dispositivo muestra la versión del servidor.
5. **Given** cambios en el servidor desde el último sync de una tabla, **When** se baja, **Then** solo se descargan esos cambios (incluidos borrados lógicos), no la tabla completa.
6. **Given** un registro modificado localmente y aún pendiente, **When** la bajada trae una versión más antigua de ese registro, **Then** se conserva la versión local.
7. **Given** que la sincronización se interrumpe (sin red, app cerrada, error), **When** se reintenta, **Then** termina con el mismo resultado que si no se hubiera interrumpido, sin duplicados ni pérdidas.
8. **Given** más cambios en el servidor de los que caben en una respuesta, **When** se baja, **Then** la app sigue pidiendo hasta recibirlos todos.
9. **Given** más cambios pendientes que el máximo de una subida, **When** se sube, **Then** la app los envía en varios lotes.

---

### User Story 4 - Ver el estado de la sincronización (Priority: P2)

El usuario quiere saber si sus datos están respaldados. En Ajustes ve cuándo se sincronizó por última vez, cuántos cambios están pendientes y si hay algún problema. Puede forzar una sincronización manual.

**Why this priority**: da confianza, pero la sincronización automática funciona sin esta vista.

**Independent Test**: en modo avión, hacer 3 cambios y comprobar que Ajustes muestra "3 cambios pendientes" y la hora del último sync; recuperar la red, pulsar "Sincronizar ahora" y comprobar que pasa a 0 pendientes con la hora actualizada.

**Acceptance Scenarios**:

1. **Given** la sesión iniciada, **When** el usuario abre Ajustes, **Then** ve la hora del último sync exitoso (o "nunca"), el número de cambios pendientes y el estado actual (sincronizado, sincronizando, sin conexión o con errores).
2. **Given** conexión, **When** pulsa "Sincronizar ahora", **Then** se ejecuta un ciclo completo y el estado se actualiza al terminar.
3. **Given** que el servidor rechazó algún registro, **When** el usuario abre Ajustes, **Then** ve cuántos registros fueron rechazados y un motivo comprensible para cada uno.
4. **Given** un registro rechazado, **When** el usuario pulsa "Descartar mi cambio" y confirma, **Then** el registro deja de estar pendiente y tras el siguiente sync muestra la versión del servidor; si nunca llegó al servidor, desaparece junto con los registros pendientes que dependían de él.
5. **Given** que el servidor rechazó registros porque la fecha del dispositivo está adelantada, **When** termina la sincronización, **Then** el usuario ve un aviso específico pidiéndole que revise la fecha y hora de su dispositivo.

---

### User Story 5 - Cerrar sesión de forma segura (Priority: P2)

El usuario cierra sesión desde Ajustes. La app intenta subir los cambios pendientes, cierra la sesión en el servidor y borra todos los datos locales y credenciales, de modo que otra persona que use el dispositivo no vea nada.

**Why this priority**: necesario para la privacidad y para cambiar de usuario, pero no bloquea el uso diario.

**Independent Test**: con datos sincronizados, cerrar sesión y comprobar que se vuelve al inicio de sesión, que no queda ningún dato local y que al volver a entrar se descargan de nuevo.

**Acceptance Scenarios**:

1. **Given** la sesión iniciada y sin cambios pendientes, **When** el usuario confirma cerrar sesión, **Then** la sesión se cierra en el servidor, se borran la base local y las credenciales, y se muestra el inicio de sesión.
2. **Given** cambios pendientes y conexión, **When** cierra sesión, **Then** la app sincroniza primero y, si todo se sube, cierra sesión.
3. **Given** cambios pendientes que no se pueden subir (sin conexión o rechazados), **When** cierra sesión, **Then** la app advierte cuántos cambios se perderán y solo continúa si el usuario lo confirma.
4. **Given** que no hay conexión, **When** el usuario confirma cerrar sesión, **Then** los datos y credenciales locales se borran igualmente, aunque el servidor no se entere del cierre.

---

### User Story 6 - Renovación de sesión y sesión vencida (Priority: P2)

La sesión se renueva sola mientras el usuario usa la app, sin interrumpirlo. Si la sesión ya no se puede renovar (pasaron más de 7 días sin conexión, o la sesión fue revocada), la app sigue funcionando con los datos locales y pide iniciar sesión de nuevo para volver a sincronizar, sin perder los cambios pendientes.

**Why this priority**: la sesión de acceso dura 15 minutos; sin renovación transparente el usuario tendría que entrar constantemente.

**Independent Test**: dejar vencer el acceso (15 min) y sincronizar: debe funcionar sin pedir credenciales. Revocar la sesión en el servidor, hacer un cambio local y sincronizar: la app pide reingresar, y tras hacerlo con el mismo usuario el cambio pendiente se sube.

**Acceptance Scenarios**:

1. **Given** un acceso vencido y una renovación vigente, **When** la app necesita llamar al servidor, **Then** renueva la sesión y completa la operación sin intervención del usuario.
2. **Given** varias operaciones simultáneas con el acceso vencido, **When** se renueva, **Then** se hace una sola renovación y todas las operaciones continúan.
3. **Given** una renovación inválida o vencida, **When** la app intenta sincronizar, **Then** muestra un aviso no bloqueante de "sesión vencida, inicia sesión para sincronizar" y el usuario puede seguir usando sus datos locales.
4. **Given** la sesión vencida con cambios pendientes, **When** el usuario vuelve a iniciar sesión con la **misma** cuenta, **Then** se conservan los datos locales y se suben los pendientes.
5. **Given** la sesión vencida, **When** alguien inicia sesión con una cuenta **distinta**, **Then** la app advierte que se borrarán los datos locales de la cuenta anterior (indicando cuántos cambios pendientes se perderán) y solo continúa si se confirma.
6. **Given** que el usuario cambió su contraseña desde otro dispositivo (lo que revoca todas las sesiones), **When** esta app intenta renovar, **Then** se comporta como en el escenario 3.

---

### User Story 7 - Recuperar la contraseña olvidada (Priority: P3)

Desde el inicio de sesión, el usuario pulsa "¿Olvidaste tu contraseña?", escribe su correo, recibe un código de 6 dígitos, lo introduce y define una contraseña nueva. Después inicia sesión con ella.

**Why this priority**: el servidor ya lo ofrece y evita quedar fuera de la app, pero es un flujo poco frecuente.

**Independent Test**: con el envío de correos configurado en el servidor, completar el flujo y luego iniciar sesión con la contraseña nueva.

**Acceptance Scenarios**:

1. **Given** la pantalla de recuperación, **When** el usuario envía su correo, **Then** ve siempre el mismo mensaje ("si el correo existe, te enviamos un código"), exista o no la cuenta.
2. **Given** un código correcto y vigente, **When** lo introduce, **Then** pasa a definir su contraseña nueva.
3. **Given** un código incorrecto, vencido o agotado, **When** lo introduce, **Then** ve un mensaje genérico y puede pedir un código nuevo.
4. **Given** una contraseña nueva válida (8–128 caracteres) confirmada dos veces, **When** la guarda, **Then** ve una confirmación y vuelve al inicio de sesión con el correo ya escrito.
5. **Given** una contraseña nueva que no cumple la longitud o no coincide con la confirmación, **When** intenta guardarla, **Then** ve el error en el campo y no se envía.

---

### Edge Cases

- **Edición durante la sincronización**: si el usuario modifica un registro mientras se sube, ese registro sigue pendiente tras el sync y se sube en el siguiente; la confirmación del servidor no debe borrar la marca de un cambio más nuevo.
- **Bajada que trae un registro pendiente local**: si la versión del servidor es más reciente que la local, gana la del servidor; si no, se conserva la local (que ganará en el próximo PUSH).
- **Registro rechazado por el servidor**: se queda en el dispositivo, sigue pendiente y se muestra en Ajustes con su motivo. Los registros rechazados no bloquean la subida del resto ni el avance de la bajada. Se reintentan en cada sync (si el usuario lo corrige, se sube la versión corregida) hasta que se suban o el usuario descarte su cambio (FR-015a).
- **Registros que dependen de uno rechazado**: el servidor también los rechaza; la app los trata igual que al rechazado.
- **Interrupción a mitad de bajada paginada**: el avance por tabla solo se guarda cuando la tabla se completa; al reintentar, se retoma de forma segura sin perder ni duplicar registros.
- **Sincronizaciones solapadas**: si se dispara una sincronización mientras otra está en curso, no se ejecutan dos a la vez.
- **Débitos automáticos de suscripciones**: la app sigue generándolos localmente con su identificador determinista; si otro dispositivo generó el mismo, se tratan como el mismo registro.
- **Primer sync interrumpido**: el usuario ve sus datos parcialmente descargados y un indicador de que la descarga no terminó; el siguiente sync la completa.
- **Monto recibido con formato inesperado** del servidor: el registro se ignora y se informa como error de sincronización; nunca se convierte con pérdida de precisión.
- **Error del servidor o respuesta inválida**: el sync se marca como fallido, los pendientes siguen pendientes, y se reintenta en el próximo disparador; la interfaz nunca se bloquea.
- **Credenciales en web**: en el navegador las credenciales se guardan en el almacenamiento persistente del sitio; si la persistencia local no está disponible (p. ej. modo privado), la app lo indica en lugar de fallar en silencio.
- **El navegador borra el almacenamiento del sitio** (el usuario limpia los datos, o el navegador lo desaloja por falta de espacio o inactividad): la app arranca sin sesión ni datos, como un dispositivo nuevo; los cambios pendientes no subidos se pierden. La app MUST pedir al navegador que marque el almacenamiento como persistente para reducir este riesgo.
- **Dos pestañas de la web abiertas**: no deben corromper la base local ni ejecutar dos sincronizaciones simultáneas sobre los mismos datos.
- **Cambio de hora del dispositivo**: los cursores de bajada vienen del servidor, así que un reloj desfasado no hace perder cambios del servidor.

## Requirements *(mandatory)*

### Functional Requirements

**Retiro de datos de prueba**

- **FR-001**: La app MUST NOT generar, cargar ni mostrar datos de prueba. Se eliminan el generador de datos de ejemplo, el almacén en memoria como fuente de datos, el usuario ficticio y los controles de "restablecer/vaciar datos de prueba" de Ajustes.
- **FR-002**: Las categorías MUST provenir exclusivamente del servidor (llegan en el primer sync); la app MUST NOT crear su propio set de categorías.

**Base local**

- **FR-003**: La app MUST guardar las ocho tablas de finanzas en una base local persistente en el dispositivo (Android y web), con la misma estructura lógica que `docs/db-finanzas.md`, sin el propietario (`user_id`).
- **FR-004**: Cada registro sincronizable MUST tener ID generado en el cliente (UUID), fecha de creación, fecha de modificación, borrado lógico, la marca del servidor recibida en la última bajada (vacía si nunca se subió) y una marca de "pendiente de subir" (`is_dirty`).
- **FR-005**: Toda creación, edición o borrado hecho por el usuario (o por generación automática local, como los débitos de suscripciones) MUST actualizar la fecha de modificación en UTC y marcar el registro como pendiente, en la misma operación que el cambio.
- **FR-006**: Los borrados MUST ser lógicos; los registros borrados MUST NOT mostrarse en las pantallas ni contar en saldos o resúmenes.
- **FR-007**: Los montos MUST almacenarse y operarse en la app con precisión decimal exacta (nunca punto flotante) y conservar exactamente el valor recibido del servidor y enviado a él.
- **FR-008**: La interfaz MUST leer y escribir solo en la base local; ninguna pantalla MUST esperar a la red para mostrar o guardar datos. Las pantallas existentes MUST mantener su comportamiento y validaciones actuales.
- **FR-009**: La base local MUST incluir una tabla de control de sincronización por tabla con el cursor opaco devuelto por el servidor y la hora del último sync exitoso.
- **FR-010**: La estructura de la base local MUST poder evolucionar con migraciones versionadas que se aplican al abrir la app sin perder datos.
- **FR-011**: Las escrituras que afectan a varios registros a la vez (p. ej. transferencia con su efecto en dos cuentas, cerrar un grupo de reembolso) MUST ser atómicas: o se guardan todas o ninguna.

**Sincronización**

- **FR-012**: Un ciclo de sincronización MUST ejecutar primero la subida de todos los pendientes y después la bajada de los cambios del servidor.
- **FR-013**: La subida MUST enviar los registros completos pendientes de todas las tablas, en lotes que no superen el máximo admitido por el servidor (500 registros).
- **FR-014**: Tras la subida, la app MUST quitar la marca de pendiente a los registros informados como aplicados o descartados, solo si no se modificaron de nuevo localmente desde que se enviaron.
- **FR-015**: Los registros rechazados MUST permanecer pendientes y quedar registrados con su código y motivo para mostrarlos al usuario; MUST NOT impedir la subida del resto ni la bajada.
- **FR-015a**: Para cada registro rechazado, el usuario MUST poder elegir en Ajustes "Descartar mi cambio". Si el registro ya existía en el servidor, la app MUST dejar de considerarlo pendiente y recuperar la versión del servidor en el siguiente sync. Si nunca llegó al servidor, la app MUST eliminarlo localmente. Si otros registros locales pendientes dependen de él (p. ej. transacciones de una cuenta nueva rechazada), la app MUST indicar cuántos y descartarlos junto con él, solo tras confirmación del usuario.
- **FR-016**: La bajada MUST enviar, por tabla, el último cursor guardado (ninguno en el primer sync) y aplicar localmente todos los registros recibidos, incluidos los borrados lógicos, siguiendo la paginación hasta que el servidor indique que no hay más.
- **FR-017**: Al aplicar un registro bajado, la app MUST sobrescribir el local si este no está pendiente, o si está pendiente pero la versión del servidor tiene una fecha de modificación estrictamente más reciente; en otro caso conserva la versión local pendiente.
- **FR-018**: El cursor de una tabla MUST guardarse solo después de completar con éxito la subida y la bajada de esa tabla; el cursor MUST ser el que entrega el servidor, nunca uno calculado con el reloj del dispositivo.
- **FR-019**: Un ciclo de sincronización MUST ser seguro de reintentar en cualquier punto de interrupción: el resultado final es el mismo, sin duplicados ni pérdidas.
- **FR-020**: Solo MUST ejecutarse un ciclo de sincronización a la vez por dispositivo; si se dispara otro mientras uno está en curso, se ejecuta al terminar el actual (una sola vez).
- **FR-021**: La sincronización MUST dispararse automáticamente: al iniciar sesión, al abrir la app o volver a primer plano, al recuperar la conexión, unos 5 segundos después del último cambio local (agrupando cambios seguidos en un solo ciclo) y cada 5 minutos mientras la app está en primer plano. El usuario también MUST poder dispararla manualmente desde Ajustes. Con la app cerrada o en segundo plano MUST NOT sincronizar.
- **FR-022**: Sin conexión, la app MUST NOT intentar sincronizar en bucle ni mostrar errores repetidos; espera a recuperar la conexión.
- **FR-023**: La app MUST mostrar el estado de sincronización: último sync exitoso, número de cambios pendientes, número de registros rechazados con su motivo, y si está sincronizando, sin conexión, con la sesión vencida o con error.
- **FR-024**: Ante registros rechazados por fecha del dispositivo adelantada, la app MUST mostrar un aviso específico para revisar la fecha y hora del dispositivo.
- **FR-025**: Durante el primer sync de un dispositivo, la app MUST indicar que está descargando los datos del usuario y, al terminar, actualizar las pantallas sin que el usuario tenga que hacer nada.

**Autenticación y sesión**

- **FR-026**: La app MUST ofrecer una pantalla de inicio de sesión con correo y contraseña, con validación de formato antes de enviar, indicador de carga y mensajes de error genéricos para credenciales inválidas, bloqueo temporal por intentos, falta de conexión y error del servidor.
- **FR-027**: Tras iniciar sesión, la app MUST obtener y guardar el perfil del usuario (nombre y correo) y mostrarlo en Inicio y Ajustes en lugar del usuario ficticio, también sin conexión.
- **FR-028**: Los tokens de acceso y de renovación MUST guardarse en el almacenamiento seguro del dispositivo (en web, el almacenamiento persistente del navegador para ese sitio, que sobrevive al cierre del navegador) y MUST NOT guardarse en la base local ni en registros de depuración. La web MUST mantener la sesión entre visitas igual que Android.
- **FR-029**: Al abrir la app con una sesión guardada, la app MUST entrar directamente a las pantallas privadas sin requerir conexión.
- **FR-030**: La app MUST renovar la sesión automáticamente cuando el acceso venza, rotando y guardando el nuevo token de renovación; las peticiones simultáneas MUST compartir una sola renovación.
- **FR-031**: Si la renovación falla por sesión inválida o vencida, la app MUST conservar los datos locales, permitir seguir usándolos, mostrar un aviso no bloqueante para volver a iniciar sesión y pausar la sincronización hasta entonces.
- **FR-032**: La app MUST recordar a qué cuenta pertenecen los datos locales. Al iniciar sesión con la misma cuenta, conserva los datos; con una cuenta distinta, MUST advertir del borrado (indicando los cambios pendientes que se perderán) y borrar la base local antes de continuar, solo si el usuario lo confirma.
- **FR-033**: Cerrar sesión MUST: intentar sincronizar los pendientes; advertir y pedir confirmación si quedan pendientes sin subir; cerrar la sesión en el servidor si hay conexión; y en todo caso borrar la base local, las credenciales y el perfil guardado, y volver al inicio de sesión.
- **FR-034**: La app MUST ofrecer el flujo de recuperación de contraseña de tres pasos (pedir código por correo, validar el código de 6 dígitos, definir contraseña nueva de 8 a 128 caracteres con confirmación), con mensajes genéricos que no revelen si el correo existe.

**Rutas privadas**

- **FR-035**: Todas las pantallas actuales (Inicio, Finanzas y sus subpantallas, Ajustes) MUST ser privadas. Las únicas pantallas públicas MUST ser inicio de sesión y recuperación de contraseña.
- **FR-036**: Sin sesión, cualquier intento de abrir una pantalla privada (navegación interna, enlace directo o URL en web) MUST redirigir al inicio de sesión sin mostrar, ni siquiera por un instante, contenido privado. Tras iniciar sesión, MUST llevar a la pantalla originalmente solicitada si existe, o a Inicio.
- **FR-037**: Con sesión, abrir una pantalla pública de autenticación MUST redirigir a Inicio.
- **FR-038**: Mientras la app determina si hay sesión al arrancar, MUST mostrar la pantalla de carga existente, no el inicio de sesión ni pantallas privadas.
- **FR-039**: La protección de rutas MUST definirse en un único punto, de forma que los módulos futuros queden privados por defecto sin configuración adicional.
- **FR-040**: Las nuevas pantallas MUST seguir el sistema visual existente (liquid glass, modo claro y oscuro) y funcionar en Android y web.

### Key Entities

- **Registro local sincronizable**: fila de cualquiera de las ocho tablas de finanzas en el dispositivo. Tiene ID, fechas de creación y modificación (UTC), borrado lógico, marca del servidor y marca de pendiente. No guarda propietario.
- **Control de sincronización por tabla**: nombre de tabla, cursor opaco del servidor y hora del último sync exitoso (informativa).
- **Rechazo de sincronización**: tabla, ID del registro, código y motivo legible del rechazo más reciente; se limpia cuando el registro se sube con éxito.
- **Sesión**: token de acceso, token de renovación y perfil del usuario (identificador, correo, nombre). Vive en almacenamiento seguro, fuera de la base local.
- **Propietario de los datos locales**: identificador del usuario dueño de la base local, usado solo para decidir si conservar o borrar los datos al iniciar sesión.
- **Estado de sincronización**: en curso / sincronizado / sin conexión / sesión vencida / con errores, más contadores de pendientes y rechazados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las pantallas privadas redirige al inicio de sesión sin sesión en las pruebas de navegación directa (Android y web), sin mostrar contenido privado en ningún momento.
- **SC-002**: Un usuario con sesión guardada llega a Inicio con sus datos en menos de 2 segundos al abrir la app, con o sin conexión.
- **SC-003**: Guardar cualquier registro se refleja en pantalla en menos de 300 ms en un Android de gama media, sin conexión.
- **SC-004**: El 100 % de los cambios hechos sin conexión sobrevive a cerrar la app y llega a un segundo dispositivo tras recuperar la red y sincronizar ambos.
- **SC-005**: Interrumpir la sincronización en cualquier punto y reintentarla de 1 a 5 veces deja exactamente el mismo estado local y en el servidor (0 duplicados, 0 pérdidas).
- **SC-006**: El primer sync de un usuario con un año de datos (≈ 5.000 transacciones) termina en menos de 30 segundos con una conexión móvil normal, y la app sigue siendo usable durante la descarga.
- **SC-007**: Ningún monto cambia de valor al centavo en el ciclo dispositivo → servidor → otro dispositivo, verificado con valores que fallan en punto flotante (p. ej. `0.10 + 0.20`).
- **SC-008**: El usuario no tiene que volver a escribir su contraseña mientras use la app al menos una vez cada 7 días con conexión.
- **SC-009**: Tras cerrar sesión, no queda ningún dato financiero ni credencial del usuario en el dispositivo.
- **SC-010**: No queda ninguna referencia a datos de prueba ni al usuario ficticio en la app.
- **SC-011**: Un usuario completa el inicio de sesión en menos de 30 segundos y la recuperación de contraseña (con el correo a mano) en menos de 3 minutos.

## Assumptions

- Las operaciones del servidor de autenticación (spec 003) y sincronización (spec 004) se usan tal como están; si el plan detecta una carencia imprescindible, se documenta allí como cambio menor.
- La base local usa Expo SQLite, como fija la constitución; su funcionamiento en web debe verificarse antes de depender de él (riesgo a cubrir en el plan).
- La dirección del servidor se configura por entorno de compilación de la app, no por el usuario.
- No hay datos de prueba que migrar: hoy viven solo en memoria y se pierden al cerrar la app.
- Los registros rechazados se reintentan en cada sync sin límite hasta que el usuario los corrija o descarte su cambio desde Ajustes; no hay una pantalla dedicada a editar rechazos.
- La recuperación de contraseña se incluye porque sus operaciones ya existen en el servidor; es la historia de menor prioridad y puede entregarse aparte.
- El MVP tiene un solo usuario real, pero la app soporta cambiar de cuenta en el mismo dispositivo borrando los datos locales.
