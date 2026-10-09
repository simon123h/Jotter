# Jotter Vault Format, version 1

This is the contract between everything that reads or writes Jotter data: the desktop backend (Python), the
Jotter Lite mobile app (TypeScript), and any other tool or experiment. A **vault** is a folder of plain markdown files.
Anything that follows this document can open a vault that another implementation wrote, and edit it without
destroying the other's data.

The format is defined by this document **and** by the fixtures in [`fixtures/`](fixtures). The fixtures are the
executable form of the rules below: when the two disagree, that is a bug in one of them, to be fixed
explicitly. Where the document is silent, the Python backend (`src/jotter/`) is the reference implementation.

The words MUST, SHOULD and MAY are used as in RFC 2119. Status: version 1 describes the format as it is
written today. Vaults carry no version marker.

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
- The frontmatter ends at the first line that is exactly `---` (trailing spaces allowed). Anything else is part
  of the frontmatter, including `---` inside a value. Later `---` lines, such as a markdown horizontal rule,
  belong to the body. Frontmatter may be empty. See the `body-with-rules` and `empty-frontmatter` fixtures.
- If the frontmatter is not valid YAML the file is **unreadable**: a reader MUST report an error and MUST NOT
  overwrite the file (see the `invalid-yaml` fixture). A frontmatter that is valid YAML but not a mapping is
  read as empty.
- The body is everything after the closing line, **without leading blank lines**. Trailing content is kept as
  is.
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
| `position` | number | `1000`. A numeric string is accepted. Anything else, and `0`, reads as `1000`. | always |
| `tags` | list of strings | `[]`. A comma separated string is accepted. | when not empty |
| `attachments` | list of file names | `[]`. A JSON list inside a string is accepted. | when not empty |
| `due_date` | `YYYY-MM-DD` | none. A time part is dropped. Unquoted YAML dates are accepted. | when set |
| `planned_date` | planning keyword or `YYYY-MM-DD` | none | when set |
| `priority` | `low` `medium` `high` `urgent` | `none`. Case-insensitive. | when not `none` |
| `color` | string: a palette name | none | when set |
| `postponed_until` | `YYYY-MM-DD` | none | when set |
| `created_at` | ISO 8601 timestamp | the time the file was read | always |
| `updated_at` | ISO 8601 timestamp | the time the file was read | always |

Further rules:

- **Aliases.** Readers MUST accept the legacy keys `bucket` (for `status`), `projectId`, `dueDate`,
  `plannedDate`, `postponedUntil`, `createdAt` and `updatedAt`. Writers MUST use the names in the table.
- **Tags** are lower-cased and lose a leading `#`. A tag may not contain a space.
- **Planning keywords** are `today`, `tomorrow`, `thisWeek`, `nextWeek`, `thisMonth`, `nextMonth`, `thisYear`,
  `nextYear`, `someday` and `sometime`. Readers compare them ignoring case and hyphens (`this-week`, `thisWeek`
  and `THISWEEK` are the same keyword). Writers keep the spelling they were given. The apps write the camelCase
  form.
- **Keyword in `due_date`.** Any planning keyword found in `due_date` is read as `planned_date`.
- **Values a reader cannot use are dropped, the task is still read.** This covers an unknown `priority`, a tag
  with a space, a `planned_date`, `due_date` or `postponed_until` that is neither a keyword (planned only) nor a
  date, and a `position` that is not a number. See the `invalid-values-dropped` fixture. (A writer that finds
  such a value in a file it rewrites drops it as well, which is why the first four of these are not preserved.)
- **Colour.** The apps write the name of a palette colour: `red`, `orange`, `yellow`, `green`, `blue`, `purple`
  or `pink`. Readers MUST keep any other value as it is (for example `#rrggbb` written by another tool) and
  SHOULD draw it when they can. See the `color-name` and `color-hex` fixtures.
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
   MUST do the same, and MUST keep its body. See the project `unknown-keys` fixture.
2. **Unknown files survive.** An implementation MUST NOT delete or rewrite files it does not own: other
   folders, `.canvas` files, `timeblocks.json`, `settings.json`, attachments of other tasks, and so on.
3. **No gratuitous rewrites.** Writers SHOULD NOT rewrite a file whose content would not change, so that sync
   tools and git stay quiet.
4. **Writes are atomic.** Write to a temporary file in the same folder, then rename.
5. **Be liberal in what you read.** Prefer reading a file with defaults and dropping the odd value to refusing
   it. The only reason to refuse a file is frontmatter that is not valid YAML (section 2).

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

1. **Title of a file without a title.** The spec says `Untitled Task` (what the Python backend does). The
   mobile parser could take the first heading of the body instead, which is friendlier, but then both
   implementations and the fixture have to change together.
2. **Whitespace.** Implementations write slightly different whitespace around the body. Fixtures compare parsed
   values, not bytes. A byte-exact canonical form is not defined.
3. **Unreadable manifests.** An `index.md` with invalid YAML is read as an empty manifest, and a later rewrite
   keeps its text as the body. Refusing to rewrite it, as tasks do, may be better.
