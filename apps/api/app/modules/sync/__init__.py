"""Sincronización offline-first: un PUSH y un PULL para todas las tablas de datos (spec 004).

- `core/`: configuración y mecánica común (límites, lock por usuario, cursor, orden, LWW).
- `entities/<tabla>/`: cómo se sincroniza cada tabla (esquema, referencias, coherencia).

Cómo agregar una tabla al sync:
1. Crear `entities/<tabla>/schemas.py` (registro que hereda de `SyncRecord`) y `entity.py`
   (subclase de `SyncEntity`: modelo, referencias, coherencia, códigos de restricciones).
2. Añadirla a `SYNC_ENTITIES` y a `TableName` en `core/registry.py`, después de las tablas que
   referencia.
3. Añadir su fábrica en `tests/integration/sync/conftest.py` y un caso en
   `test_push_entities.py`.
"""
