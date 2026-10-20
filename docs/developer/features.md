# Feature Budget

What Jotter does, where, how much code each part costs, and how much it is worth keeping. The point is to **keep the code base small enough to hold in one head**: every feature costs lines, tests and attention for as long as it lives, so each one is classified, and a new one has to be placed in this table before it is added (an ADR when it is large).

Sizes are lines of code **including tests**, rounded, from the tree of 2026-10-11 (`python3 scripts/loc_history.py --current` counts per area). They say what a feature costs, not how it is written. The whole code base is about 52k lines: backend 10.7k, web 31k, mobile 8.3k, shared packages 1.6k.

## The classes

| Class | Meaning |
| :-- | :-- |
| **Core** | Jotter is not Jotter without it. It gets full care and must work on every client that offers it. |
| **Optional** | Useful and well isolated: it lives in its own feature folder or module, and the core does not depend on it. It is kept, and may be desktop-only. |
| **Parked** | Kept, but it gets **no new work**, and it is the first thing to remove when it gets in the way (a refactor, a dependency, a failing test nobody wants to fix) or when it is not used. Removing it is cheap on purpose: nothing else depends on it. |

The classification below is a **proposal** for the maintainer to correct. Move a row when the answer changes.

## The table

| Feature | Desktop | Mobile | Size | Class | Where / notes |
| :-- | :-: | :-: | --: | :-- | :-- |
| Vaults: a folder of Markdown files, several vaults | yes | yes | ~1.2k | Core | `features/vaults`, `VaultManageModal`; mobile has its own vault repository |
| Projects and columns (buckets), pinned projects | yes | yes | ~2.5k | Core | `features/projects`, `features/buckets`, `ProjectSidebar`, `ColumnEditModal` |
| Tasks with all attributes: notes, checklist, tags, priority, due, planned, colour, attachments | yes | yes | ~6k | Core | `features/tasks`, `features/task-editor`, task card |
| Board view | yes | yes | ~0.5k | Core | `BoardView` |
| Lower pane of the board: dock a large column (Backlog, Inbox) across the bottom, resizable | yes | n/a | ~0.3k | Optional | `BoardView`, `ColumnEditModal` (the checkbox), `ui` store (`dockedColumns`, `dockHeight`); a browser setting, not in the vault, desktop widths only |
| Search and filters (query language) | yes | yes | ~1.5k | Core | `packages/task-filter` (shared), `FilterModal`; fixtures run against Python |
| Bulk actions on a selection | yes | yes | ~1k | Core | `components/ui/bulk`, mobile toolbar |
| Hotkeys for the bulk menus (`t`, `p`, `m`, `d`, `s`, `z`, `c`) and number keys inside them | yes | no | ~0.1k | Optional | `ProjectLayout.vue`, `BulkActionBar.vue`, `BulkActionMenu.vue` |
| Smart title input (dates, priority, tags, column) | yes | yes | ~0.6k | Core | `packages/title-parser` (shared) |
| Vault format and Obsidian/PKM compatibility | yes | yes | ~2k | Core | `spec/`, `packages/vault-format`, `index.md` manifests |
| Themes (light and dark theme follow the device) and languages (English, German) | yes | yes | ~1.9k | Core | `packages/themes` (shared), `locales` |
| Indexing and periodic scan | yes | own | ~1.8k | Core | `features/sync` (SQLite index, ADR 0014/0015); mobile scans through its repository |
| Planned date (a day, a week or a month) and the planning horizon: planned tasks beyond it stay in their column, hidden | yes | yes | ~0.6k | Core | `spec/FORMAT.md` (*Dates and times*), ADR 0024; `packages/task-filter/planned.ts` (shared), `useTasksWithinHorizon`, `HorizonSheet` |
| Recurring tasks: `repeat` rule, rolled over in place on completion | yes | yes | ~0.8k | Core | `spec/FORMAT.md` (*Recurring tasks*), ADR 0019, 0024 |
| Readable file names: new tasks are named after their title (`grocery-shopping.md`) | yes | yes | ~0.3k | Core | `spec/FORMAT.md` (*File names of new tasks*), ADR 0020; the slug is written twice (`shared/slug.py`, `packages/vault-format/src/taskName.ts`) and checked by `spec/fixtures/filenames/slug.json` |
| Archiving projects: a project is put away with `archived: true`, out of the lists, the "all" view, reminders and the MCP server | yes | yes | ~0.5k | Optional | `spec/FORMAT.md` (*Project manifest*), ADR 0021; the flag lives in `index.md`, so it syncs |
| Reminders: notifications at a floating local time | edit only | yes | ~0.8k | Optional | `spec/FORMAT.md` (*Reminders*), ADR 0019; mobile arms Android notifications (`src/reminders.ts`); the desktop sets and shows them but does not notify (browser notifications only work while the page is open: branch `feat/desktop-reminder-notifications`) |
| Tag view and planning view | yes | yes | ~0.5k | Optional | `TagView`, `TimeView`; mobile has them as tabbed views |
| Links and bookmarks: domain chip on the card, "already saved" hint, page-title look-up (mobile only) | yes | yes | ~0.7k | Optional | `packages/links` (shared), `TaskCardFooter`, `TaskRow`, the add dialogs. The title look-up is `apps/mobile/src/linkTitle.ts` (ADR 0023): the phone loads the page, only for a task that is nothing but an address; the desktop makes no requests |
| List layout of the board, tag and planning views | n/a | yes | ~0.3k | Optional | `BoardScreen`: one list with a collapsible section per column instead of the tabs, set in the app bar menu. Sections can be collapsed; moving a task to another column is the move sheet, as in the tabs |
| Git versioning and Time Machine | yes | no | ~1.3k | Optional | git part of `features/sync`, `TimeMachineModal`; ADR 0012 |
| MCP server (AI assistants) | yes | no | ~0.7k | Optional | `mcp_server.py`, optional package extra |
| Voice dictation | yes | no | ~0.2k | Optional | `useSpeechRecognition`, browser API |
| Project for quick capture: shared text, the new-task shortcut and the `i` key go to a chosen project (`captureProjectId` in the vault's `settings.json`) | yes | yes | ~0.15k | Optional | `useCaptureTask.ts`, `GeneralSettings.vue`, mobile `SettingsSheet.vue`, `shortcuts.ts` |
| Share target: text shared from other Android apps becomes a task | no | yes | ~0.2k | Core | `MainActivity.java` (turns it into a `jotter://share` link), `src/shortcuts.ts`, quick add |
| List view | yes | no | ~0.3k | Optional | `ListView` |
| Home / project overview | yes | no | ~0.2k | Optional | `HomeView` |
| Task review session (triage cards) | yes | no | ~1.9k | Parked | `features/task-triage`, `ReviewView` |
| Time blocking | yes | no | ~3.1k | Parked | `features/timeblock` (+ backend `features/timeblock`) |
| 2D infinite canvas | yes | no | ~2.5k | Parked | `features/canvas` (+ backend `features/canvas`), ADR 0010 |
| Eisenhower matrix view | yes | no | ~0.5k | Parked | `MatrixView` |
| Static demo on GitHub Pages | yes | n/a | ~0.7k | Parked | `storage/demoAdapter.ts`, a second backend written in TypeScript. It stores `repeat` and `reminders` but does not roll recurring tasks over, so the demo differs from the backend and the mobile app there. `spec/fixtures/adapter/scenarios.json` is replayed against the demo and the backend (`adapterContract.spec.ts`, `tests/test_adapter_contract.py`), so a new difference fails a test; a known one is listed as `skip` with its reason |

The parked rows add up to about **9k lines (17 % of the code base)**, which no other feature depends on.

## How to use this

- **Adding a feature**: put a row here first, with a class and a rough size. A feature that would be more than ~1k lines, or that touches the core, gets an ADR (see `docs/developer/adr/`).
- **Mobile**: it only takes what is core or what is cheap to share. The list of what is out of scope is in [ADR 0017](./adr/0017-mobile-app.md); a row marked "no" under Mobile stays out unless that ADR is changed.
- **Parking, not deleting, is the first step**: a parked feature stays working but is not extended. If nobody has touched it for a long time and it costs attention (a dependency to keep, a test that breaks on every refactor), remove it in a commit of its own so that the removal can be reverted.
- **Check the cost now and then**: `python3 scripts/loc_history.py` followed by `python3 scripts/plot_loc.py` shows growth per area. The table's sizes should be refreshed when a row changes class.
