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

| Setting             | CLI Option               | Config File Key        | Env Variable       | Default Value                   | Description                                                                               |
| :------------------ | :----------------------- | :--------------------- | :----------------- | :------------------------------ | :---------------------------------------------------------------------------------------- |
| **Port**            | `--port <number>`        | `port: <number>`       | _N/A_              | `8000`                          | The network port the server listens on.                                                   |
| **Host**            | `--host <address>`       | `host: "<address>"`    | _N/A_              | `127.0.0.1`                     | The host IP address to bind to (e.g. `0.0.0.0` to allow local network access).            |
| **Data Directory**  | `--data-dir <path>`      | `data_dir: "<path>"`   | `JOTTER_DATA_DIR`  | `./tasks`                       | The folder where your markdown task files are stored. Supports `~` home folder expansion. |
| **Disable Browser** | `--no-browser`           | `no_browser: true`     | _N/A_              | `false`                         | If set, Jotter will not automatically open your web browser on startup.                   |
| **Log Level**       | `--log-level <level>`    | `log_level: "<level>"` | `JOTTER_LOG_LEVEL` | `info` (dev) / `warning` (prod) | Logging verbosity (`debug`, `info`, `warning`, `error`, `critical`).                      |
| **Config File**     | `--config <path>` / `-c` | _N/A_                  | _N/A_              | _See below_                     | Specifies a custom YAML or JSON configuration file path.                                  |

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
no_browser: true
log_level: "warning"
```

---

## Command Line Examples

- **Run on a custom port without auto-opening the browser:**

  ```bash
  ./jotter --port 8080 --no-browser
  ```

- **Store markdown task files in a custom directory:**

  ```bash
  ./jotter --data-dir ~/Documents/kanban-tasks
  ```

- **Use a specific config file in another location:**
  ```bash
  ./jotter --config /etc/jotter/config.yaml
  ```
