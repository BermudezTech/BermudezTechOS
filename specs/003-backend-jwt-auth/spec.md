# Feature Specification: Backend base con autenticación JWT y datos privados por usuario

**Feature Branch**: `003-backend-jwt-auth`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Ahora que ya tenemos el frontend construido, ahora vamos a ir con el backend, para ello, toma como referencia el @CLAUDE.md, @README.md y los documentos de docs como @docs/db-finanzas.md para establecer la base de datos con SQLAlchemy.... Entonces, para el backend vamos a usar FastAPI, pero de una forma peculiar... Los endpoints deben estar divididos en el controller que es donde se encuentra la ruta y el service donde está la función que hace la ruta, similar a nestjs. Crea el endpoint de autenticación con JWT y también los guards encargados de proteger las rutas. Todo es privado en la BD para el usuario autenticado"

**Documentos de referencia**: [`CLAUDE.md`](../../CLAUDE.md), [`README.md`](../../README.md), [`docs/db-finanzas.md`](../../docs/db-finanzas.md) y [`docs/modulo-finanzas.md`](../../docs/modulo-finanzas.md).

## Resumen

Crear el servidor de BermudezTechOS: la base de datos del módulo de finanzas tal como está diseñada en `docs/db-finanzas.md`, la creación del primer usuario mediante una seed configurada por variables de entorno (no hay registro público), el inicio de sesión con sesiones basadas en tokens (acceso de corta duración + renovación), y una protección que se aplica por defecto a todas las rutas para que **cada usuario solo pueda ver y modificar sus propios datos**. Es la base sobre la que se construirán después la sincronización y las operaciones de datos.

## Clarifications

### Session 2026-10-18

- Q: ¿Quién crea las categorías iniciales del usuario: el servidor, la app o ambos? → A: El servidor, con la seed del usuario. Gastos: Transporte, Alimentación, Entretenimiento, Suscripciones, Servicios, Mercado, Combustible, Parqueadero, Salud, Fitness, Viajes y Ropa. Ingresos: Salario, Rendimientos y Otros ingresos. Más adelante el usuario podrá crear y editar categorías, y eliminarlas si no están en uso.
- Q: ¿Esta feature debe incluir una primera ruta de datos protegida como ejemplo del patrón y prueba de aislamiento? → A: Sí, solo "listar mis categorías" (lectura).
- Q: ¿Cómo se cambia la contraseña olvidada o se desactiva un usuario, si no hay administración desde la app? → A: Con una ruta pública de "olvidé mi contraseña" que envía el correo con Resend, configurado por variables de entorno. No hay desactivación de usuarios: el MVP tiene un solo usuario.
- Q: ¿Qué trae el correo de recuperación: un código para escribir en la app o un enlace? → A: Un código de 6 dígitos. Al validarlo, el usuario pasa directamente a definir su contraseña nueva.
- Q: (aclaración del usuario) ¿Habrá inicio de sesión con Google u otros proveedores? → A: No. La autenticación es solo con correo y contraseña guardados en la base de datos de la app.
- Q: ¿La seed se ejecuta a mano o automáticamente? → A: Automáticamente al arrancar, después de las migraciones, solo si la base de datos no tiene ningún usuario. Si ya existe uno, no hace nada.
- Q: ¿El bloqueo por intentos fallidos de inicio de sesión debe ser por correo, por correo + IP o con espera creciente? → A: Por correo + IP, para que un tercero que conozca el correo no pueda dejar fuera al dueño.
- Q: (aclaración del usuario) Si se reutiliza un token de renovación ya rotado, ¿se cierran todas las sesiones o solo la afectada? → A: Solo la sesión (dispositivo) afectada. Las sesiones de otros dispositivos siguen activas.
- Q: (aclaración del usuario) ¿Las categorías iniciales se crean solo con la seed o cada vez que se registra un usuario? → A: Cada vez que se registra (crea) un usuario, por cualquier vía. Hoy la única vía es la seed, pero cualquier alta futura de usuarios recibe el mismo set.

