# Quickstart: validar la sincronización

Guía para comprobar de punta a punta que PUSH y PULL cumplen la [spec](./spec.md). Contrato: [contracts/http-api.md](./contracts/http-api.md).

## Prerrequisitos

- Entorno de la spec 003 funcionando: `.env` en la raíz y `docker compose up --build`.
- Swagger en http://localhost:8000/docs, o `curl` + `jq`.
- Un token de acceso: `POST /api/v1/auth/login` → `accessToken`.

```bash
TOKEN=$(curl -s localhost:8000/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"tu@correo.com","password":"…"}' | jq -r .accessToken)
H=(-H "authorization: Bearer $TOKEN" -H 'content-type: application/json')
```

## Pruebas automatizadas

```bash
cd apps/api
uv run pytest tests/unit -k sync
uv run pytest tests/integration -k sync      # requiere Docker (testcontainers)
uv run ruff check . && uv run mypy app
```

Resultado esperado: todo en verde, incluida la prueba de concurrencia del PULL frente al PUSH.

## Escenarios manuales

| # | Paso | Resultado esperado | Cubre |
|---|---|---|---|
| 1 | `POST /sync/pull` con `{}` en un usuario recién creado | `categories.records` trae 15 categorías y las otras tablas vienen vacías; `hasMore=false` y un cursor por tabla | US2-1, FR-021 |
| 2 | `POST /sync/push` con una cuenta nueva y una transacción `EXPENSE` que la referencia, con la categoría "Transporte" del paso 1 | Ambas `APPLIED` | US1-1, FR-010 |
| 3 | Repetir el paso 2 sin cambios | Ambas `DISCARDED`; no hay duplicados | US1-4, FR-012, SC-002 |
| 4 | Reenviar la transacción con `updatedAt` posterior y otro `amount` | `APPLIED`; el PULL con el cursor del paso 1 trae solo la cuenta y la transacción, con el monto nuevo | US1-2, US2-2 |
| 5 | Reenviar la transacción con `updatedAt` anterior | `DISCARDED`; el monto no cambia | US1-3 |
| 6 | Enviar un lote con una transacción válida y otra con `"amount": "0.00"` | La primera `APPLIED`; la segunda `REJECTED / VALIDATION_ERROR` | US1-5, Clarificación 1 |
| 7 | Una transacción `EXPENSE` con una categoría `INCOME` ("Salario") | `REJECTED / INCOHERENT` | FR-009a |
| 8 | Una transacción cuyo `accountId` no existe, en el mismo lote que otra que depende de una cuenta rechazada | `INVALID_REFERENCE` y `DEPENDENCY_REJECTED` | FR-011 |
| 9 | Un registro con `updatedAt` = ahora + 2 días | `REJECTED / CLOCK_AHEAD` | FR-013, Clarificación 2 |
| 10 | Enviar `"amount": 45000.5` (número, no string) | `REJECTED / VALIDATION_ERROR` | FR-004 |
| 11 | Montos `"0.10"`, `"0.20"` y `"0.30"` en tres transacciones; luego un PULL | Llegan exactamente `"0.10"`, `"0.20"` y `"0.30"` | SC-007 |
| 12 | Borrar la transacción (`deletedAt` + `updatedAt` mayor); luego un PULL | Llega con `deletedAt` | US1-6, FR-015 |
| 13 | Con un segundo usuario, hacer un PUSH con el **mismo** `id` de la cuenta del paso 2 | `REJECTED / ID_CONFLICT`; la cuenta del usuario 1 no cambia y el PULL del usuario 2 no la muestra | US2-3, SC-003 |
| 14 | Un lote de 501 registros | `413 PUSH_TOO_LARGE`; no se aplica nada | FR-014 |
| 15 | `POST /sync/pull` con `{"cursors":{"accounts":"basura"}}` | `422 INVALID_CURSOR` | S3 |
| 16 | Llamar a cualquiera de las dos rutas sin token | `401 UNAUTHENTICATED` | FR-002 |

## Multi-dispositivo (US3)

Simula dos clientes con el mismo token:

1. El cliente A envía la cuenta X con `updatedAt = 10:00` y `name = "A"`.
2. El cliente B envía la cuenta X con `updatedAt = 10:05` y `name = "B"`.
3. El cliente A reenvía `updatedAt = 10:00`: le llega `DISCARDED`.
4. Ambos hacen PULL: los dos reciben `name = "B"`.

Repite el ejercicio con un borrado en A a las 10:10 y comprueba que gana el borrado (US3-2).
