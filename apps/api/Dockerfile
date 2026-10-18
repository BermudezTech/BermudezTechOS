# --- Dependencias ---
FROM python:3.13-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.12.18 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# --- Imagen final ---
FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"
WORKDIR /app
RUN useradd --system --uid 1000 --no-create-home app
COPY --from=builder /app/.venv /app/.venv
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY --chmod=755 docker-entrypoint.sh ./
USER app
EXPOSE 8000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