## Alcance

**Incluido**:

- Estructura completa de la base de datos del servidor para el módulo de finanzas (todas las tablas de `docs/db-finanzas.md` que existen en el servidor), creada y versionada mediante migraciones.
- Registro interno de usuarios (sin ruta pública): crea el usuario junto con su set inicial de categorías. La seed lo usa para crear el primer usuario a partir de variables de entorno.
- Inicio de sesión, renovación de sesión, cierre de sesión y consulta del perfil del usuario autenticado.
- Recuperación de contraseña ("olvidé mi contraseña") por correo electrónico.
- Protección de rutas ("guards"): toda ruta exige un usuario autenticado salvo las explícitamente públicas.
- Mecanismo de acceso a datos que limita toda lectura y escritura al usuario autenticado.
- Una ruta de ejemplo protegida, "listar mis categorías" (solo lectura), que sirve de referencia del patrón controlador/servicio y de prueba de aislamiento entre usuarios.
- Organización del backend en controladores (rutas) y servicios (lógica), al estilo NestJS (ver *Restricciones de arquitectura*).
- Entorno ejecutable con un solo comando (API + base de datos) y documentación de arranque en `README.md`.

**Excluido**:

- Endpoints de sincronización (PUSH/PULL) y operaciones de datos de finanzas (cuentas, movimientos, etc.), incluidos crear, editar y eliminar categorías: feature posterior.
- Registro de usuarios desde la app o la API (autorregistro) y administración de usuarios desde la app.
- Integración del cliente móvil/web (pantallas de login, almacenamiento de tokens, borrado de la base local al cerrar sesión).
- Inicio de sesión con terceros (Google u otros proveedores): no está previsto en ninguna fase. La autenticación es solo con correo y contraseña de la base de datos propia.
- Verificación de correo y autenticación de dos factores.
- Desactivación o eliminación de usuarios, y cambio de contraseña o correo con la sesión iniciada (fuera del flujo de "olvidé mi contraseña").
- Backups automáticos y configuración de despliegue en Coolify más allá de que el entorno sea compatible.
- Módulos distintos de finanzas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear el primer usuario e iniciar sesión (Priority: P1)

La app no permite registrarse. Quien administra el servidor define en variables de entorno el correo, la contraseña y opcionalmente el nombre del primer usuario. En el primer despliegue, la seed lo crea automáticamente al arrancar el servicio. Después esa persona inicia sesión con esas credenciales y recibe una sesión que le permite usar la app.

**Why this priority**: sin usuarios autenticados no puede existir ningún dato privado; es la puerta de entrada a todo lo demás.

**Independent Test**: con las variables de entorno definidas y la base vacía, arrancar el servicio, iniciar sesión con esas credenciales y consultar el perfil con la sesión obtenida.

**Acceptance Scenarios**:

1. **Given** una base de datos sin usuarios y las variables del usuario inicial definidas, **When** arranca el servicio, **Then** después de las migraciones la seed crea el usuario con ese correo, contraseña y nombre, junto con su set inicial de categorías de ingreso y gasto.
2. **Given** la base de datos ya tiene al menos un usuario, **When** el servicio arranca de nuevo (con las mismas variables, con otras o sin ellas), **Then** la seed no hace nada: no crea usuarios ni categorías y no cambia ninguna contraseña.
3. **Given** una base de datos sin usuarios y faltan el correo o la contraseña del usuario inicial, o la contraseña no cumple la regla de longitud, **When** arranca el servicio, **Then** el servicio no arranca, indica claramente qué variable falta o es inválida y no crea nada.
4. **Given** el usuario creado por la seed, **When** inicia sesión con correo y contraseña correctos, **Then** recibe un token de acceso y un token de renovación, y su perfil muestra correo y nombre (nunca la contraseña).
5. **Given** el usuario creado por la seed, **When** inicia sesión con contraseña incorrecta o con un correo inexistente, **Then** recibe el mismo mensaje genérico de "credenciales inválidas", sin revelar cuál de los dos falló.
6. **Given** el servidor en marcha, **When** alguien intenta crear un usuario a través de la API, **Then** no existe ninguna ruta que lo permita.

