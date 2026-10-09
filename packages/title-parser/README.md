# title-parser

The smart title input of Jotter, shared by the desktop app (`frontend/`) and Jotter Lite (`mobile/`).

It finds dates (`tomorrow`, `fri`, `21.5.`), priorities (`p1`..`p4`), tags (`#tag`) and columns (`/todo`) in a task title and
returns the cleaned title with what it found. It has no dependencies. Its tests are in `frontend/src/utils/__tests__/`.
