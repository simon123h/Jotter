# Jotter

<p align="center">
  <img src="https://github.com/simon123h/jotter/actions/workflows/ci.yml/badge.svg?branch=main" alt="Build Status">
  <img src="https://codecov.io/gh/simon123h/jotter/branch/main/graph/badge.svg" alt="Coverage">
  <img src="https://img.shields.io/badge/Go-v1.25-00ADD8?logo=go&logoColor=white" alt="Go Version">
  <img src="https://img.shields.io/badge/Vue.js-v3.5+-4FC08D?logo=vue.js&logoColor=white" alt="Vue Version">
  <img src="https://badgen.net/github/release/simon123h/jotter?color=orange" alt="Latest Release">
  <img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License">
</p>

🚀 **Try the Online Demo**: [simon123h.github.io/Jotter](https://simon123h.github.io/Jotter/)

Jotter is a **local-first, privacy-focused task management application** designed to help you organize tasks without losing data ownership. Modeled as a Markdown Kanban board, Jotter helps combat "task flooding" through filtering, intuitive UI, all while keeping your data stored locally in simple, plain-text files on your own machine. The integrated git support allows for syncing the tasks across devices.

![Jotter Kanban Board Screenshot](docs/assets/screenshot.png)

---

## 🌟 Key Features

- **Data Ownership & Portability**: Tasks are stored as human-readable `.md` markdown files. Your data remains yours, fully accessible even if you stop using Jotter.
- **Combat Task Flooding**: Built for dealing with hundreds of open tasks.
- **Flexible Views**: Organise tasks your way with Kanban columns, list view, a priority-based **Eisenhower Matrix**, and a chronological **Time View** grouping by due dates.
- **Smart Task Creation**: Create rich tasks quickly with keywords for tags, due dates or priorities in the task title.
- **Offline-First & Local Index**: Runs entirely on your computer with a lightning-fast local SQLite database index. If the database index is ever deleted, the system automatically rebuilds it instantly from your markdown files.
- **Selective Per-Project Git Sync**: Enable synchronization for individual projects by connecting them to different Git remotes. Keep "Home" local while sharing "Work" with a team.
- **Multi-Language Support**: Fully localized in English and German.

---

## 📦 Installation

Jotter is provided as a portable tool with two distinct versions. No dependencies required.

1. Download the package for your operating system from the [Latest Releases](https://github.com/simon123h/jotter/releases).
2. Extract the archive.
3. Choose your preferred way to run Jotter:
   - **Standalone Desktop App**: Double-click `jotter-desktop` (or `.exe` on Windows). This opens Jotter in its own dedicated window.
   - **Headless Server**: Run `jotter-server` from your terminal. This starts a web server (default: `http://localhost:58271`) that you can access with your preferred browser. (On Linux, double-clicking this binary will automatically open a terminal).

   **Example (Linux / macOS terminal):**

   ```bash
   chmod +x jotter-*
   ./jotter-desktop
   ```

Jotter automatically handles both portable and global configurations out of the box:

- **Portable Mode (Self-Contained)**: If a `tasks/` directory is present in the folder you execute Jotter from, tasks will default to `./tasks` and configurations to `./jotter.yaml` in that folder.
- **Global / Installed Mode**: Otherwise, Jotter uses standard OS-specific directories for both data and settings storage (such as XDG standard paths on Linux, AppData on Windows, and Application Support on macOS).
- **Auto-Config Generation**: If no configuration file exists at all on startup, Jotter will automatically create a default, annotated `jotter.yaml` template file for you at the default location.

For advanced customization and full directory details, please see [the user configuration documentation](docs/user/configuration.md).

---

## 📖 Documentation

For advanced setups, configuration options, and developer notes, please refer to the documents in the `docs/` folder:

- **Installation & Running**:
  - [Running Pre-compiled Binaries (Windows/Linux/macOS)](docs/installation/precompiled.md)
  - [Running from Source (For Developers)](docs/installation/development.md)
- **User Guide**:
  - [Configuring Jotter (Ports, Directories, logs)](docs/user/configuration.md)
- **Developer Reference**:
  - [Architectural Design](docs/developer/architecture.md)
  - [Contributing Guidelines](CONTRIBUTING.md)
