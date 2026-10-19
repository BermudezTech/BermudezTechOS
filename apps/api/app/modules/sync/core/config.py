"""Límites del sync (research S9). Valores iniciales; se ajustan aquí sin tocar el resto."""

from datetime import timedelta

# Registros por PUSH: si se supera, se rechaza el lote completo y la app lo divide (FR-014).
MAX_PUSH_RECORDS = 500

# Tamaño máximo del cuerpo del PUSH: corta peticiones abusivas antes de parsearlas.
MAX_PUSH_BODY_BYTES = 2 * 1024 * 1024

# Registros por respuesta de PULL, sumando todas las tablas (FR-018).
PULL_PAGE_SIZE = 1000

# Un `updated_at` más adelantado que esto ganaría todos los conflictos para siempre (FR-013).
MAX_FUTURE_SKEW = timedelta(hours=24)
