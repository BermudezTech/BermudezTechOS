#!/bin/sh
# Migraciones y seed antes de levantar la API. Si fallan, el contenedor no arranca.
set -e

python -m app.bootstrap

# --proxy-headers: toma la IP real de X-Forwarded-For de los proxies en FORWARDED_ALLOW_IPS.
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
