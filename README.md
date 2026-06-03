# LDR Coach

A production-ready, Dockerized full-stack foundation for a coaching app for
long-distance couples. Built to 12-factor principles: one codebase, config
via environment, stateless services, and backing services as attached
resources.

## Stack

| Layer         | Technology                                  |
| ------------- | ------------------------------------------- |
| Frontend      | Next.js 15 (React 19, TypeScript, App Router) |
| Backend       | FastAPI (Python 3.12), SQLAlchemy 2, Alembic |
| Database      | PostgreSQL 16                               |
| Auth          | JWT (bcrypt password hashing)              |
| Reverse proxy | Nginx (single public entrypoint on `:80`)  |
| Tests         | pytest (backend), Vitest + RTL (frontend)  |
| CI            | GitHub Actions                             |

## Quickstart (one command)

Requires Docker with Compose v2.

```bash
cp .env.example .env        # adjust secrets for anything beyond local dev
docker compose up --build
```

Then open **http://localhost** — the dashboard renders and shows the backend
connection status. The API is proxied under **http://localhost/api** (docs at
`/api/docs`).

By default `docker compose up` also merges `docker-compose.override.yml`,
which enables hot-reload for local development. For a production-style run
(built images, no bind mounts):

```bash
docker compose -f docker-compose.yml up --build
```

## Services & ports

| Service         | Internal | Published          | Purpose                       |
| --------------- | -------- | ------------------ | ----------------------------- |
| `reverse-proxy` | 80       | `${HTTP_PORT}` (80) | Nginx — only public entrypoint |
| `frontend`      | 3000     | 3000 (dev only)    | Next.js                       |
| `backend`       | 8000     | 8000 (dev only)    | FastAPI (migrates on startup) |
| `db`            | 5432     | —                  | PostgreSQL                    |

## Environment variables

Config comes only from the environment. Copy `.env.example` → `.env` at the
repo root (used by docker-compose). Per-service examples live in
`backend/.env.example` and `frontend/.env.example`.

| Variable             | Used by  | Default                  | Notes                                  |
| -------------------- | -------- | ------------------------ | -------------------------------------- |
| `HTTP_PORT`          | proxy    | `80`                     | Public port                            |
| `ENV`                | backend  | `production`             | `development` enables reload in override |
| `POSTGRES_USER`      | db/back  | `ldr`                    |                                        |
| `POSTGRES_PASSWORD`  | db/back  | `ldr_dev_password`       | **Change for any real deploy**         |
| `POSTGRES_DB`        | db/back  | `ldr`                    |                                        |
| `DATABASE_URL`       | backend  | derived in compose       | SQLAlchemy URL                         |
| `JWT_SECRET`         | backend  | _none_                   | **Required.** `openssl rand -hex 32`   |
| `JWT_EXPIRE_MINUTES` | backend  | `1440`                   | Token lifetime                         |
| `CORS_ORIGINS`       | backend  | `http://localhost`       | Comma-separated                        |
| `NEXT_PUBLIC_API_URL`| frontend | `/api`                   | Browser API base (same-origin via proxy) |

## Local development without Docker

> **Note:** this repo currently lives on an external volume whose filesystem
> does not support extended attributes, so macOS scatters `._*` AppleDouble
> files that confuse Python's and Node's file discovery. Create virtualenvs
> **off** that volume (e.g. under `$HOME`), or just use Docker.

**Backend**

```bash
cd backend
python -m venv "$HOME/.virtualenvs/ldr-coach-backend"
source "$HOME/.virtualenvs/ldr-coach-backend/bin/activate"
pip install -e ".[dev]"
alembic upgrade head        # uses sqlite:///./dev.db by default
uvicorn app.main:app --reload
pytest && ruff check .
```

**Frontend**

```bash
cd frontend
npm ci
npm run dev                 # http://localhost:3000
npm test && npm run lint && npm run build
```

## Project structure

```
backend/    FastAPI app, SQLAlchemy models, Alembic migrations, pytest
frontend/   Next.js app (App Router), Vitest tests
infra/      Nginx reverse proxy (config + Dockerfile)
.github/    CI workflow
docker-compose.yml + override   Orchestration
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the 12-factor mapping and data
model, and [CONTRIBUTING.md](CONTRIBUTING.md) for the Git/PR workflow.
