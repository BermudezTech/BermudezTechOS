import type { IconName } from '@/components/ui';

export type IconGroupId =
  | 'food'
  | 'transport'
  | 'home'
  | 'utilities'
  | 'health'
  | 'education'
  | 'leisure'
  | 'shopping'
  | 'finance'
  | 'work'
  | 'travel'
  | 'pets'
  | 'family'
  | 'other';

export interface IconCatalogEntry {
  name: IconName;
  /** Nombre en español (accesibilidad y búsqueda). */
  label: string;
  /** Palabras clave en español, en minúsculas y sin tildes. */
  keywords: string[];
  group: IconGroupId;
}

export const ICON_GROUPS: { id: IconGroupId; label: string }[] = [
  { id: 'food', label: 'Comida y bebida' },
  { id: 'transport', label: 'Transporte' },
  { id: 'home', label: 'Hogar' },
  { id: 'utilities', label: 'Servicios' },
  { id: 'health', label: 'Salud' },
  { id: 'education', label: 'Educación' },
  { id: 'leisure', label: 'Ocio' },
  { id: 'shopping', label: 'Compras' },
  { id: 'finance', label: 'Finanzas' },
  { id: 'work', label: 'Trabajo' },
  { id: 'travel', label: 'Viajes' },
  { id: 'pets', label: 'Mascotas' },
  { id: 'family', label: 'Familia y personal' },
  { id: 'other', label: 'Otros' },
];

const e = (group: IconGroupId, name: IconName, label: string, keywords: string[] = []): IconCatalogEntry => ({
  name,
  label,
  keywords,
  group,
});

