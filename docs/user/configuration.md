# Configuring Jotter

You can customize how Jotter operates (such as altering the network port or changing where your task files are stored) using command-line arguments, environment variables, or a configuration file.

---

## Configuration Properties

| Setting            | CLI Option               | Config File Key        | Env Variable       | Default Value                   | Description                                                                                |
| :----------------- | :----------------------- | :--------------------- | :----------------- | :------------------------------ | :----------------------------------------------------------------------------------------- |
| **Port**           | `--port <number>`        | `port: <number>`       | _N/A_              | `58271`                         | The network port the server listens on.                                                    |
| **Host**           | `--host <address>`       | `host: "<address>"`    | _N/A_              | `127.0.0.1`                     | The host IP address to bind to (e.g. `0.0.0.0` to allow local network access).             |
| **Data Directory** | `--data-dir <path>`      | `data_dir: "<path>"`   | `JOTTER_DATA_DIR`  | _See Storage Locations_         | The folder where your markdown task files are stored. Supports `~` home folder expansion.  |
| **Log Level**      | `--log-level <level>`    | `log_level: "<level>"` | `JOTTER_LOG_LEVEL` | `info` (dev) / `warning` (prod) | Logging verbosity (`debug`, `info`, `warning`, `error`, `critical`).                       |
| **Config File**    | `--config <path>` / `-c` | _N/A_                  | _N/A_              | _See Storage Locations_         | Specifies a custom YAML or JSON configuration file path. Automatically created if missing. |

---

## Storage Locations (Portable Mode vs. Standard Directories)

Jotter is extremely flexible and can be run as a completely self-contained **Portable App** or installed globally as a standard system application.

### 1. Portable Mode (Self-Contained)

If a folder named `tasks/` is present in the Current Working Directory (CWD) where Jotter is started:

- **Data Directory** defaults to `./tasks` (the existing folder in the CWD).
- **Configuration File** search defaults to `./jotter.yaml` (or `./jotter.yml`/`./jotter.json`) in the CWD.

This is ideal for running Jotter from external flash drives or local project folders without leaving traces elsewhere on the system.

### 2. Standard Global Mode

If no local `tasks` directory is found in the CWD, Jotter defaults to OS-specific standard paths:

| Operating System | Default Data Directory                 | Default Configuration File                         |
| :--------------- | :------------------------------------- | :------------------------------------------------- |
| **Linux**        | `~/.local/share/jotter`                | `~/.config/jotter/jotter.yaml`                     |
| **macOS**        | `~/Library/Application Support/Jotter` | `~/Library/Application Support/jotter/jotter.yaml` |
| **Windows**      | `%APPDATA%\Jotter`                     | `%APPDATA%\jotter\jotter.yaml`                     |

---

## Automatic Configuration Creation

To make initial setups completely effortless, **if no configuration file exists at all**, Jotter will automatically create a default, annotated configuration file in its default location (the `Default Configuration File` path above, or local `./jotter.yaml` if in Portable Mode).

The created file contains template parameters that are commented out, serving as a ready-to-use template for your customizations:

```yaml
# Jotter Configuration File
# data_dir: ""
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

## Git Synchronization

Jotter supports built-in Git synchronization on a **per-project basis**. This allows you to keep some projects private (local-only) while sharing others via different Git remotes (GitHub, GitLab, etc.).

### How to enable:

1. Open the **Project Settings** by clicking the edit icon next to a project in the sidebar.
2. Enter your **Git Remote URL** (e.g., `https://github.com/user/repo.git`) in the provided field and click **Save**.
3. A Git icon will appear next to the project title in the sidebar, indicating it is now backed by Git.
4. Ensure your Git credentials are cached (using an SSH agent or a credential helper), as Jotter runs Git commands in the background.

### Sync Behavior:

When you click the **Sync** button in the sidebar footer, Jotter iterates through all projects with a configured remote:

- **Auto-Initialization**: If the project folder is not yet a Git repository, Jotter will automatically run `git init` and connect the remote.
- **Commit**: Local changes in that specific project are committed with a timestamp.
- **Merge**: Jotter fetches and merges remote changes. If a **merge conflict** occurs, Jotter will abort the merge to protect your files and log an error to the terminal.
- **Push**: Successful merges are pushed back to the remote.
- **Database Update**: The internal search index is refreshed for all projects.
