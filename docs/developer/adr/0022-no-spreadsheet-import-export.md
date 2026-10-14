# ADR 0022: No Spreadsheet Import and Export

- **Status**: Accepted
- **Date**: 2026-10-15
- **Related**: [ADR 0017](./0017-mobile-app.md), `docs/developer/features.md`

## Context

The web app had an Excel and CSV import (a seven-step wizard with column mapping, destination strategies and a row preview) and an export of the current view to `.xlsx` or `.csv`. Together they were about 1.7k lines with tests, plus the `xlsx` dependency (SheetJS), which is not on npm and is installed from a CDN tarball. It was used once, to bring tasks over from Microsoft Planner. The Android app never had it.

The two directions are not alike. The vault is already the export: a folder of Markdown files that opens in any editor, and a spreadsheet of it cannot be read back without losing data. The import is a one-time migration from a source we cannot predict (Planner, Trello, a text list), and a wizard with fixed column keywords only covers the sources it was written for.

## Decision

Both features are removed. Migration goes through the paths Jotter has anyway:

- **An AI assistant over the MCP server.** `create_project`, `create_bucket` and `batch_create_tasks` take what the assistant understood from any source format, and it can clean up on the way.
- **A script that writes task files** by the vault format (`spec/FORMAT.md`). The next scan picks them up (ADR 0014).

`docs/user/migrating.md` describes both.

## Consequences

- About 1.7k lines, the `xlsx` dependency and two dialogs' worth of translations are gone, and with them the web app's CDN-hosted package.
- A user without an assistant or a script has no ready-made way to bring a spreadsheet in. We accept that for a task done once per tool and person.
- The MCP tools become the supported migration interface, so `batch_create_tasks` should keep its fields stable.
- Existing vaults are unaffected: nothing in the vault format changes.