---

### User Story 2 - Rutas protegidas y datos privados por usuario (Priority: P1)

Toda ruta del servidor, salvo inicio de sesión, renovación, recuperación de contraseña y estado del servicio, exige un usuario autenticado. Cualquier dato que se lea o escriba queda limitado al usuario de la sesión: un usuario nunca puede ver, modificar ni referenciar datos de otro, aunque conozca sus identificadores.

**Why this priority**: la app maneja finanzas personales de varios usuarios; una fuga entre usuarios es el fallo más grave posible.

**Independent Test**: con dos usuarios A y B (el segundo creado por las pruebas, no por la seed), verificar que "listar mis categorías" rechaza solicitudes sin sesión o con sesión inválida/expirada, y que cada uno solo recibe sus propias categorías.

**Acceptance Scenarios**:

1. **Given** una ruta protegida, **When** se llama sin token, con un token mal formado, con firma inválida o expirado, **Then** se responde "no autenticado" y no se ejecuta ninguna lógica de la ruta.
2. **Given** un token de renovación, **When** se usa en lugar de un token de acceso en una ruta protegida, **Then** se rechaza.
3. **Given** los usuarios A y B con categorías propias, **When** A lista sus categorías, **Then** recibe solo las suyas (de gasto e ingreso, sin las borradas), ordenadas, y sin ningún identificador de usuario en la respuesta.
4. **Given** el identificador de un registro de B, **When** A intenta leerlo, modificarlo o usarlo como referencia (p. ej. como cuenta o categoría de un registro propio), **Then** el sistema responde como si el registro no existiera y no cambia nada.
5. **Given** una solicitud de A que incluye un identificador de usuario distinto, **When** se procesa, **Then** el sistema lo ignora y usa siempre el usuario de la sesión.
6. **Given** un token de acceso vigente de un usuario que ya no existe en la base de datos, **When** se usa, **Then** se rechaza.

---

### User Story 3 - Mantener la sesión y cerrarla (Priority: P2)

La sesión de acceso dura poco por seguridad. Cuando vence, la app la renueva con el token de renovación sin pedir de nuevo la contraseña. Al cerrar sesión, el token de renovación deja de servir.

**Why this priority**: necesaria para una experiencia usable en móvil (sin reingresar la contraseña a cada rato), pero la historia 1 ya permite usar el sistema.

**Independent Test**: obtener una sesión, renovarla, comprobar que el token de renovación anterior ya no sirve, cerrar sesión y comprobar que el último token de renovación tampoco sirve.

**Acceptance Scenarios**:

1. **Given** un token de renovación vigente, **When** se solicita renovar la sesión, **Then** se entregan un nuevo token de acceso y un nuevo token de renovación, y el anterior queda invalidado.
2. **Given** un token de renovación ya usado (invalidado por rotación), **When** alguien intenta usarlo de nuevo, **Then** se rechaza y se cierra esa sesión (posible robo de token): ningún token derivado del mismo inicio de sesión vuelve a servir. Las sesiones de otros dispositivos siguen activas.
3. **Given** un token de renovación vencido o revocado, **When** se intenta renovar, **Then** se rechaza y el usuario debe iniciar sesión de nuevo.
4. **Given** una sesión activa, **When** el usuario cierra sesión, **Then** su token de renovación queda revocado; el token de acceso deja de ser útil al vencer.
5. **Given** un usuario con sesiones en dos dispositivos, **When** cierra sesión en uno, **Then** la del otro dispositivo sigue activa.
6. **Given** un usuario con sesiones en dos dispositivos, **When** se reutiliza un token ya rotado de uno de ellos, **Then** solo se cierra la sesión de ese dispositivo y el otro sigue renovando con normalidad.
7. **Given** un usuario sin sesiones, **When** inicia sesión en varios dispositivos a la vez, **Then** cada uno obtiene su propia sesión independiente, sin límite de sesiones simultáneas.

