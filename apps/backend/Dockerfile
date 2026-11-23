# Build context is the repository root (see docker-compose.yml), because the image
# also needs packages/form-definitions.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /uvx /bin/

WORKDIR /app

# Use the image's Python (pyproject.toml prefers uv-managed Pythons for local dev)
ENV UV_PYTHON_PREFERENCE=only-system \
    UV_PYTHON_DOWNLOADS=never \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH" \
    FORM_DEFINITIONS_DIR=/app/form-definitions \
    DATA_DIR=/data

COPY apps/backend/pyproject.toml apps/backend/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY apps/backend/app ./app
COPY packages/form-definitions ./form-definitions

RUN mkdir -p /data
VOLUME /data

EXPOSE 8000

# One worker: the case store serializes writes with an in-process lock.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
