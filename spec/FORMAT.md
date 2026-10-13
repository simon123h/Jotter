# Jotter Vault Format, version 1

This is the contract between everything that reads or writes Jotter data: the desktop backend (Python), the
mobile app (TypeScript), and any other tool or experiment. A **vault** is a folder of plain markdown files.
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
| `repeat` | mapping: `every`, `unit`, `from` (see *Recurring tasks*) | none | when set |
| `reminders` | list of `YYYY-MM-DDTHH:mm` (see *Reminders*) | `[]`. A single string is accepted. | when not empty |
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
  date, a `position` that is not a number, a `repeat` that does not follow the rules below and a reminder that
  is not a local date-time. See the `invalid-values-dropped` and `repeat-invalid` fixtures. (A writer that finds
  such a value in a file it rewrites drops it as well, which is why these are not preserved.)
- **Colour.** The apps write the name of a palette colour: `red`, `orange`, `yellow`, `green`, `blue`, `purple`
  or `pink`. Readers MUST keep any other value as it is (for example `#rrggbb` written by another tool) and
  SHOULD draw it when they can. See the `color-name` and `color-hex` fixtures.
- **Attachments** are bare file names. The files live in `<project>/attachments/<task-id>/`. A name MUST NOT
  contain a path separator.
- **Body.** Markdown, preserved exactly (apart from the leading blank lines above). Checklists
  (`- [ ]`, `- [x]`) are plain markdown and are edited in place.

### File names of new tasks

A task's file name without `.md` is its id (see the table above), and it never changes: moving the task between
columns or editing its title does not rename the file. What a *writer* chooses for a new task:

1. **Take the title and make a slug.** Lowercase it. Replace `ä ö ü ß æ œ ø ł đ` by `ae oe ue ss ae oe o l d`, then
   decompose the text (Unicode NFKD) and drop the combining marks, so `é` becomes `e`. Replace every run of
   characters other than `a-z` and `0-9` by one `-`, and trim `-` from both ends.
2. **Limit it to 60 characters.** If it is longer, cut it after the last whole word that fits (at a `-`). A single
   word longer than 60 characters is cut at 60.
3. **Never leave it empty.** A title without any such characters (an empty title, only emoji, a script without a
   Latin form) gives `task`.
4. **Avoid a taken name.** If a task of *any project in the vault* has that name (compared without regard to
   case), or the name is *reserved*, append `-` and four random characters from `a-z0-9`, and look again until
   the name is free. Reserved names are `index` and `readme` (they are not tasks, see the vault layout) and the
   names Windows keeps for devices (`con`, `prn`, `aux`, `nul`, `com1`-`com9`, `lpt1`-`lpt9`). The whole vault is
   checked, not only the project folder, because the desktop's index keys tasks by id alone and a time block
   refers to a task by its id. No suffix is added when the name is free, which is why two devices that create the
   same title offline can still collide; the sync tool then keeps one of the files as a conflict copy.