---

### User Story 5 - Recuperar la contraseña olvidada (Priority: P2)

El usuario olvidó su contraseña. Desde la app pide recuperarla con su correo y recibe un código de 6 dígitos. Lo escribe en la app; si es correcto, pasa directamente a definir su contraseña nueva y vuelve a iniciar sesión.

**Why this priority**: sin registro ni administración desde la app, es la única forma de recuperar el acceso. Aun así, el resto del sistema funciona sin ella.

**Independent Test**: con el envío de correos configurado, pedir la recuperación para el correo del usuario, validar el código recibido, definir una contraseña nueva e iniciar sesión con ella. Comprobar que la contraseña anterior y las sesiones previas dejaron de servir.

**Acceptance Scenarios**:

1. **Given** el usuario existente, **When** pide recuperar la contraseña con su correo, **Then** recibe un correo con un código de 6 dígitos válido por 30 minutos, y la respuesta de la API es genérica.
2. **Given** un correo que no corresponde a ningún usuario, **When** se pide la recuperación, **Then** la respuesta es idéntica a la de un correo existente y no se envía nada.
3. **Given** un código vigente, **When** el usuario lo escribe con su correo, **Then** el código se valida, queda usado y el usuario recibe un permiso de cambio de contraseña de un solo uso, válido por 10 minutos.
4. **Given** un permiso de cambio vigente, **When** el usuario define una contraseña nueva válida, **Then** la contraseña cambia, el permiso queda usado, se cierran todas las sesiones del usuario y puede iniciar sesión con la contraseña nueva.
5. **Given** un código incorrecto, **When** se escribe, **Then** se rechaza con un mensaje genérico; al quinto intento fallido el código queda invalidado y hay que pedir uno nuevo.
6. **Given** un código vencido, ya usado o reemplazado por uno más reciente, **When** se escribe, **Then** se rechaza y no se entrega permiso de cambio.
7. **Given** un permiso de cambio vigente, **When** la contraseña nueva no cumple la regla de longitud, **Then** se rechaza indicando la regla y el permiso sigue vigente.
8. **Given** un permiso de cambio vencido o ya usado, **When** se intenta definir la contraseña, **Then** se rechaza y la contraseña no cambia.

---

### User Story 4 - Levantar el servidor y su base de datos (Priority: P2)

Quien desarrolla o despliega levanta la API y la base de datos con un solo comando; la estructura de la base se crea o actualiza automáticamente al arrancar, y existe una ruta pública que indica si el servicio está sano.

**Why this priority**: habilita el desarrollo y el despliegue, pero no aporta valor de usuario por sí sola.

**Independent Test**: partiendo de un entorno vacío, levantar el servicio con la configuración de ejemplo, verificar que la ruta de estado responde "sano" y que todas las tablas del diseño existen.

**Acceptance Scenarios**:

1. **Given** un entorno sin base de datos, **When** se levanta el servicio, **Then** se aplican las migraciones y se crean todas las tablas de `docs/db-finanzas.md` del lado servidor.
2. **Given** un servicio ya migrado, **When** se reinicia, **Then** las migraciones no se repiten ni pierden datos.
3. **Given** el servicio en marcha, **When** se consulta la ruta de estado, **Then** indica si la API y la base de datos están disponibles.
4. **Given** falta un secreto obligatorio (p. ej. la clave para firmar tokens), **When** se intenta arrancar, **Then** el servicio no arranca y lo indica claramente.

---

### Edge Cases

