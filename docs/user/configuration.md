# Configuring Jotter

You can customize how Jotter operates (such as altering the network port or changing where your task files are stored) using command-line arguments, environment variables, or a configuration file.

## Settings Precedence

Jotter resolves settings using the following priority (highest overrides lowest):

1. **Command Line Arguments**
2. **Environment Variables**
3. **Configuration File** (`jotter.yaml`/`jotter.yml`/`jotter.json`)
4. **Default Settings**

---

## Configuration Properties

| Setting            | CLI Option               | Config File Key        | Env Variable       | Default Value                   | Description                                                                               |
| :----------------- | :----------------------- | :--------------------- | :----------------- | :------------------------------ | :---------------------------------------------------------------------------------------- |
| **Port**           | `--port <number>`        | `port: <number>`       | _N/A_              | `58271`                          | The network port the server listens on.                                                   |
| **Host**           | `--host <address>`       | `host: "<address>"`    | _N/A_              | `127.0.0.1`                     | The host IP address to bind to (e.g. `0.0.0.0` to allow local network access).            |
| **Data Directory** | `--data-dir <path>`      | `data_dir: "<path>"`   | `JOTTER_DATA_DIR`  | `./tasks`                       | The folder where your markdown task files are stored. Supports `~` home folder expansion. |
| **Log Level**      | `--log-level <level>`    | `log_level: "<level>"` | `JOTTER_LOG_LEVEL` | `info` (dev) / `warning` (prod) | Logging verbosity (`debug`, `info`, `warning`, `error`, `critical`).                      |
| **Config File**    | `--config <path>` / `-c` | _N/A_                  | _N/A_              | _See below_                     | Specifies a custom YAML or JSON configuration file path.                                  |

---

## Using a Configuration File

By default, Jotter looks in the folder it is executed from for a file named:

- `jotter.yaml`
- `jotter.yml`
- `jotter.json`

If found, it will automatically apply the settings from it.

### Example `jotter.yaml`

```yaml
port: 9000
host: "127.0.0.1"
data_dir: "~/Documents/my-kanban-board"
log_level: "warning"
```

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
