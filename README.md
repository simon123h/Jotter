# Jotter

[![CI Pipeline](https://github.com/simon123h/jotter/actions/workflows/ci.yml/badge.svg)](https://github.com/simon123h/jotter/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/simon123h/jotter/graph/badge.svg?token=ZLMIMRRLEF)](https://codecov.io/gh/simon123h/jotter)

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

Jotter is compiled as a portable binary, available for Windows, MacOS and Linux. No dependencies required.

1. Download the package for your operating system from the [Latest Releases](https://github.com/simon123h/jotter/releases).
2. Extract the archive.
3. Launch the app:
   - **Windows**: Double-click `jotter.exe`
   - **macOS / Linux**: Open a terminal in the folder and run:

     ```bash
     chmod +x jotter && ./jotter
     ```

4. The application will start and **automatically open in your default browser** (usually at `http://127.0.0.1:8000`).

You may customize the configuration e.g. by placing a `jotter.yaml` next to the binary:

```yaml
# customize the port
port: 9000
# customize the user data directory
data_dir: "~/Documents/my-jotter-data"
```

For more options, please see [the user documentation](docs/user/configuration.md).

---

## 📖 Documentation Index

For advanced setups, configuration options, and developer notes, please refer to the documents in the `docs/` folder:

- **Installation & Running**:
  - [Running Pre-compiled Binaries (Windows/Linux/macOS)](docs/installation/precompiled.md)
  - [Running from Source (For Developers)](docs/installation/development.md)
- **User Guide**:
  - [Configuring Jotter (Ports, Directories, logs)](docs/user/configuration.md)
- **Developer Reference**:
  - [Architectural Design: The Ephemeral Index (arc42)](docs/developer/architecture.md)
  - [Contributing Guidelines](CONTRIBUTING.md)