- Correo con mayúsculas o espacios alrededor: se normaliza (minúsculas, sin espacios) en la seed y al iniciar sesión.
- Contraseña del usuario inicial demasiado corta o demasiado larga en el primer despliegue: el servicio no arranca e indica la regla.
- Ya existe un usuario y se cambian las variables del usuario inicial (otro correo u otra contraseña): no se crea un usuario nuevo ni se cambia la contraseña. Para eso está la recuperación de contraseña.
- Las migraciones fallan al arrancar: la seed no se ejecuta y el servicio no arranca.
- Dos instancias del servicio arrancan a la vez sobre una base vacía: solo se crea un usuario.
- Muchos intentos de inicio de sesión fallidos para el mismo correo desde la misma IP: se bloquean temporalmente los intentos desde esa IP y se informa que se intente más tarde. Desde otra IP, el dueño puede seguir iniciando sesión.
- El servicio está detrás de un proxy (p. ej. el de Coolify): la IP que cuenta es la del cliente original que reporta el proxy de confianza, no la del proxy. Si no fuera así, todos los intentos compartirían IP y el bloqueo volvería a ser por correo.
- Dos renovaciones simultáneas con el mismo token de renovación: solo una tiene éxito; la otra se trata como reutilización y cierra esa sesión, sin afectar las de otros dispositivos.
- Token firmado con una clave anterior tras rotar la clave del servidor: se rechaza y el usuario debe iniciar sesión de nuevo.
- Desfase de reloj del dispositivo: la validez de los tokens la decide solo el reloj del servidor.
- Registro cuyo identificador ya existe pero pertenece a otro usuario: se trata como inexistente para el usuario actual; nunca se sobrescribe.
- Ruta nueva añadida sin declarar si es pública: queda protegida por defecto.
- Se pide la recuperación de contraseña varias veces seguidas: solo sirve el código más reciente, y se aplica un límite de solicitudes por correo.
- El servicio de correo falla o no está configurado: la respuesta al usuario sigue siendo genérica, el error queda registrado sin datos sensibles (nunca el código), y no queda vigente ningún código que no se haya podido enviar.
- El usuario valida el código pero cierra la app antes de definir la contraseña: el permiso de cambio vence a los 10 minutos y debe pedir un código nuevo.
- El bloqueo por intentos fallidos de inicio de sesión no impide pedir la recuperación de contraseña. Restablecerla con éxito levanta el bloqueo.
- Errores inesperados: se responde con un mensaje genérico, sin detalles internos ni datos de otros usuarios.

## Requirements *(mandatory)*

### Functional Requirements

**Base de datos**

- **FR-001**: El sistema MUST crear la estructura de datos del servidor para el módulo de finanzas según `docs/db-finanzas.md`: usuarios, tokens de renovación, cuentas, categorías, movimientos, grupos de reembolso, suscripciones, CDTs, bienes e ingresos recurrentes, con sus restricciones, valores por defecto e índices.
- **FR-002**: Cada tabla de datos MUST tener propietario (`user_id`) obligatorio y las columnas de sincronización del documento (`created_at`, `updated_at`, `deleted_at`, `server_updated_at`); las tablas exclusivas del cliente (`sync_metadata`, `is_dirty`) MUST NOT existir en el servidor.
- **FR-003**: Los montos MUST almacenarse como decimales exactos (`NUMERIC(14,2)`; tasas con su precisión indicada) y las fechas-hora en UTC.
- **FR-004**: Las referencias entre registros (cuenta, categoría, suscripción, etc.) MUST apuntar a registros del **mismo usuario**; la base de datos MUST rechazar una referencia cruzada entre usuarios aunque la lógica de la aplicación fallara.
- **FR-005**: Los cambios de estructura MUST gestionarse con migraciones versionadas, aplicadas automáticamente al arrancar el servicio y repetibles sin efectos.

**Autenticación**

