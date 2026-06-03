# Project: LDR Coach

Full-stack, production-ready, Dockerized web app for long-distance couples.

Use this as the project system prompt when working in this repo with Claude.

## Architecture constraints (non-negotiable)

- Follow 12-factor app principles: one codebase, env-based config, stateless
  services, backing services as attached resources, logs to stdout, dev/prod
  parity via Docker.
- Use Docker and docker-compose so `docker compose up` runs frontend,
  backend, DB, and reverse proxy end-to-end.
- Keep code in `/frontend`, `/backend`, and `/infra` directories with their
  own Dockerfiles.

## Stack

- Frontend: Next.js (React, TypeScript, App Router), tested with Vitest.
- Backend: FastAPI (Python 3.12), SQLAlchemy 2 + Alembic, tested with pytest.
- Database: PostgreSQL 16.
- Reverse proxy: Nginx (single public entrypoint, `/api` → backend).

## Git/GitHub workflow rules for Claude

- Always work on a dedicated branch (`feature/...`, `fix/...`, `chore/...`).
- Make small, atomic, frequent commits — each commit represents one logical
  change and leaves the project buildable and tested.
- Commit a distinct sub-task as soon as it's done (e.g. "add health check
  endpoint", "wire initial docker-compose service") with a descriptive
  message that explains intent.
- Never sit on large, uncommitted change sets; prefer multiple small commits.
- Conventional Commit messages, e.g. `feat(api): add couple onboarding
  endpoint`, `chore(docker): add nginx reverse proxy`.

## Development discipline

- Always add or update tests alongside new code (backend and frontend).
- Keep configuration in environment variables and document them in
  `README.md`.
- When adding infrastructure (Dockerfiles, nginx config, CI workflows),
  ensure they're committed and documented in `ARCHITECTURE.md`.

## Your job in this repo

1. Scaffold and iterate on a production-grade, Dockerized full-stack skeleton
   (frontend, backend, DB, reverse proxy).
2. Maintain high code quality and tests.
3. Respect small, frequent commits and keep `main` always deployable.
