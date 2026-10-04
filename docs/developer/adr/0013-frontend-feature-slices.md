# ADR 0013: Frontend Code Organization: Feature Slices and When to Split Components

## Status
Accepted

- **Date**: 2026-10-04
- **Author**: Antigravity (AI Coding Assistant) & User

## Context

The frontend (`frontend/src`) grew organically and ended up with two conflicting layouts:

1. **Layer-based**: `components/ui`, `components/views`, `components/modals`, `components/layout`, `composables/`, `stores/`.
2. **Feature-sliced**: `features/task-import`, `features/task-editor` and `features/task-triage`.

The migration to `features/` had only been half done, so some domains were split across both. The task editor's sub-components lived in `features/task-editor/` while `TaskDetailModal` and `TaskCreateModal` stayed in `components/modals/`. Triage had `TriageCard` in `features/` and `TriageView` in `components/views/`. Canvas and timeblocks were spread over `components/`, `stores/` and `views/`. Nothing said where new code should go.

Separately, a handful of components had grown past 600 lines (`BulkActionBar`, `TimeblockSidebar`, `SettingsView`, `TaskDetailModal`, `TriageView`, `TaskCard`). Splitting them for size alone turned out to be a poor goal. Several of the first splits made the source *longer* (each extracted file adds imports, `defineProps`/`defineEmits` and event forwarding) without simplifying anything. The splits that paid off were the ones that removed duplication or extracted logic that can be tested without mounting a component.

## Decision

### 1. Domain code lives in feature slices

A feature owns everything specific to one domain, in one folder:

```text
frontend/src/features/<feature>/
  components/        Vue components, including the routed view and modals of that domain
    __tests__/       component tests next to the code they test
  composables/       logic that is specific to the feature
  stores/            Pinia stores that belong to the feature
  utils/             pure functions (unit-testable without Vue)
  constants/         static data
```

Subfolders are created only when needed. Tests sit in an `__tests__/` folder beside the code they cover.

Current features: `canvas`, `settings`, `task-editor`, `task-import`, `task-triage`, `timeblock`.

### 2. Shared code stays at the top level

| Location | Holds |
| --- | --- |
| `components/ui/` | Presentational building blocks used by several features (cards, columns, modals shell, bulk action bar, snap scroller) |
| `components/layout/` | App shell: navigation, sidebars, layouts |
| `components/modals/` | The modal registry and modals that are not owned by a feature |
| `components/views/` | Routed pages that do not belong to a single feature (board, list, matrix, tags, review, home, timeline) |
| `composables/`, `utils/` | Generic helpers (keyboard shortcuts, file drop, long press, markdown, checklist parsing, tag and color styling) |
| `stores/` | App-wide state: project, settings, ui, vault, modal, selection, toast |
| `storage/`, `api.ts`, `platform.ts` | The data layer ([ADR 0006](./0006-dual-runtime-architecture.md)) and platform detection |

Rules of thumb for placing new code:

- If it is specific to one domain and would be deleted together with that domain, it goes in that feature.
- If two or more features need it, it goes in a shared location.
- A feature does **not** import from another feature. Anything needed by two features moves to shared code.
- Shared code should not import from a feature, with the exceptions listed below.

### 3. Split a component to remove duplication or to extract testable logic, not because it is long

A component is worth splitting when at least one of these is true:

- The same markup or logic exists more than once (for example two near-identical date menus, or a move flow and a resize flow with copied mouse tracking). Extract it once.
- There is logic with real behaviour (state machines, parsing, sorting, drag handling, multi-step actions) that can move into a composable or a pure function and be unit-tested without mounting the component.

A component is **not** worth splitting merely because it exceeds some line count. Moving a block of markup into a child component usually costs 25–40 lines of boilerplate and removes no logic. When such a split still makes sense (a self-contained section with its own state, such as the sections of the settings page), it should be justified on cohesion, not size.

Pure presentational pieces take props and emit events. Logic lives in composables (`use*`) or plain TypeScript modules under `utils/`, which is where tests are concentrated.

## Consequences

- New code has an unambiguous home, and a domain can be understood, changed or removed by working mostly in one folder.
- Moving files with `git mv` preserves history, but import paths changed across the codebase. Tests that mock modules by path (`vi.mock('@/features/...')`) must use the feature paths.
- Splitting components made the source somewhat larger overall (extracted files carry their own imports and declarations) while adding test coverage for previously untested logic. Reviewers should expect this and judge splits by the criteria above, not by line count.
- Known exceptions to "shared code does not import from features":
  - **Timeblock store.** `stores/project.ts`, `stores/vault.ts`, `components/ui/TaskCard.vue` and `components/layout/MainLayout.vue` read `features/timeblock/stores/timeblock`. It behaves like app-wide state and is a candidate to move to `stores/`.
  - **Composition points.** `ModalRegistry` and `ProjectLayout` mount feature modals and the timeblock sidebar, and `components/modals/TaskImportModal.vue` composes the `task-import` step components. Composing features is the job of these files.
- Some duplication remains where components share an idea but not code, for example the priority badge classes in `TaskCard`, `TaskDetailView` and `ListView`, and the column color map in `GenericColumn`. These can be consolidated when next touched.
