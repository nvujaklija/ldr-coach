# Architecture

## Overview

LDR Coach is a containerized full-stack application. Nginx is the single
public entrypoint; it proxies the browser to the Next.js frontend and the
`/api` path to the FastAPI backend. The backend is a stateless process that
treats PostgreSQL as an attached resource.

```
                         ┌──────────────────────────────────────┐
                         │            Docker network "ldr"        │
   browser  ──:80──►  ┌──┴───────────┐                           │
                      │ reverse-proxy │  / ───────► ┌───────────┐ │
                      │   (nginx)     │             │ frontend  │ │
                      │               │  /api ──┐   │ (Next.js) │ │
                      └──┬───────────┘          │   └───────────┘ │
                         │                       ▼                 │
                         │                 ┌───────────┐           │
                         │                 │  backend  │ ──► ┌────┐ │
                         │                 │ (FastAPI) │     │ db │ │
                         │                 └───────────┘     │ pg │ │
                         └───────────────────────────────────┴────┘
```

## 12-factor mapping

| Factor                  | How it's applied                                                            |
| ----------------------- | --------------------------------------------------------------------------- |
| I. Codebase             | One Git repo; all services + infra + CI versioned together.                 |
| II. Dependencies        | Declared explicitly: `backend/pyproject.toml`, `frontend/package.json`.     |
| III. Config             | All config via env (`pydantic-settings`, `NEXT_PUBLIC_*`); only `.env.example` is committed. |
| IV. Backing services    | Postgres attached via `DATABASE_URL`; swappable without code changes.       |
| V. Build/release/run    | Multi-stage Dockerfiles separate build from run; migrations run at release/startup. |
| VI. Processes           | Backend is stateless; no session affinity or local file state.              |
| VII. Port binding       | Each service self-hosts on a port; nginx composes them.                     |
| VIII. Concurrency       | Stateless processes scale horizontally behind the proxy.                    |
| IX. Disposability       | Fast startup; Postgres healthcheck gates the backend.                       |
| X. Dev/prod parity      | Same images locally and in CI via Docker.                                   |
| XI. Logs                | Backend logs JSON to stdout; Docker aggregates the stream.                  |
| XII. Admin processes    | Schema changes are Alembic migrations, run as one-off commands.             |

## Backend layout

```
backend/app/
  main.py            App factory: CORS, logging, router registration
  core/config.py     Settings (env-driven)
  core/security.py   bcrypt hashing + JWT encode/decode
  core/logging.py    JSON logs to stdout
  db/base.py         Declarative Base + UUID/timestamp mixins
  db/session.py      Engine + session factory + get_db dependency
  models/            User, Couple, CoupleMember, CoupleInvite, Visit, Ritual, CheckIn
  schemas/           Pydantic request/response models
  services/          couples.py — membership + invite helpers shared by routes
  api/deps.py        get_db, get_current_user dependencies
  api/routes/        health.py, auth.py, couples.py, visits.py, milestones.py,
                     checkins.py
alembic/             Migration environment + versions/
```

## Data model

```
users ──< couple_members >── couples ──< visits
  │                              ├──< rituals
  └──< check_ins >──────────────┼──< letters
                                └──< memory_items
```

- **users** — accounts (email, hashed_password, display_name).
- **couples** — a pairing of two users.
- **couple_members** — join table (couple ↔ user, with a role).
- **couple_invites** — single-use, expiring codes the first partner shares so
  the second partner can join the couple (code, creator, expiry, redemption).
- **visits** — planned/past in-person visits for a couple.
- **rituals** — recurring shared activities (cadence + description).
- **check_ins** — per-user daily mood/connection check-ins (1–5 scores,
  tags, optional note); one row per user per day, scoped to the couple when
  matched. Endpoints: `POST /api/checkins/today` (idempotent upsert),
  `GET /api/checkins?days=N` (recent check-ins + rolling averages).
- **letters** — time-released messages from one partner to the other
  (`from_user`/`to_user`, `visible_from`, title, body, `is_opened`). The API is
  the gatekeeper: a locked letter's body is never serialized to its recipient
  before `visible_from`; the sender always sees their own. Endpoints:
  `POST /api/letters`, `GET /api/letters?box=inbox|sent`,
  `POST /api/letters/{id}/open`.
- **memory_items** — the couple's shared timeline. Each row is a `type`
  (`photo`/`note`/`ritual`/`visit`) plus a free-form `data` JSON blob, so the
  timeline holds heterogeneous moments without a table per kind. Endpoints:
  `GET /api/memories?limit=&offset=` (newest first, paged), `POST /api/memories`.

The memory timeline is also written automatically: completing a visit,
milestone, or ritual occurrence records a `MemoryItem` through the shared
`app.services.memories` writer, which adds the row in the same transaction as
the state change that triggered it. Auto-recorded memories carry a `source`
key in `data` and a null `created_by_id`.

All tables use string UUID primary keys and `created_at`/`updated_at`
timestamps. Foreign keys cascade on delete. Schema changes go through Alembic
(`backend/alembic/versions/`), never ad-hoc DDL.

## Request flow (example: login)

1. Browser POSTs `/api/auth/login` → nginx → `backend:8000`.
2. FastAPI validates the form, looks up the user, verifies the bcrypt hash.
3. On success, returns a signed JWT; the client sends it as a Bearer token.
4. Protected routes resolve the user via `get_current_user` (`api/deps.py`).
