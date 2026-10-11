# ADR 0018: Repository Layout: Apps, Shared Packages and the Spec

- **Status**: Accepted
- **Date**: 2026-10-11
- **Related**: [ADR 0016](./0016-rewrite-backend-from-go-to-python.md), [ADR 0017](./0017-mobile-app.md), `spec/README.md`

## Context

Jotter started as one web client for one backend. It now has two clients, the web app and the Android app, that agree on the vault files and want to share some behaviour: the colour themes, the smart title input, the search language and the format parser. Before this decision the clients sat at the repository root as `frontend/` (later `web/`) and `mobile/`. "Frontend" read as "all the UI", the two clients looked unrelated to the shared code, and the shared code had no single place.

## Decision

```
apps/web         the web client, served by the backend and also built as a static demo
apps/mobile      the Android app (Capacitor)
packages/        TypeScript shared by the apps: vault-format, themes, title-parser, task-filter
spec/            the vault format and the conformance fixtures, for every implementation
src/, tests/     the Python backend (the root stays the backend's project)
docs/            user and developer documentation
```

- **Apps are products you can run; packages are code the apps share.** A package has no build step: it is TypeScript source that each app aliases (`@jotter/themes`, ...) in its Vite config and tsconfig. Each package has a `package.json` and a README.
- **The spec is the contract between implementations.** The format and the search behaviour are written down once, with fixtures that every implementation runs. The Python backend and the TypeScript packages agree through them, not through shared code.
- **Each app and package is its own npm project**, with its own lockfile, installed by `npm run install:all`. There are no npm workspaces (see below).
- **The Python backend stays at the root.** Its build (`setuptools-scm`, the `src/` layout, `uv.lock`, the web bundle copied into the wheel) is tied to the repository root, and moving it would put the PyPI release at risk for no practical gain.
- **Tooling follows the layout, not a list.** Dependabot and Codecov watch `/apps/*` and `/packages/*`, so a new app or package needs no configuration of its own. Coverage is reported with one flag per area: backend, web, mobile and packages.

## Rationale

- `web` and `mobile` name the two clients on the same level, and `packages` shows what they share.
- A shared package is the right size of abstraction: a pure function with fixtures, not a framework. Anything with UI stays inside an app until it is proven common.
- Separate lockfiles keep each project's dependencies independent: the web app can move to a new TypeScript major while the others stay, and Gradle and Capacitor find `node_modules` where they expect it.

## Consequences

- Code in `packages/` must not import from an app. Tests of a package may live in an app that uses it (the title parser and the search are tested through `apps/web`); the package's own coverage is then counted through the apps.
- A path that crosses the layout (`../../packages`, `../../spec`) is written in the Vite configs, tsconfigs and a few specs. Moving a folder means updating them.
- The type check for an app is `vue-tsc -b` (`npm run typecheck`). A plain `vue-tsc --noEmit` in the app folder checks nothing, because the root tsconfig only has references.

## Alternatives Considered

- **Keep `frontend/` and `mobile/` at the root.** Works, but the root then holds two clients, three kinds of packages and the backend side by side, with names that describe different things.
- **Move the backend to `apps/server`.** The most uniform layout. The cost is in the release build, the version from the Git tag and the PyPI package, which would all need new paths, for little benefit to anyone using the repository.
- **npm workspaces with one lockfile.** One install and shared dependency bumps. It would also force one version of each tool across the apps and move `node_modules` to the root, where Capacitor and Gradle do not look. Worth revisiting if the apps start to drift.
