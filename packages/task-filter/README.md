# task-filter

The task search of Jotter, shared by the desktop app (`web/`) and the mobile app (`mobile/`): the query language of the
search field (`tag:ui+bug prio:high due:before:2026-12-31 "fix leak"`) and the matching of tasks against it.

- `parseQuery(query)` gives a `TaskFilter`, `stringifyQuery(filter)` the query back.
- `filterTasks(tasks, filter)` keeps the tasks that match, in their order.

The Python backend answers the same filters from its SQLite index. The cases in `spec/fixtures/search/` are run against
both (`web/src/utils/__tests__/taskFilter.spec.ts` and `tests/test_search_conformance.py`), so that they agree. The
syntax is described in `docs/user/searching-filtering.md`.