- **FR-006**: El sistema MUST NOT ofrecer registro de usuarios desde la app ni desde la API. El primer usuario MUST crearse con una seed que se ejecuta automáticamente al arrancar el servicio, después de las migraciones, y que lee de variables de entorno el correo, la contraseña y el nombre para mostrar (opcional). El correo se normaliza y es único.
- **FR-006a**: La seed MUST ejecutarse solo si la base de datos no tiene ningún usuario; si ya existe al menos uno, MUST NOT hacer nada, aunque las variables cambien o falten. Si no hay usuarios y las variables obligatorias faltan o son inválidas, el servicio MUST NOT arrancar y MUST indicar el problema sin crear nada. Creación del usuario y de sus categorías: todo o nada.
- **FR-007**: La contraseña MUST tener entre 8 y 128 caracteres y almacenarse solo como hash con un algoritmo lento y con sal; nunca en claro ni en registros (logs), tampoco en la salida de la seed.
- **FR-008**: Los usuarios MUST poder iniciar sesión con correo y contraseña; el error ante credenciales inválidas MUST ser genérico e igual para correo inexistente y contraseña incorrecta.
- **FR-009**: Un inicio de sesión exitoso MUST entregar un token de acceso (vigencia 15 minutos) y un token de renovación (vigencia 7 días). Cada renovación entrega un token de renovación nuevo con 7 días de vigencia contados desde ese momento.
- **FR-010**: El servidor MUST guardar los tokens de renovación solo como hash, asociados al usuario, con vencimiento y estado de revocación.
- **FR-011**: Renovar la sesión MUST rotar el token de renovación (el anterior queda invalidado). Cada inicio de sesión crea una sesión independiente, y todos los tokens de renovación que salen de ella pertenecen a esa sesión. Reutilizar un token ya rotado MUST revocar solo esa sesión (todos sus tokens), sin afectar las demás sesiones del usuario.
- **FR-012**: Cerrar sesión MUST revocar el token de renovación de esa sesión sin afectar otras sesiones del usuario.
- **FR-013**: Un usuario autenticado MUST poder consultar su perfil (identificador, correo, nombre para mostrar, fecha de creación).
- **FR-014**: Tras 5 intentos fallidos de inicio de sesión para un mismo correo desde una misma IP en 15 minutos, el sistema MUST rechazar durante 15 minutos los nuevos intentos de esa combinación correo + IP. Los intentos para ese correo desde otras IP MUST NOT verse afectados. La IP del cliente se toma de la cabecera del proxy de confianza configurado.
- **FR-016**: Cada vez que se registra (crea) un usuario, el servidor MUST crear su set inicial de categorías en la misma transacción que el usuario: si falla una, no se crea ninguno. Esto aplica a la seed y a cualquier vía futura de alta de usuarios, que MUST usar el mismo mecanismo de registro. Orden del set: De gasto: Transporte, Alimentación, Entretenimiento, Suscripciones, Servicios, Mercado, Combustible, Parqueadero, Salud, Fitness, Viajes y Ropa. De ingreso: Salario, Rendimientos y Otros ingresos. El servidor es la única fuente de este set: la app lo recibirá en el primer sync y no creará el suyo con datos reales.

**Recuperación de contraseña**

- **FR-027**: El sistema MUST ofrecer una ruta pública para pedir la recuperación de contraseña a partir del correo. La respuesta MUST ser idéntica exista o no el usuario.
- **FR-028**: Si el correo corresponde a un usuario, el sistema MUST enviarle por correo electrónico un código numérico aleatorio de 6 dígitos, de un solo uso y con vigencia de 30 minutos. Pedir uno nuevo MUST invalidar los anteriores de ese usuario.
- **FR-029**: El sistema MUST ofrecer una ruta pública para validar el código junto con el correo. Si es correcto, MUST marcarlo como usado y entregar un permiso de cambio de contraseña de un solo uso, válido por 10 minutos. Cada intento fallido cuenta; al quinto, el código MUST invalidarse. La respuesta ante un código incorrecto, vencido o inexistente MUST ser genérica.
- **FR-030**: El sistema MUST ofrecer una ruta pública para definir la contraseña nueva con un permiso de cambio vigente; la contraseña MUST cumplir FR-007. Al cambiarla, MUST marcar el permiso como usado, revocar todas las sesiones (tokens de renovación) del usuario y levantar todos los bloqueos por intentos fallidos de inicio de sesión de ese correo.
- **FR-030a**: El servidor MUST guardar los códigos y los permisos de cambio solo como hash, con vencimiento, fecha de uso y número de intentos fallidos (en el caso de los códigos).
- **FR-031**: Las solicitudes de recuperación MUST limitarse a 3 por correo cada hora; las que superen el límite reciben la misma respuesta genérica y no envían correo.
- **FR-032**: El envío de correos MUST configurarse por variables de entorno (clave del proveedor y remitente). Si falta esa configuración, el servicio MUST arrancar igual, la recuperación MUST responder de forma genérica sin enviar nada y MUST registrar el problema.

