# Jotter

<p align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/simon123h/jotter/ci.yml?branch=main&style=flat-square&label=build" alt="Build Status">
  <img src="https://img.shields.io/codecov/c/github/simon123h/jotter?style=flat-square&logo=codecov&label=coverage" alt="Coverage">
  <img src="https://img.shields.io/github/go-mod/go-version/simon123h/jotter?style=flat-square&logo=go&logoColor=white&color=00ADD8" alt="Go Version">
  <img src="https://img.shields.io/badge/Vue.js-3.5+-4FC08D?style=flat-square&logo=vue.js&logoColor=white" alt="Vue Version">
  <img src="https://img.shields.io/github/v/release/simon123h/jotter?style=flat-square&color=orange" alt="Latest Release">
  <img src="https://img.shields.io/github/license/simon123h/jotter?style=flat-square&color=blue" alt="License">
</p>

🚀 **Try the Online Demo**: [simon123h.github.io/Jotter](https://simon123h.github.io/Jotter/)

Jotter is a **local-first, privacy-focused task management application** designed to help you organize tasks without losing data ownership. Modeled as a Markdown Kanban board, Jotter helps combat "task flooding" through filtering, intuitive UI, all while keeping your data stored locally in simple, plain-text files on your own machine.

![Jotter Kanban Board Screenshot](docs/assets/screenshot.png)

---

## 🌟 Key Features

- **Data Ownership & Portability**: Tasks are stored as human-readable `.md` markdown files. Your data remains yours, fully accessible even if you stop using Jotter.
- **Combat Task Flooding**: Built for dealing with hundreds of open tasks.
- **Flexible Views**: Organise tasks your way with Kanban columns, list view, a priority-based **Eisenhower Matrix**, and a chronological **Time View** grouping by due dates.
- **Smart Task Creation**: Create rich tasks quickly with keywords for tags, due dates or priorities in the task title.
- **Offline-First & Local Index**: Runs entirely on your computer with a lightning-fast local SQLite database index. If the database index is ever deleted, the system automatically rebuilds it instantly from your markdown files.
- **Multi-Language Support**: Fully localized in English and German.

---

## ▶️ Installation

Jotter is provided as a portable tool with two distinct versions. No dependencies required.

1. Download the package for your operating system from the [Latest Releases](https://github.com/simon123h/jotter/releases).
2. Extract the archive.
3. Choose your preferred way to run Jotter:
   - **Standalone Desktop App**: Double-click `jotter-desktop` (or `.exe` on Windows). This opens Jotter in its own dedicated window.
   - **Headless Server**: Run `jotter-server` from your terminal. This starts a web server (default: `http://localhost:8000`) that you can access with your preferred browser.

   **Example (Linux / macOS terminal):**

   ```bash
   chmod +x jotter-*
   ./jotter-desktop
   ```

You may customize the configuration e.g. by placing a `jotter.yaml` next to the binary:

```yaml
# customize the port
port: 9000
# customize the user data directory
data_dir: "~/Documents/my-jotter-data"
```

For more options, please see [the user documentation](docs/user/configuration.md).

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
