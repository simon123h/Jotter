# task-filter

The task search of Jotter, shared by the desktop app (`apps/web/`) and the mobile app (`apps/mobile/`): the query language of the
search field (`tag:ui+bug prio:high due:before:2026-12-31 "fix leak"`) and the matching of tasks against it.

- `parseQuery(query)` gives a `TaskFilter`, `stringifyQuery(filter)` the query back.
- `filterTasks(tasks, filter)` keeps the tasks that match, in their order, or in the one the filter's `sort` asks for (`sortTasks` does the sorting alone).
- `parseTags(text)` is what a tag field makes of a text: commas, semicolons, bars, line breaks or spaces separate tags (`foo bar` is two tags), a leading `#` goes, tags are lower case, each appears once.
- `isoDay(offset)` and `today()` name days in the local calendar (not UTC, which is a day off around midnight).
- `planned.ts` has the planned date: `plannedStart`, `plannedSpan` and `plannedSlot` read a day, a week (`2026-W43`) or a month (`2026-10`); `isBeyond(planned, horizon, today)` tells whether a task is planned further ahead than a view looks (`HORIZONS`, `horizonEnd`).

The Python backend answers the same filters from its SQLite index. The cases in `spec/fixtures/search/` are run against
both (`apps/web/src/utils/__tests__/taskFilter.spec.ts` and `tests/test_search_conformance.py`), so that they agree. The
syntax is described in `docs/user/searching-filtering.md`.

## Titles

`compareTitles(a, b)` sorts titles the way the project lists do: emojis, symbols and punctuation in front of a title do not count. `withoutEmoji(title)` takes the emojis out of a title for the window or tab title.