**Protección de rutas y aislamiento**

- **FR-017**: Toda ruta MUST exigir un token de acceso válido salvo las declaradas públicas explícitamente: inicio de sesión, renovación, las tres rutas de recuperación de contraseña (pedir código, validar código, definir contraseña nueva) y estado del servicio.
- **FR-018**: La validación de la sesión MUST comprobar firma, vencimiento, tipo de token (acceso, no renovación) y que el usuario exista; si falla, la ruta MUST NOT ejecutar su lógica.
- **FR-019**: El usuario de la sesión MUST ser la única fuente de identidad; cualquier identificador de usuario enviado por el cliente MUST ignorarse y MUST NOT devolverse en las respuestas de datos.
- **FR-020**: Toda lectura y escritura de datos MUST filtrarse por el usuario de la sesión mediante un mecanismo común reutilizable por los servicios futuros, de forma que un servicio no pueda omitirlo por descuido.
- **FR-021**: El acceso a un registro de otro usuario MUST responderse igual que un registro inexistente.
- **FR-021a**: Un usuario autenticado MUST poder listar sus categorías (ruta de solo lectura). La respuesta incluye identificador, nombre, tipo (ingreso/gasto), ícono, color, orden y las columnas de sincronización. Excluye las categorías borradas, se ordena por tipo y orden, y MUST NOT incluir `user_id`. Es la ruta de referencia del patrón controlador/servicio/guard para los módulos futuros.
- **FR-022**: Las respuestas de error MUST distinguir "no autenticado" (sin sesión válida) de "no encontrado" y de errores de validación, sin exponer detalles internos.

**Operación**

- **FR-023**: El servicio MUST levantarse junto con su base de datos con un solo comando, con configuración por variables de entorno, ruta de estado (healthcheck) y almacenamiento persistente para la base de datos.
- **FR-024**: El servicio MUST negarse a arrancar si falta un secreto obligatorio; MUST existir un archivo de configuración de ejemplo versionado sin secretos reales.
- **FR-025**: La documentación de arranque de la API, incluido el funcionamiento de la seed y sus variables de entorno, MUST quedar en `README.md` (sección "API").

### Restricciones de arquitectura (indicadas por el usuario)

- Cada módulo del backend se divide en **controlador** (declara las rutas, recibe y valida la solicitud y delega) y **servicio** (contiene la lógica que ejecuta la ruta), al estilo NestJS. Los controladores no acceden directamente a la base de datos.
- La protección de rutas se implementa como **guards** reutilizables que entregan al controlador el usuario autenticado.
- Los correos de recuperación de contraseña se envían con **Resend**, configurado por variables de entorno.
- La organización por módulos (p. ej. autenticación, usuarios y, después, cada entidad de finanzas) debe permitir añadir módulos nuevos sin modificar los existentes.

### Key Entities *(include if feature involves data)*

