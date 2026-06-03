# Contributing

## Branching

- `main` is always deployable and protected — no direct pushes.
- Branch off `main` per unit of work:
  - `feature/<slug>` — new functionality
  - `fix/<slug>` — bug fixes
  - `chore/<slug>` — tooling, deps, infra
- Open a Pull Request into `main`; merge only when CI is green.

## Commits

- Small, atomic, frequent. One logical change per commit.
- Every commit should leave the tree **buildable with tests passing** — no
  "WIP, breaks everything" commits on shared branches.
- Use [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat(api): add couple onboarding endpoint`
  - `fix(web): handle empty check-in list`
  - `chore(docker): add nginx reverse proxy`
- Explain **why**, not just what, in the body when it isn't obvious.

## Quality gates (run before pushing)

**Backend**

```bash
cd backend
ruff check .
pytest
```

**Frontend**

```bash
cd frontend
npm run lint
npm test
npm run build
```

CI (`.github/workflows/ci.yml`) runs all of the above plus a docker-compose
build on every push and PR.

## Tests

- Add or update tests alongside any code change.
- Backend: pytest under `backend/tests/`. DB-dependent tests use the
  in-memory SQLite fixture in `tests/conftest.py`.
- Frontend: Vitest + React Testing Library under `frontend/src/__tests__/`.

## Configuration & secrets

- Never commit secrets. Real values live in `.env` (gitignored); only
  `*.env.example` files are tracked.
- New config must be read from the environment and documented in
  `README.md`'s env-var table.

## Infrastructure changes

When adding Dockerfiles, nginx config, or CI, update `ARCHITECTURE.md` so the
documented design stays in sync with what runs.

## A note on this volume

The repo lives on a filesystem without extended-attribute support, so macOS
creates `._*` AppleDouble files. They're gitignored. If a local tool trips
over them, clean with `find . -name '._*' -type f -delete`.
