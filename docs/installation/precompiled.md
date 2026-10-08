# Installation & Quick Start

Jotter is a lightweight, local-first web application powered by Python (FastAPI) and a Vue 3 frontend.

## Requirements

- **Python 3.12+** and **pip**
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

## Option 2: Android Mobile App (.apk)

Jotter is available as a standalone, offline Android application:

1. Download `jotter-*-android.apk` from the latest [GitHub Releases](https://github.com/simon123h/jotter/releases).
2. Open the file on your Android device to install it.
3. The app creates a local vault at `Documents/Jotter` containing standard `.md` files. You can synchronize this directory across your devices using **Syncthing**, **Git**, or your preferred cloud folder sync tool.

---

## Offline Python Installation (`.whl`)

If you are on an air-gapped machine without internet access, you can download the release wheel (`jotter_app-*.whl`) from the [GitHub Releases](https://github.com/simon123h/jotter/releases) page and install it directly:

```bash
pip install ./jotter_app-3.0.0-py3-none-any.whl
jotter
```

---

## Optional: MCP Server for AI Assistants

`jotter mcp` starts a [Model Context Protocol](https://modelcontextprotocol.io) server so AI assistants can work with your board. It needs the optional `mcp` Python package, which is **not** installed by default. Install Jotter with the `mcp` extra:

```bash
pipx install 'jotter-app[mcp]'      # or add it to an existing install: pipx inject jotter-app mcp
pip install 'jotter-app[mcp]'
uvx --from 'jotter-app[mcp]' jotter mcp
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

Jotter stores its configuration and default vault as follows:

- **Config and default vault**: Jotter uses standard OS-specific directories (XDG standard paths on Linux, AppData on Windows, Application Support on macOS). A `./jotter.yaml` in the folder you start Jotter from takes precedence over the global one.
- **Auto-Config Generation**: If no configuration file exists at all on startup, Jotter will automatically create a default, annotated `jotter.yaml` template file for you at the default location.

For complete configuration options, see the [Configuration Guide](/user/configuration).
