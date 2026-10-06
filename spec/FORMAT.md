# Jotter Vault Format, version 1

This is the contract between everything that reads or writes Jotter data: the desktop backend (Python), the
Android app (TypeScript), and any other tool or experiment. A **vault** is a folder of plain markdown files.
Anything that follows this document can open a vault that another implementation wrote, and edit it without
destroying the other's data.

The format is defined by this document **and** by the fixtures in [`fixtures/`](fixtures). The fixtures are the
executable form of the rules below: when the two disagree, that is a bug in one of them, to be fixed
explicitly. Where the document is silent, the Python backend (`src/jotter/`) is the reference implementation.

The words MUST, SHOULD and MAY are used as in RFC 2119. Status: version 1 describes the format as it is
written today. Vaults carry no version marker yet (see [Open questions](#open-questions)).

## 1. Vault layout

```
<vault>/
├── <project-id>/               one folder per project
│   ├── index.md                project manifest: metadata and the board's buckets
│   ├── <task-id>.md            one file per task
│   ├── attachments/<task-id>/<file>
│   └── <name>.canvas           optional canvas files (JSON Canvas), not part of the core format
├── settings.json               optional, application settings (not part of the core format)
├── timeblocks.json             optional, time blocking (not part of the core format)
├── tasks.db                    derived search index, never authoritative
└── .git/                       optional version history
```

- Every sub-folder of the vault whose name does not start with `.` is a project. The folder name is the project
  id. `tasks.db` is not a project.
- In a project folder, every `*.md` file is a task, except `index.md`, `readme.md` (any case) and files whose
  name starts with `.`.
- Task and project ids are used as file and folder names. They MUST NOT contain `/`, `\`, NUL, or be `.` or `..`.
- Files are UTF-8. Readers MUST accept LF and CRLF line endings. Writers SHOULD write LF.
- Markdown files are the only source of truth. Indexes and caches (`tasks.db`, IndexedDB) can be deleted and
  rebuilt at any time.

## 2. Frontmatter files

Tasks and project manifests share one file shape: a YAML mapping between `---` lines, followed by a markdown
body.

```
---
key: value
---

Body text
```

- A file that does not start with `---` has no frontmatter. The whole file is the body.
- The frontmatter ends at the next `---`. Readers MUST NOT treat later `---` lines (for example a markdown
  horizontal rule) as delimiters: they belong to the body. See the `body-with-rules` fixture.
- The body is everything after the closing line, **without leading blank lines**. Trailing content is kept as
  is.
- Readers MUST ignore frontmatter that is not a mapping.
- Key order carries no meaning. Writers SHOULD keep a stable order (the known keys, then unknown keys) so
  that diffs stay small.

## 3. Tasks (`<project>/<task-id>.md`)

| Key | Type | Read rule when missing or odd | Written |
| :-- | :-- | :-- | :-- |
| `type` | string | ignored | always, `task` |
| `id` | string | file name without `.md` | always |
| `project_id` | string | **the folder name always wins**; frontmatter is only a fallback | always |
| `title` | string | `Untitled Task` when missing or empty. The body is not consulted. | always |
| `status` | string | `bucket` (legacy key), then `todo`; empty counts as missing | always |
| `position` | number | `1000`. A numeric string is accepted. `0` also reads as `1000`. | always |
| `tags` | list of strings | `[]`. A comma separated string is accepted. | when not empty |
| `attachments` | list of file names | `[]`. A JSON list inside a string is accepted. | when not empty |
| `due_date` | `YYYY-MM-DD` | none. A time part is dropped. Unquoted YAML dates are accepted. | when set |
| `planned_date` | planning keyword or `YYYY-MM-DD` | none | when set |
| `priority` | `low` `medium` `high` `urgent` | `none`. Case-insensitive. | when not `none` |
| `color` | string, usually `#rrggbb` | none | when set |
| `postponed_until` | `YYYY-MM-DD` | none | when set |
| `created_at` | ISO 8601 timestamp | the time the file was read | always |
| `updated_at` | ISO 8601 timestamp | the time the file was read | always |

Further rules:

- **Aliases.** Readers MUST accept the legacy keys `bucket` (for `status`), `projectId`, `dueDate`,
  `plannedDate`, `postponedUntil`, `createdAt` and `updatedAt`. Writers MUST use the names in the table.
- **Tags** are lower-cased and lose a leading `#`. A tag may not contain a space.
- **Planning keyword in `due_date`.** A keyword such as `today` found in `due_date` is read as `planned_date`.
- **Planning keywords** that are known today: `today`, `tomorrow`, `someday`, `sometime`, `this-week`,
  `next-week`, `thisweek`, `this-month`, `thismonth`, `this-year`, `thisyear`.
- **Attachments** are bare file names. The files live in `<project>/attachments/<task-id>/`. A name MUST NOT
  contain a path separator.
- **Body.** Markdown, preserved exactly (apart from the leading blank lines above). Checklists
  (`- [ ]`, `- [x]`) are plain markdown and are edited in place.

## 4. Project manifest (`<project>/index.md`)

| Key | Type | Read rule when missing | Written |
| :-- | :-- | :-- | :-- |
| `type` | string | ignored | always, `project` |
| `id` | string | folder name | always |
| `title` | string | `name` (legacy), then the folder name capitalised | always |
| `description` | string | empty | when not empty |
| `created_at` | ISO 8601 timestamp | the time the file was read | when set |
| `done_clean_period` | integer days | none (`doneCleanPeriod` is the legacy key) | when set |
| `buckets` | list of buckets | the default buckets, see below | always |

A **bucket** is a board column:

| Key | Type | Read rule when missing |
| :-- | :-- | :-- |
| `name` | string, the slug tasks refer to in `status` | `id`, then `column_<index>` |
| `title` | string | `name`, then the name capitalised |
| `subtitle` | string | empty |
| `position` | number | `(index + 1) * 1000` |
| `color` | string | none |
| `layout` | `list`, `grid-2` or `grid-3` | `list` |
| `max_tasks` | integer | none |
| `is_default` | boolean | `false` |

- The **default buckets**, used when `buckets` is missing or empty, are `backlog` (default bucket), `todo`,
  `in-progress`, `done` and `archive`, at positions 1000 to 5000.
- A missing or unreadable `index.md` behaves like an empty manifest.
- The body of `index.md` is free text for humans and other tools. Writers MUST keep it. A new manifest gets a
  `# <title>` heading.
- A task whose `status` names no bucket still belongs to its project. Implementations decide how to show it.

## 5. Preservation rules

These matter most, because several programs edit the same vault.

1. **Unknown frontmatter keys survive.** A task read and written back MUST keep keys it does not know, with
   their values (including nested lists and mappings). See the `unknown-keys` fixture. A project manifest
   SHOULD do the same, and MUST keep its body.
2. **Unknown files survive.** An implementation MUST NOT delete or rewrite files it does not own: other
   folders, `.canvas` files, `timeblocks.json`, `settings.json`, attachments of other tasks, and so on.
3. **No gratuitous rewrites.** Writers SHOULD NOT rewrite a file whose content would not change, so that sync
   tools and git stay quiet.
4. **Writes are atomic.** Write to a temporary file in the same folder, then rename.
5. **Be liberal in what you read.** Prefer reading a file with defaults to refusing it (see the first
   open question).

## 6. Optional parts

These files are not needed to read or write tasks. An implementation that does not support them MUST leave them
alone (rule 2) and MUST NOT fail because they exist.

- `settings.json`: application settings, one JSON object. Unknown keys MUST be preserved.
- `timeblocks.json`: a JSON list of time blocks (`id`, `title`, `date`, `start_time`, `end_time`, `color`,
  `task_ids`, `recurrence`).
- `<name>.canvas`: [JSON Canvas](https://jsoncanvas.org) files.

## Conformance

[`fixtures/`](fixtures) holds sample files with the result every implementation must produce. See
[`README.md`](README.md) for how they are run and how to add a case.

## Open questions

Decisions the fixtures currently record as they are, but that deserve an explicit choice:

1. **Invalid values.** The Python reader raises on a few bad values: an unknown `priority`, a tag with a space,
   and a planning or date value it does not know (for example `nextWeek` or `sometime-maybe`, the latter of
   which an earlier version of the user documentation listed). One such value makes the whole task file
   unreadable. Should readers instead drop the bad value and keep the task? The `Be liberal` rule says yes.
2. **Planning keyword list.** `disk_repo.py` treats `thisWeek`, `nextWeek`, `thisMonth`, `nextMonth`, `thisYear`
   and `nextYear` as keywords in `due_date`, but the `DueDate` value object only accepts the list in section 3.
   So `nextWeek`, `nextMonth` and `nextYear` make the file unreadable. The two lists should become one.
3. **Title of a file without a title.** Python gives `Untitled Task`, the Android parser takes the first line
   of the body. A heading is arguably friendlier, but the rule must be one or the other.
4. **Frontmatter delimiter.** The Python reader splits at the first two `---` anywhere in the text instead of
   at lines that are exactly `---`. A frontmatter value containing `---` can therefore break parsing.
5. **Version marker.** A `format_version` (for example in `index.md` or a `.jotter` file at the vault root)
   would let a newer vault be detected instead of silently misread.
6. **Whitespace.** Implementations write slightly different whitespace around the body. Fixtures compare
   parsed values, not bytes. Is a byte-exact canonical form worth defining?
7. **Unknown keys in `index.md`.** The Android parser keeps them when it rewrites a manifest, the Python backend
   does not yet. The rule is a SHOULD until Python does, then it can become a MUST with a fixture.
