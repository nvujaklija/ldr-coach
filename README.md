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
| `INVITE_EXPIRE_DAYS` | backend  | `14`                     | Partner-invite code lifetime           |
| `FRONTEND_URL`       | backend  | `http://localhost:3000`  | Base for the shareable invite link     |
| `CORS_ORIGINS`       | backend  | `http://localhost`       | Comma-separated                        |
| `NEXT_PUBLIC_API_URL`| frontend | `/api`                   | Browser API base (same-origin via proxy) |

## Authentication & onboarding

The first vertical slice takes a visitor from no account to a logged-in user
who belongs to a couple and lands on the dashboard shell.

**API endpoints** (all under `/api`):

| Method & path          | Auth | Purpose                                             |
| ---------------------- | ---- | --------------------------------------------------- |
| `POST /auth/register`  | —    | Create an account (email, password, display name)   |
| `POST /auth/login`     | —    | OAuth2 password form; returns a JWT bearer token     |
| `GET  /auth/me`        | JWT  | Current user **and** their couple (null if none)    |
| `POST /couples`        | JWT  | Create a couple; caller becomes the first partner   |
| `POST /couples/invites`| JWT  | Mint a single-use, expiring invite code + link      |
| `POST /couples/join`   | JWT  | Redeem an invite code to join the partner's couple  |

**Flow:** register → (auto-login) → land on `/app`. With no couple yet, the
dashboard offers *create a couple* or *join with a code*. After creating, the
first partner generates an invite and shares the code or link
(`/join?code=…`). The second partner registers, opens the link, and joins —
both now see the couple on `/app`. A user belongs to exactly one couple, and a
couple has exactly two partners; invites are single-use and expire after
`INVITE_EXPIRE_DAYS`.

**Frontend routes:** `/login`, `/register`, `/join` (invite deep-link), and the
auth-guarded `/app` dashboard. The JWT is stored in `localStorage` and the
auth state is provided app-wide via a React context (`src/lib/auth.tsx`).

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
