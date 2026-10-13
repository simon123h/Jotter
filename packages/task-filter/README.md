# task-filter

The task search of Jotter, shared by the desktop app (`apps/web/`) and the mobile app (`apps/mobile/`): the query language of the
search field (`tag:ui+bug prio:high due:before:2026-12-31 "fix leak"`) and the matching of tasks against it.

- `parseQuery(query)` gives a `TaskFilter`, `stringifyQuery(filter)` the query back.
- `filterTasks(tasks, filter)` keeps the tasks that match, in their order.
- `parseTags(text)` is what a tag field makes of a text: commas, semicolons, bars, line breaks or spaces separate tags (`foo bar` is two tags), a leading `#` goes, tags are lower case, each appears once.
- `isoDay(offset)`, `today()` and `isPostponed(task)` name days in the local calendar (not UTC, which is a day off around midnight) and tell whether a task is postponed to a later day.

The Python backend answers the same filters from its SQLite index. The cases in `spec/fixtures/search/` are run against
both (`apps/web/src/utils/__tests__/taskFilter.spec.ts` and `tests/test_search_conformance.py`), so that they agree. The
syntax is described in `docs/user/searching-filtering.md`.
