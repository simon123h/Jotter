# Jotter: notes for agents

Local-first kanban-inspired task manager. A vault is a folder of Markdown task files (one per task, grouped in project folders), optionally a Git repo. A Python/FastAPI backend serves a Vue frontend; SQLite (`tasks.db`) is only a disposable index of the files. The frontend runs against the backend or as a static demo, through a storage adapter. The Android app is a separate project (`apps/mobile/`, ADR 0017), with no backend: it reads and writes the vault files itself.

## Where things are

- `src/jotter/features/<name>/`: backend feature slices (tasks, projects, buckets, sync, vaults, canvas, settings, timeblock). `shared/` holds the DB, atomic file writes and frontmatter helpers.
- `apps/web/src/`: Vue app in feature slices; `storage/` has the adapters (`httpAdapter`, `demoAdapter`).
- `apps/mobile/`: the Android app (Vue, Capacitor). `src/data/` is its vault repository, `src/screens/` and `src/components/` the touch UI.
- `packages/vault-format/`: the TypeScript parser for the vault format, used by `apps/mobile/`.
- `packages/themes/` (colour themes), `packages/title-parser/` (the smart title input), `packages/task-filter/` (the search query language, the matching of tasks, the local-day helpers and the planned-date helpers), `packages/checklist/` (the checklists in the notes) and `packages/links/` (the web addresses in a task): shared by `apps/web/` and `apps/mobile/`. Each app has an alias for them (`@jotter/themes`, `@jotter/title-parser`, `@jotter/task-filter`, `@jotter/checklist`, `@jotter/links`). The search fixtures in `spec/fixtures/search/` also run against the Python backend (`tests/test_search_conformance.py`).
- `spec/FORMAT.md` and `spec/fixtures/`: the vault format and conformance fixtures. The Python reader and the TypeScript reader (`packages/vault-format`) must both follow them. Change the spec first, then both readers.
- `docs/developer/architecture.md` and `docs/developer/adr/`: read the ADRs before changing sync, the index, file writes or Git handling. They explain why things are the way they are (e.g. 0009 atomic writes, 0014 periodic scan, 0015 index as cache).
- `docs/developer/features.md`: the feature budget. Every feature is classified (core, optional, parked) with its size; a new feature gets a row there before it is built, and parked ones get no new work.
- `CONTRIBUTING.md`: commit rules, testing philosophy (sociable tests, mock only external boundaries).

## Commands (from the repo root)

- `npm run test` runs pytest and vitest (frontend, the parser package and `apps/mobile/`). Mobile alone: `npm run test:mobile`. Backend alone: `uv run pytest -q`; frontend alone: `cd apps/web && npx vitest run`.
- `npm run lint`, `npm run format`, `npm run typecheck` (mypy for the backend, `vue-tsc -b` for both apps, `tsc` for the packages; a plain `vue-tsc --noEmit` checks nothing).
- `npm run dev` starts both dev servers.

## Conventions

- Conventional Commits (`feat`, `fix`, `perf`, `chore`, ...). Do not add `Co-Authored-By` or "Generated with Claude Code" lines to commits or PRs.
- A pre-commit hook runs ruff and the frontend formatter on staged files.
- The version comes from the Git tag (`vX.Y.Z`, via setuptools-scm). Do not push commits or tags without being asked.
