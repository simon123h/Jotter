# Configuring Jotter

You can customize how Jotter operates (such as altering the network port or changing where your task files are stored) using command-line arguments, environment variables, or a configuration file.

---

## Configuration Properties

| Setting            | CLI Option               | Config File Key        | Env Variable       | Default Value                   | Description                                                                                                   |
| :----------------- | :----------------------- | :--------------------- | :----------------- | :------------------------------ | :------------------------------------------------------------------------------------------------------------ |
| **Port**           | `--port <number>`        | `port: <number>`       | _N/A_              | `58271`                         | The network port the server listens on.                                                                       |
| **Host**           | `--host <address>`       | `host: "<address>"`    | _N/A_              | `127.0.0.1`                     | The host IP address to bind to (e.g. `0.0.0.0` to allow local network access).                                |
| **Data Directory** | `--data-dir <path>`      | `data_dir: "<path>"`   | `JOTTER_DATA_DIR`  | _See Storage Locations_         | Initial vault folder, used only to seed the first vault (see below). Supports `~` home folder expansion.      |
| **Log Directory**  | _N/A_                    | `log_dir: "<path>"`    | `JOTTER_LOG_DIR`   | _See Storage Locations_         | The directory where Jotter saves its `jotter.log` file. Separated from notes to avoid Git tracking conflicts. |
| **Log Level**      | `--log-level <level>`    | `log_level: "<level>"` | `JOTTER_LOG_LEVEL` | `info` (dev) / `warning` (prod) | Logging verbosity (`debug`, `info`, `warning`, `error`, `critical`).                                          |
| **Log Colors**     | `--no-color`             | `use_colors: false`    | `NO_COLOR` / `JOTTER_USE_COLORS` | `true` (auto)                   | Toggle ANSI colored terminal log output. Useful if legacy Windows terminals show escape codes (`[32m`).       |
| **Config File**    | `--config <path>` / `-c` | _N/A_                  | _N/A_              | _See Storage Locations_         | Specifies a custom YAML or JSON configuration file path. Automatically created if missing.                    |

---

## Storage Locations (Portable Mode vs. Standard Directories)

Jotter is extremely flexible and can be run as a completely self-contained **Portable App** or installed globally as a standard system application.

### 1. Portable Mode (Self-Contained)

> **Note:** The data directory setting only seeds the first vault. Once `vaults.json` exists in the config folder, the active vault's folder is used and `data_dir` is ignored. Manage folders via the vault manager in the sidebar (gear icon next to the vault switcher).

If a folder named `tasks/` is present in the Current Working Directory (CWD) where Jotter is started:

- **Data Directory** defaults to `./tasks` (the existing folder in the CWD).
- **Configuration File** search defaults to `./jotter.yaml` (or `./jotter.yml`/`./jotter.json`) in the CWD.
- **Log Directory** defaults to the standard OS cache/logs path (described below) to prevent writing log files directly into your local notes folder.

This is ideal for running Jotter from external flash drives or local project folders without leaving traces elsewhere on the system.

### 2. Standard Global Mode

If no local `tasks` directory is found in the CWD, Jotter defaults to OS-specific standard paths:

| Operating System | Default Data Directory                 | Default Configuration File                         | Default Log Directory   |
| :--------------- | :------------------------------------- | :------------------------------------------------- | :---------------------- |
| **Linux**        | `~/.local/share/jotter`                | `~/.config/jotter/jotter.yaml`                     | `~/.cache/jotter`       |
| **macOS**        | `~/Library/Application Support/Jotter` | `~/Library/Application Support/jotter/jotter.yaml` | `~/Library/Logs/Jotter` |
| **Windows**      | `%APPDATA%\Jotter`                     | `%APPDATA%\jotter\jotter.yaml`                     | `%LocalAppData%\Jotter` |

---

## Logging & Dual-Writer

Jotter employs a **Dual-Writer Logging** mechanism. This means that all log statements (starting up information, synchronization reports, git activities, and system errors) are output to both standard output (`stdout`) and appended to a persistent local log file named `jotter.log`.

This file is isolated from your markdown data directory so that it is never tracked by Jotter's Git auto-commits.

### Log Rotation

To protect local disk space, Jotter automatically limits the size of the `jotter.log` file. On startup, if the file exceeds **5 MB**, it is automatically removed and a clean log file is created.

---

## Automatic Configuration Creation

To make initial setups completely effortless, **if no configuration file exists at all**, Jotter will automatically create a default, annotated configuration file in its default location (the `Default Configuration File` path above, or local `./jotter.yaml` if in Portable Mode).

The created file contains template parameters that are commented out, serving as a ready-to-use template for your customizations:

```yaml
# Jotter Configuration File
# data_dir: ""
# log_dir: ""
# host: "127.0.0.1"
# port: 58271
# log_level: "INFO"
```

---

## Configuration Priority Order

Jotter resolves settings using the following priority (highest overrides lowest):

1. **Command Line Arguments** (e.g. `--port 9000`)
2. **Environment Variables** (e.g. `JOTTER_DATA_DIR`)
3. **Loaded Configuration File** (`jotter.yaml`/`jotter.yml`/`jotter.json`)
4. **Default Paths** (Portable fallback if local `tasks` exists, otherwise OS standard directories)

---

## Command Line Examples

- **Run on a custom port:**

  ```bash
  ./jotter-server --port 8080
  ```

- **Store markdown task files in a custom directory:**

  ```bash
  ./jotter-server --data-dir ~/Documents/kanban-tasks
  ```

- **Use a specific config file in another location:**
  ```bash
  ./jotter-server --config /etc/jotter/config.yaml
  ```

---

## Git Versioning

If your vault folder is a Git repository, Jotter commits local changes to it whenever you click the **Commit** button in the sidebar footer (or periodically, via **Settings → Git Versioning → Auto-Commit Interval**). These commits power the Time Machine.

Jotter only ever commits locally. It creates a repository only when you click **Enable Git**, and it never pushes or pulls. See [Git Versioning and Time Machine](./git-sync.md) for details and for how to sync a vault across devices.
