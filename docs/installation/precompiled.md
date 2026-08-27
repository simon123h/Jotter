# Installation & Quick Start

Jotter is a lightweight, local-first web application powered by Python (FastAPI) and a Vue 3 frontend.

## Requirements

- **Python 3.10+** and **pip**
- Any modern web browser (Chrome, Firefox, Safari, Edge)

---

## Option 1: Quick Start with `pipx` (Recommended for Python users)

Run Jotter instantly via PyPI without cloning or manual virtual environment management:

```bash
pipx run jotter-app
```

Or install it in an isolated global environment:
```bash
pipx install jotter-app
jotter
```

---

## Option 2: Standalone Executable Binary (Zero Python Required)

If you don't have Python installed, you can download a pre-built standalone executable (`jotter-server`) from the [GitHub Releases](https://github.com/simon123h/jotter/releases) page:

- **Windows**: Download `jotter-server-windows-amd64.zip`, extract, and double-click `jotter-server.exe`.
- **Linux**: Download `jotter-server-linux-amd64.tar.gz`, extract, and run `./jotter-server`.
- **macOS**: Download `jotter-server-darwin-amd64.tar.gz`, extract, and run `./jotter-server`.

Your default web browser will automatically open to `http://localhost:58271`. Pass `--no-browser` if running on a headless server.

---

## Offline Installation (`.whl`)

If you are on an air-gapped machine without internet access, you can download the release wheel (`jotter_app-*.whl`) from the [GitHub Releases](https://github.com/simon123h/jotter/releases) page and install it directly:

```bash
pip install ./jotter_app-3.0.0-py3-none-any.whl
jotter
```

---

## Running from Source

1. Clone or download the repository:
   ```bash
   git clone https://github.com/simon123h/jotter.git
   cd jotter
   ```

2. Install dependencies:
   ```bash
   pip install -e .
   ```

3. Launch the server:
   ```bash
   jotter
   # or: python3 run.py
   ```

4. Open your browser at **`http://localhost:58271`**.

---

## Configuration Modes

Jotter automatically handles both portable and global storage locations:

- **Portable Mode (Self-Contained)**: If a `tasks/` directory exists in the folder you execute Jotter from, tasks will default to `./tasks` and configurations to `./jotter.yaml` in that folder.
- **Global / Installed Mode**: Otherwise, Jotter uses standard OS-specific directories for both data and settings storage (XDG standard paths on Linux, AppData on Windows, and Application Support on macOS).
- **Auto-Config Generation**: If no configuration file exists at all on startup, Jotter will automatically create a default, annotated `jotter.yaml` template file for you at the default location.

For complete configuration options, see the [Configuration Guide](/user/configuration).
