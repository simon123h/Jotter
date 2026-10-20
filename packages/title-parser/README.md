# title-parser

The smart title input of Jotter, shared by the desktop app (`apps/web/`) and the mobile app (`apps/mobile/`).

It finds dates (`tomorrow`, `fri`, `21.5.`), priorities (`p1`..`p4`), tags (`#tag`) and columns (`/todo`) in a task title and
returns the cleaned title with what it found. A date plans the task; with `!` in front of it, or `until` (`bis` for German), it is a deadline instead. It has no dependencies. Its tests are in `apps/web/src/utils/__tests__/`.
