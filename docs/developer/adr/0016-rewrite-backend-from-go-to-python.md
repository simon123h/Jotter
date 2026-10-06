# ADR 0016: Rewrite the Backend from Go to Python

- **Status**: Accepted (written retroactively; the decision was made on 2026-08-27 without an ADR; the PyInstaller bundle was dropped again on 2026-10-06)
- **Date**: 2026-08-27 (decision), recorded 2026-10-06
- **Related**: [ADR 0006](./0006-dual-runtime-architecture.md), [ADR 0009](./0009-cross-platform-atomic-writes.md)

## Context

Until 2026-08-27 the backend was written in Go (HTTP API, SQLite index, Markdown storage, Git integration) with a Wails desktop shell. The last Go commit is `58b7f58`; the rewrite landed in `d6e559b` ("refactor: first attempt to rewrite to python") and was merged as `8f64f34`. A leftover Go integration test was removed in `d7d7968`.

At that point the Go backend consisted of about 7,400 lines of code and 4,100 lines of tests across 53 files. The Python backend today is about 6,700 lines of code and 3,800 lines of tests, and it has since gained features the Go version never had (an MCP server, a configurable data directory, Windows-specific write handling).

Jotter is a local, single-user tool. The backend mostly does file I/O, SQLite queries and `git` subprocess calls. It has no heavy computation and no real concurrency requirements, so Go's main strengths (raw speed, goroutines) matter little for it.

## Decision

Rewrite the backend in Python (FastAPI, Uvicorn, SQLite) and keep the Markdown file format, the API shape and the Vue frontend unchanged. Distribute it through PyPI as `jotter-app`, installable with `pipx` or `uvx`, instead of through per-platform binaries. The Wails desktop shell is dropped.

Standalone PyInstaller binaries for Windows, Linux and macOS were added as a secondary channel (`61c163e`) and removed again on 2026-10-06. They were attached to every release but never used: the v3.20.0 binaries had no downloads, and the author never ran one. `jotter.spec`, the release job, the `MEIPASS` lookup in `app.py` and the installation docs for them are gone. Past releases keep their old binaries.

## Rationale

- **PyPI distribution.** `pipx install jotter-app` gives install, upgrade and uninstall on every platform with one release artifact. There are no per-OS binaries to build, no code signing and no Windows SmartScreen warnings. `go install` would instead require a Go toolchain, and prebuilt Go binaries would need a release pipeline per OS. For a tool its author runs on their own machines, this was the deciding practical advantage.
- **No increase in code size.** The Python backend is about 9% smaller than the Go one while covering more features, so the rewrite did not trade brevity for convenience in the other direction.
- **Fits the workload.** The costs that matter are file opens and `git` process spawns, which Go would pay as well.
- **Integration with the surrounding tooling.** The MCP server and the project's scripts are in Python, and sharing a language removes a boundary.
- **Simpler shell.** Dropping Wails removes a native build dependency and a second desktop runtime from the repository ([ADR 0006](./0006-dual-runtime-architecture.md)).

## Consequences

- **Startup and runtime performance are worse by default.** A Python process starts slower and does more work per request than a Go binary. Since the rewrite, a series of `perf(...)` changes were needed to keep the sync fast on large vaults and slow Windows machines ([ADR 0014](./0014-periodic-scan-instead-of-watcher.md), [ADR 0015](./0015-index-as-disposable-cache.md)). Part of that cost, such as spawning `git`, would have existed in Go too, but Go would probably have had more headroom.
- **No compile-time type checking.** Correctness relies on type hints, a type checker and the test suite instead of the compiler.
- **Users need Python.** The PyPI path requires a Python 3.12+ interpreter and `pipx` or `uv`. There is no longer a Python-free desktop install, so a Windows user without Python is the group that loses out. If that need appears, a PyInstaller bundle can be reintroduced from the history (`jotter.spec` before this change).
- **Windows behaviour needs explicit care**, for example the retry on atomic file replacement ([ADR 0009](./0009-cross-platform-atomic-writes.md)).
- **No record of the original reasoning.** No ADR was written at the time. This document reconstructs the decision from the commit history and the author's recollection of valuing PyPI distribution. Other motivations may have existed that are not recorded here.

## Alternatives Considered

- **Stay on Go.** Keeps a single static binary, fast startup and compile-time types. It costs more release engineering per platform, no PyPI-style install, and a language boundary to the MCP server and scripts.
- **Keep Go and add a Python launcher on PyPI that downloads the binary.** Gives PyPI installs but needs per-platform wheels or a download step at first run. This is more machinery than the rewrite, for a codebase of this size.