- **Usuario**: persona con cuenta en el sistema. Correo único, contraseña (solo hash), nombre para mostrar, fecha de creación. Es dueño de todos los demás datos.
- **Token de renovación**: credencial de larga duración de una sesión de un usuario en un dispositivo. Hash del token, sesión a la que pertenece, vencimiento, fecha de revocación, token que lo reemplazó (para detectar reutilización). Un usuario puede tener varias sesiones activas a la vez.
- **Código de recuperación de contraseña**: código de 6 dígitos enviado por correo. Hash del código, usuario, vencimiento, intentos fallidos, fecha de uso y fecha de creación. Al validarse, da lugar a un **permiso de cambio de contraseña** (hash, vencimiento de 10 minutos, fecha de uso).
- **Entidades de finanzas** (cuentas, categorías, movimientos, grupos de reembolso, suscripciones, CDTs, bienes, ingresos recurrentes): definidas en `docs/db-finanzas.md`; todas pertenecen a un único usuario y solo referencian registros del mismo usuario.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Partiendo de una base vacía, basta con definir las variables del usuario inicial y desplegar para que esa persona inicie sesión, sin pasos manuales. Reiniciar o redesplegar cualquier número de veces deja exactamente un usuario y un set de categorías.
- **SC-002**: El 100 % de las rutas no públicas rechaza solicitudes sin sesión válida, verificado por una prueba que recorre automáticamente todas las rutas registradas.
- **SC-003**: En pruebas con dos usuarios, "listar mis categorías" devuelve a cada uno solo sus categorías, y 0 registros de un usuario son legibles, modificables o referenciables por el otro.
- **SC-004**: Un usuario que abre la app al menos una vez cada 7 días no necesita volver a escribir su contraseña.
- **SC-005**: Un token de renovación reutilizado o revocado nunca produce una sesión nueva (0 casos en las pruebas).
- **SC-009**: Un usuario que olvidó su contraseña puede definir una nueva e iniciar sesión en menos de 5 minutos desde que la pide. Un código o permiso de cambio usado, vencido o reemplazado nunca cambia la contraseña, y no es posible probar más de 5 códigos por solicitud (0 casos en las pruebas).
- **SC-006**: Ninguna contraseña, token de renovación, código de recuperación ni permiso de cambio aparece en claro en la base de datos ni en los registros del servicio.
- **SC-007**: El servicio arranca desde un entorno vacío con la estructura de datos completa en menos de 2 minutos con un solo comando.
- **SC-008**: Inicio de sesión, renovación y consulta de perfil responden en menos de 1 segundo en el 95 % de los casos bajo uso normal.

## Assumptions

- No hay autorregistro: el único usuario del MVP lo crea la seed en el primer despliegue. Crear usuarios adicionales queda para una fase posterior.
- Una vez creado el usuario, las variables del usuario inicial ya no se usan. Se recomienda retirar la contraseña de las variables de entorno después del primer despliegue.
- Vigencias: acceso 15 minutos, renovación 7 días con rotación, definido por el usuario. La vigencia se reinicia con cada renovación: la sesión solo expira tras 7 días sin usar la app.
- El bloqueo por intentos fallidos (FR-014) es por correo + IP y temporal; nunca bloquea la cuenta de forma permanente ni para todas las IP. El estado del bloqueo puede vivir en memoria o en la base de datos (decisión del plan); con una sola instancia del servicio basta con memoria.
- Sin verificación de correo en esta fase: el correo se usa solo como identificador de inicio de sesión.
- La tabla `users` de `docs/db-finanzas.md` se amplía con `updated_at`, y `refresh_tokens` con `created_at` y el token que lo reemplazó. Se añaden las tablas de códigos de recuperación y de permisos de cambio de contraseña (o una sola tabla con ambos). Se actualizará el documento con estos cambios.
- No hay desactivación de usuarios: el MVP tiene un solo usuario.
- Los correos de recuperación se escriben en español. La pantalla de la app para pedir la recuperación y para definir la contraseña nueva es parte de la integración del cliente.
- "Todo es privado": no hay datos compartidos entre usuarios ni roles de administrador en esta fase.
- Las categorías iniciales son registros normales del usuario, no plantillas globales. Crear, editar y eliminar categorías (esto último solo si ninguna transacción, suscripción o ingreso recurrente las usa) queda para la feature de operaciones de datos y sincronización. Dejar de crear categorías en la app con datos reales es parte de la integración del cliente.
- Los identificadores de los registros de finanzas los genera el cliente (UUID); en esta fase no hay rutas que creen esos registros, pero la estructura queda lista para la sincronización.
- La estructura del monorepo `apps/api` ya está prevista en `README.md` y la constitución (Principio V).
