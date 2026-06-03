# syntax=docker/dockerfile:1

# --- builder: install dependencies into a venv ---
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY pyproject.toml ./
# Install only runtime deps (resolved from pyproject) into the venv
RUN pip install --upgrade pip && pip install .

# --- runtime: minimal image, non-root ---
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Non-root user
RUN useradd --create-home --uid 1000 appuser
WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY . .
RUN pip install --no-deps . && chown -R appuser:appuser /app

USER appuser
EXPOSE 8000

# Apply migrations, then serve. DATABASE_URL must point at Postgres.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