/** Íconos de Ionicons disponibles para categorías (research R6). Incluye los de las categorías por defecto del servidor. */
export const ICON_CATALOG: IconCatalogEntry[] = [
  // Comida y bebida
  e('food', 'restaurant-outline', 'Restaurante', ['comida', 'alimentacion', 'almuerzo', 'cena']),
  e('food', 'fast-food-outline', 'Comida rápida', ['hamburguesa', 'domicilio', 'comida']),
  e('food', 'pizza-outline', 'Pizza', ['comida', 'domicilio']),
  e('food', 'cafe-outline', 'Café', ['cafeteria', 'desayuno', 'tinto']),
  e('food', 'beer-outline', 'Cerveza', ['bar', 'trago', 'licor']),
  e('food', 'wine-outline', 'Vino', ['bar', 'licor', 'trago']),
  e('food', 'pint-outline', 'Bebidas', ['bar', 'cerveza', 'trago']),
  e('food', 'ice-cream-outline', 'Helado', ['postre', 'dulce']),
  e('food', 'nutrition-outline', 'Frutas y verduras', ['mercado', 'fruta', 'verdura', 'comida sana']),
  e('food', 'egg-outline', 'Huevos', ['desayuno', 'mercado']),
  // Transporte
  e('transport', 'car-outline', 'Carro', ['transporte', 'vehiculo', 'auto']),
  e('transport', 'car-sport-outline', 'Carro deportivo', ['vehiculo', 'auto']),
  e('transport', 'bus-outline', 'Bus', ['transporte', 'publico', 'transmilenio', 'buseta']),
  e('transport', 'subway-outline', 'Metro', ['transporte', 'publico', 'tren']),
  e('transport', 'train-outline', 'Tren', ['transporte', 'metro']),
  e('transport', 'bicycle-outline', 'Bicicleta', ['cicla', 'transporte', 'deporte']),
  e('transport', 'speedometer-outline', 'Combustible', ['gasolina', 'gas', 'tanqueo', 'acpm']),
  e('transport', 'location-outline', 'Parqueadero', ['parqueo', 'estacionamiento', 'ubicacion']),
  e('transport', 'navigate-outline', 'Taxi y apps', ['taxi', 'uber', 'didi', 'viaje']),
  e('transport', 'construct-outline', 'Taller', ['mecanico', 'mantenimiento', 'reparacion']),
  e('transport', 'trail-sign-outline', 'Peajes', ['peaje', 'carretera', 'via']),
  // Hogar
  e('home', 'home-outline', 'Hogar', ['casa', 'arriendo', 'alquiler', 'vivienda']),
  e('home', 'business-outline', 'Edificio', ['administracion', 'apartamento', 'conjunto', 'arriendo']),
  e('home', 'key-outline', 'Arriendo', ['alquiler', 'llaves', 'vivienda']),
  e('home', 'bed-outline', 'Muebles', ['cama', 'dormitorio', 'hogar']),
  e('home', 'hammer-outline', 'Reparaciones', ['arreglos', 'herramientas', 'mantenimiento']),
  e('home', 'build-outline', 'Mantenimiento', ['arreglos', 'herramientas']),
  e('home', 'color-fill-outline', 'Aseo', ['limpieza', 'pintura']),
  e('home', 'flower-outline', 'Jardín', ['plantas', 'flores']),
  e('home', 'leaf-outline', 'Plantas', ['jardin', 'naturaleza']),
  // Servicios
  e('utilities', 'flash-outline', 'Energía', ['luz', 'electricidad', 'servicios']),
  e('utilities', 'water-outline', 'Agua', ['acueducto', 'servicios']),
  e('utilities', 'flame-outline', 'Gas', ['servicios', 'gas natural']),
  e('utilities', 'wifi-outline', 'Internet', ['wifi', 'servicios', 'hogar']),
  e('utilities', 'call-outline', 'Teléfono', ['celular', 'plan', 'llamadas']),
  e('utilities', 'phone-portrait-outline', 'Celular', ['telefono', 'plan', 'movil']),
  e('utilities', 'tv-outline', 'Televisión', ['tv', 'cable', 'streaming']),
  e('utilities', 'repeat-outline', 'Suscripciones', ['mensualidad', 'recurrente', 'streaming']),
  e('utilities', 'trash-outline', 'Basuras', ['aseo', 'reciclaje']),
  // Salud
  e('health', 'medkit-outline', 'Salud', ['medico', 'botiquin', 'eps']),
  e('health', 'medical-outline', 'Medicina', ['medico', 'drogueria', 'farmacia', 'remedios']),
  e('health', 'bandage-outline', 'Primeros auxilios', ['curita', 'herida']),
  e('health', 'heart-outline', 'Bienestar', ['salud', 'corazon', 'amor']),
  e('health', 'pulse-outline', 'Exámenes', ['laboratorio', 'medico', 'salud']),
  e('health', 'fitness-outline', 'Ejercicio', ['salud', 'deporte', 'gimnasio']),
  e('health', 'barbell-outline', 'Gimnasio', ['gym', 'fitness', 'pesas', 'deporte']),
  e('health', 'eye-outline', 'Óptica', ['gafas', 'ojos', 'oftalmologo']),
  e('health', 'thermometer-outline', 'Enfermedad', ['fiebre', 'medico']),
  // Educación
  e('education', 'school-outline', 'Colegio', ['educacion', 'universidad', 'matricula', 'pension']),
  e('education', 'book-outline', 'Libros', ['lectura', 'educacion']),
  e('education', 'library-outline', 'Biblioteca', ['libros', 'estudio']),
  e('education', 'pencil-outline', 'Útiles', ['papeleria', 'colegio', 'lapiz']),
  e('education', 'laptop-outline', 'Cursos en línea', ['curso', 'computador', 'estudio']),
  e('education', 'language-outline', 'Idiomas', ['ingles', 'curso']),
  e('education', 'calculator-outline', 'Calculadora', ['matematicas', 'contabilidad']),
  e('education', 'newspaper-outline', 'Prensa', ['periodico', 'revista', 'noticias']),
  // Ocio
  e('leisure', 'film-outline', 'Cine', ['peliculas', 'entretenimiento', 'series']),
  e('leisure', 'game-controller-outline', 'Videojuegos', ['juegos', 'consola', 'entretenimiento']),
  e('leisure', 'musical-notes-outline', 'Música', ['conciertos', 'spotify', 'entretenimiento']),
  e('leisure', 'ticket-outline', 'Eventos', ['boletas', 'conciertos', 'teatro', 'entradas']),
  e('leisure', 'football-outline', 'Fútbol', ['deporte', 'partido']),
  e('leisure', 'basketball-outline', 'Baloncesto', ['deporte']),
  e('leisure', 'tennisball-outline', 'Tenis', ['deporte']),
  e('leisure', 'golf-outline', 'Golf', ['deporte']),
  e('leisure', 'dice-outline', 'Juegos de mesa', ['juegos', 'azar']),
  e('leisure', 'camera-outline', 'Fotografía', ['fotos', 'camara']),
  e('leisure', 'color-palette-outline', 'Arte', ['pintura', 'manualidades', 'hobby']),
  e('leisure', 'bonfire-outline', 'Camping', ['paseo', 'naturaleza']),
  // Compras
  e('shopping', 'cart-outline', 'Mercado', ['supermercado', 'compras', 'viveres']),
  e('shopping', 'basket-outline', 'Canasta', ['mercado', 'compras', 'tienda']),
  e('shopping', 'bag-handle-outline', 'Compras', ['bolsa', 'tienda', 'centro comercial']),
  e('shopping', 'storefront-outline', 'Tienda', ['comercio', 'negocio', 'compras']),
  e('shopping', 'shirt-outline', 'Ropa', ['vestuario', 'moda']),
  e('shopping', 'diamond-outline', 'Joyería', ['joyas', 'lujo', 'accesorios']),
  e('shopping', 'watch-outline', 'Relojes', ['accesorios']),
  e('shopping', 'glasses-outline', 'Gafas', ['accesorios', 'optica']),
  e('shopping', 'desktop-outline', 'Tecnología', ['computador', 'electronica']),
  e('shopping', 'headset-outline', 'Audio', ['audifonos', 'tecnologia']),
  e('shopping', 'gift-outline', 'Regalos', ['regalo', 'cumpleanos', 'navidad', 'detalle']),
  e('shopping', 'pricetag-outline', 'Etiqueta', ['precio', 'descuento', 'general']),
  e('shopping', 'pricetags-outline', 'Ofertas', ['descuentos', 'precios']),
  // Finanzas
  e('finance', 'cash-outline', 'Efectivo', ['dinero', 'plata', 'otros ingresos']),
  e('finance', 'wallet-outline', 'Billetera', ['dinero', 'cartera']),
  e('finance', 'card-outline', 'Tarjeta', ['credito', 'debito', 'banco']),
  e('finance', 'trending-up-outline', 'Rendimientos', ['inversion', 'intereses', 'ganancias']),
  e('finance', 'trending-down-outline', 'Pérdidas', ['inversion', 'baja']),
  e('finance', 'stats-chart-outline', 'Inversiones', ['acciones', 'bolsa']),
  e('finance', 'pie-chart-outline', 'Presupuesto', ['distribucion', 'finanzas']),
  e('finance', 'receipt-outline', 'Facturas', ['recibo', 'cuentas', 'pagos']),
  e('finance', 'document-text-outline', 'Impuestos', ['dian', 'declaracion', 'tramites']),
  e('finance', 'shield-checkmark-outline', 'Seguros', ['poliza', 'seguro', 'soat']),
  e('finance', 'swap-horizontal-outline', 'Transferencias', ['giro', 'envio']),
  e('finance', 'server-outline', 'Ahorro', ['alcancia', 'reserva']),
  // Trabajo
  e('work', 'briefcase-outline', 'Salario', ['sueldo', 'trabajo', 'nomina', 'pago']),
  e('work', 'podium-outline', 'Negocios', ['empresa', 'oficina', 'emprendimiento']),
  e('work', 'people-outline', 'Clientes', ['personas', 'equipo']),
  e('work', 'clipboard-outline', 'Proyectos', ['tareas', 'contratos', 'freelance']),
  e('work', 'easel-outline', 'Presentaciones', ['reunion', 'proyecto']),
  e('work', 'mail-outline', 'Correo', ['envios', 'mensajeria']),
  e('work', 'print-outline', 'Impresiones', ['fotocopias', 'papeleria']),
  e('work', 'code-slash-outline', 'Desarrollo', ['software', 'programacion', 'freelance']),
  e('work', 'ribbon-outline', 'Bonificación', ['premio', 'bono', 'prima']),
  e('work', 'trophy-outline', 'Premios', ['logro', 'concurso']),
  // Viajes
  e('travel', 'airplane-outline', 'Vuelos', ['viajes', 'avion', 'tiquetes']),
  e('travel', 'boat-outline', 'Barco', ['crucero', 'lancha', 'viaje']),
  e('travel', 'map-outline', 'Turismo', ['mapa', 'tour', 'paseo']),
  e('travel', 'earth-outline', 'Internacional', ['viaje', 'exterior', 'mundo']),
  e('travel', 'compass-outline', 'Aventura', ['explorar', 'viaje']),
  e('travel', 'umbrella-outline', 'Playa', ['vacaciones', 'sol', 'paraguas']),
  e('travel', 'sunny-outline', 'Vacaciones', ['sol', 'verano', 'descanso']),
  e('travel', 'snow-outline', 'Invierno', ['nieve', 'frio']),
  e('travel', 'camera-reverse-outline', 'Recuerdos', ['fotos', 'souvenir']),
  // Mascotas
  e('pets', 'paw-outline', 'Mascota', ['perro', 'gato', 'veterinario', 'animal']),
  e('pets', 'fish-outline', 'Acuario', ['peces', 'pescado', 'mascota']),
  e('pets', 'heart-circle-outline', 'Cuidado animal', ['veterinario', 'adopcion', 'mascota']),
  e('pets', 'footsteps-outline', 'Paseador', ['paseo', 'perro', 'mascota']),
  // Familia y personal
  e('family', 'people-circle-outline', 'Familia', ['hijos', 'padres', 'hogar']),
  e('family', 'person-outline', 'Personal', ['yo', 'propio']),
  e('family', 'happy-outline', 'Niños', ['hijos', 'bebe', 'infantil']),
  e('family', 'woman-outline', 'Mujer', ['personal', 'esposa', 'mama']),
  e('family', 'man-outline', 'Hombre', ['personal', 'esposo', 'papa']),
  e('family', 'cut-outline', 'Peluquería', ['barberia', 'corte', 'belleza']),
  e('family', 'sparkles-outline', 'Belleza', ['cuidado personal', 'spa', 'cosmeticos']),
  e('family', 'rose-outline', 'Pareja', ['amor', 'cita', 'flores']),
  e('family', 'balloon-outline', 'Celebraciones', ['fiesta', 'cumpleanos']),
  e('family', 'hand-left-outline', 'Donaciones', ['caridad', 'ayuda', 'diezmo']),
  // Otros
  e('other', 'star-outline', 'Favorito', ['estrella', 'especial']),
  e('other', 'flag-outline', 'Metas', ['objetivo', 'bandera']),
  e('other', 'calendar-outline', 'Eventual', ['fecha', 'calendario']),
  e('other', 'time-outline', 'Pendiente', ['tiempo', 'reloj']),
  e('other', 'alert-circle-outline', 'Imprevistos', ['emergencia', 'urgente']),
  e('other', 'help-circle-outline', 'Otros', ['varios', 'sin clasificar']),
  e('other', 'apps-outline', 'Varios', ['general', 'otros']),
  e('other', 'cube-outline', 'Paquetes', ['envios', 'domicilios', 'caja']),
  e('other', 'globe-outline', 'Web', ['internet', 'online']),
];
