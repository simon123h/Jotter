# Jotter

<p align="center">
  <img src="https://github.com/simon123h/jotter/actions/workflows/ci.yml/badge.svg?branch=main" alt="Build Status">
  <img src="https://codecov.io/gh/simon123h/jotter/branch/main/graph/badge.svg" alt="Coverage">
  <img src="https://img.shields.io/badge/Python-v3.12+-3776AB?logo=python&logoColor=white" alt="Python Version">
  <img src="https://img.shields.io/badge/Vue.js-v3.5+-4FC08D?logo=vue.js&logoColor=white" alt="Vue Version">
  <img src="https://img.shields.io/endpoint?url=https%3A%2F%2Ftokei.kojix2.net%2Fbadge%2Fgithub%2Fsimon123h%2Fjotter%2Flines" alt="Lines of Code">
  <img src="https://badgen.net/github/release/simon123h/jotter?color=orange" alt="Latest Release">
  <img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License">
</p>

🚀 **Try the Online Demo**: [simon123h.github.io/Jotter/demo/](https://simon123h.github.io/Jotter/demo/)

Jotter is a **local-first, privacy-focused task management web application** designed to help you organize tasks without losing data ownership. Modeled as a Markdown Kanban board, Jotter helps combat "task flooding" through filtering and an intuitive UI, all while storing your data locally in **Open Knowledge Format (OKF)** compliant plain-text Markdown files. The integrated git support allows for syncing tasks seamlessly across devices.

**Documentation**: [simon123h.github.io/Jotter](https://simon123h.github.io/Jotter/)

---

## 🌟 Key Features

- **Your data stays yours**: Tasks are human-readable Markdown files in the **Open Knowledge Format (OKF)**, one folder per project. They stay accessible without Jotter, and project folders work inside an Obsidian or other PKM vault.
- **Built for hundreds of open tasks**: Kanban columns, list view, an Eisenhower Matrix and a time view, plus a search language and filters to fight task flooding. Dates, tags and priorities go straight into the task title.
- **Local-first and fast**: Runs entirely on your computer. A local SQLite index is rebuilt from your files whenever it is missing.
- **Git history**: If your vault is a Git repository, Jotter commits your changes locally and can restore any project or the whole workspace from the history. Pushing and pulling stay in your hands, as does any file sync tool.
- **Android app**: A lean, touch-first app with the core of the desktop app, fully offline on local Markdown files. Sync with your desktop via Syncthing, Git or a cloud drive.
- **AI-ready and multilingual**: Connect AI assistants through the Model Context Protocol (`jotter mcp`, optional: `pipx install 'jotter-app[mcp]'`). English and German.

---

## 📦 Quick Start

### Option 1: Run directly with `pipx` (Recommended for Desktop/Python users)

No cloning or Node.js required—just Python:

```bash
pipx run jotter-app
```

Or install globally in an isolated environment:
```bash
pipx install jotter-app
jotter
```

### Option 2: Android Mobile App (.apk)

Download the signed `jotter-*-android.apk` from [GitHub Releases](https://github.com/simon123h/jotter/releases) and install it on your Android phone. No server or internet connection required. Point it to your synced Markdown folder (via Syncthing, Git, etc.) for cross-device synchronization.

### Option 3: Run from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/simon123h/jotter.git
   cd jotter
   ```
2. Install dependencies:
   ```bash
   pip install -e .
   ```
3. Start the server:
   ```bash
   jotter
   # or: python3 run.py
   ```

Open your browser at **`http://localhost:58271`**.

Jotter works out of the box with these defaults:

- **Config and default vault**: Jotter uses standard OS-specific directories (XDG standard paths on Linux, AppData on Windows, Application Support on macOS). A `./jotter.yaml` in the folder you start Jotter from takes precedence over the global one.
- **Auto-Config Generation**: If no configuration file exists at all on startup, Jotter will automatically create a default, annotated `jotter.yaml` template file for you at the default location.

For advanced customization and full directory details, please see [the user configuration documentation](docs/user/configuration.md).

---

## 🛠️ Development & Testing

```bash
# Install the dependencies of the backend, the apps and the shared packages
npm run install:all

# Run the backend and the web dev servers concurrently
npm run dev

# Run all test suites (Pytest + Vitest)
npm run test

# Run the web app's E2E browser tests (Playwright)
cd apps/web && npx playwright test
```

---

## 📖 Documentation

The complete documentation is available at **[simon123h.github.io/Jotter/](https://simon123h.github.io/Jotter/)**.

Alternatively, you can refer to the raw Markdown source files in the `docs/` folder:

- **User Guide & Setup**:
  - [Configuring Jotter (Ports, Directories, Logs)](docs/user/configuration.md)
  - [Search & Filtering DSL](docs/user/searching-filtering.md)
  - [Moving Tasks In and Out](docs/user/migrating.md)
  - [Keyboard Shortcuts](docs/user/shortcuts.md)
  - [Postponing Tasks](docs/user/postponing.md)
  - [Markdown File Format Specification](docs/user/format-spec.md)
  - [Obsidian & PKM Sync](docs/user/obsidian.md)
  - [Git Versioning & Time Machine](docs/user/git-sync.md)
  - [Data Safety & Recovery](docs/user/safety.md)
- **Developer Reference**:
  - [Architectural Design (arc42)](docs/developer/architecture.md)
  - [API Documentation (Interactive OpenAPI/Swagger)](http://localhost:58271/docs) _(Available when running the server)_
  - [Contributing Guidelines](CONTRIBUTING.md)