5. **Moving a task** into another project keeps its file name. A writer MUST NOT overwrite a file of the same
   name in the target folder (another tool's vault can repeat a name in two projects): it refuses the move.

Readers accept any file name (ADR 0003): older tasks keep the 26-character ULIDs they were written with, and files
from other tools keep theirs. Writers MUST NOT rename an existing file because its title changed. The cases are in
`fixtures/filenames/slug.json`.

### Dates and times

A task has five fields about time. Each answers a different question, and none stands in for another:

| Field | Question | Value |
| :-- | :-- | :-- |
| `due_date` | When must it be done? | a day |
| `planned_date` | When do I intend to do it? | a keyword or a day |
| `postponed_until` | Until when should it stay out of my way? | a day |
| `reminders` | When should something nudge me? | local date-times |
| `repeat` | How does it come back? | a rule |

- **Days** (`YYYY-MM-DD`) are local calendar days with no time zone. "Today" is the day on the reader's clock.
- **Planning keywords** are relative to today. A writer MUST NOT turn a keyword into a date, and recurrence
  leaves keywords as they are.
- **A task is postponed** while `postponed_until` is after today. Readers show it out of the way and show it
  normally again from that day on. A postponed task stays in its own column (`status` is not touched): the
  apps hide such tasks by default and can show them, in that column, marked with the day they come back. A
  reader MUST NOT show a postponed task under a column other than its `status`, and a writer MUST NOT change
  `status` to postpone a task or to bring it back. Moving a postponed task to another column keeps the
  postponement.
- **Only reminders have a time of day**, and it is *floating*: `09:00` means 09:00 on the wall clock wherever
  the reader is, with no time zone and no UTC. `created_at` and `updated_at` are the only instants.
- `due_date` is date-only on purpose. A time of day belongs in a reminder (or a time block).
- `timeblocks.json` has its own `recurrence`. It is unrelated to `repeat`.

### Reminders

`reminders` is a list of local date-times, written `YYYY-MM-DDTHH:mm` and quoted.

- Readers also accept a space instead of `T`, seconds (dropped), a single string instead of a list, and an
  unquoted YAML timestamp.
- A value with a time zone designator (`Z`, `+02:00`) or without a time is not a local date-time, so it is
  dropped. Guessing a zone would move the reminder.
- The list is read sorted ascending, without duplicates. Writers write it that way.
- Whether a reminder has already fired is **not** part of the vault. It is device state: two devices must not
  conflict over it, and a reminder that was moved or edited counts as new.
- A reminder does not repeat. A reminder that comes back is a recurring task with a reminder (below).
- Delivering reminders is up to the app (a local notification on a phone, for example). A vault without an
  app that delivers them does not fire anything.

### Recurring tasks

```
repeat:
  every: 2
  unit: week
  from: completion
```

| Key | Value | Read rule |
| :-- | :-- | :-- |
| `every` | integer, at least 1 | required; a numeric string is accepted |
| `unit` | `day`, `week`, `month` or `year` | required; compared ignoring case, a plural (`weeks`) is accepted |
| `from` | `completion` or `due` | `completion` when missing |

A `repeat` without a usable `every` or `unit`, with a `from` that is neither `completion` nor `due`, or that is not a mapping, is dropped. A recurring task is one
file: there is never a second copy of it for a later occurrence, and a missed occurrence does not create a
pile of tasks.

**Completing a recurring task rolls it over instead of finishing it.** What counts as completing is up to the
app (moving the task to `done`, ticking it on a card, a bulk action). Given `today` and the task:

1. **The next day**, `next`:
   - `from: completion`: `today` plus `every` units.
   - `from: due`: `due_date` plus *k* times `every` units, for the smallest *k* of at least 1 that gives a day
     on or after `today`. So completing early moves one step ahead, and completing late catches up to the
     next day on the rhythm.
   - `from: due` on a task without `due_date` behaves like `from: completion`.
   - Adding months or years is calculated from the starting day and clamped to the end of a shorter month
     (31 January plus one month is 28 February). The result is what is stored, so the clamp sticks.
2. **The shift**: the anchor is `due_date`, else the day of the earliest reminder, else `today`. The shift is
   `next` minus the anchor, in days.
3. **The task** is rewritten:
   - `due_date`, when set, becomes `next`.
   - `planned_date`, when it is a day, and `reminders` (the time of day is kept) move by the shift. A planning
     keyword stays. An empty field stays empty.
   - `postponed_until` becomes `next`, so the task stays out of the way until its next occurrence. That is how
     a recurring task "reappears". (When `next` is today, the task is not postponed at all.)
   - `status` goes back to the bucket the task was in before it was completed. An app that does not know it
     uses the default bucket of the project.
   - Checklist items in the body are unticked (`- [x]` becomes `- [ ]`). The rest of the body is kept.
   - `updated_at` is set. `repeat` itself stays.

The rule is a pure function of the file and `today`, so two devices that complete the same task on the same
day write the same dates. See `fixtures/repeat/roll.json` for worked cases.

The task is only rolled when it is completed. A recurring task that nobody completes stays where it is, and is
overdue if it has a `due_date`.

## 4. Project manifest (`<project>/index.md`)

| Key | Type | Read rule when missing | Written |
| :-- | :-- | :-- | :-- |
| `type` | string | ignored | always, `project` |
| `id` | string | folder name | always |
| `title` | string | `name` (legacy), then the folder name capitalised | always |
| `description` | string | empty | when not empty |
| `created_at` | ISO 8601 timestamp | the time the file was read | when set |
| `done_clean_period` | integer days | none (`doneCleanPeriod` is the legacy key) | when set |
| `archived` | boolean | `false`. Only the boolean `true` archives: any other value reads as `false`. | only when `true` |
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
- **An archived project** (`archived: true`) is put away, not deleted: its folder, tasks and attachments stay as
  they are, and it can be restored by removing the key (writers omit `archived` when it is `false`, so there
  is no `archived: false` to find). While a project is archived:
  - Readers MUST NOT show it among the projects in use. An app MAY list archived projects apart, to restore or
    delete them, and MAY open one to read it.
  - Its tasks are left out of every view or answer that spans projects (an "all tasks" view, a search over the
    vault, a list for an assistant), unless the reader asks for archived projects explicitly.
  - **Reminders** of its tasks MUST NOT notify. They stay in the files, and notify again when the project is
    restored (a reminder in the past by then is simply past, as always).
  - An app MUST NOT remove tasks of it by itself, such as the cleaning of old done tasks.
  - Archiving a project does not change its tasks: no `status`, date or other field is written.
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
