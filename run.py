import sys
import os
import argparse
import webbrowser
from threading import Timer
from pathlib import Path
import yaml

# Add backend directory to sys.path so backend imports work
if getattr(sys, "frozen", False):
    backend_dir = Path(sys._MEIPASS) / "backend"
else:
    backend_dir = Path(__file__).resolve().parent / "backend"

sys.path.insert(0, str(backend_dir))

# FastAPI app and uvicorn are imported inside main() to ensure configuration env vars are set first

ASCII_LOGO = r"""
   ___       _   _            
  |_  |     | | | |           
    | | ___ | |_| |_ ___ _ __ 
    | |/ _ \| __| __/ _ \ '__|
/\__/ / (_) | |_| ||  __/ |   
\____/ \___/ \__|\__\___|_|   
                              
"""


def open_browser(host: str, port: int):
    url = f"http://localhost:{port}" if host == "127.0.0.1" else f"http://{host}:{port}"
    webbrowser.open(url)


def load_config(config_path: str) -> dict:
    """Loads configuration settings from a YAML or JSON file."""
    if not os.path.exists(config_path):
        return {}
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            if isinstance(data, dict):
                return data
    except Exception as e:
        print(
            f"Warning: Failed to load configuration file '{config_path}': {e}",
            file=sys.stderr,
        )
    return {}


def main():
    parser = argparse.ArgumentParser(
        description="Jotter - Local-first Markdown Kanban Board"
    )
    parser.add_argument(
        "--config",
        "-c",
        type=str,
        default=None,
        help="Path to YAML/JSON configuration file",
    )
    parser.add_argument(
        "--port", type=int, default=None, help="Port to run the server on"
    )
    parser.add_argument(
        "--host", type=str, default=None, help="Host address to bind to"
    )
    parser.add_argument(
        "--data-dir", type=str, default=None, help="Directory to store markdown tasks"
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        default=None,
        help="Do not open the web browser automatically",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default=None,
        choices=["debug", "info", "warning", "error", "critical"],
        help="Set the logging level",
    )

    args = parser.parse_args()

    # Determine which config file to load
    config_file = args.config
    if not config_file:
        # Check default files in the current working directory
        for default_name in ("jotter.yaml", "jotter.yml", "jotter.json"):
            if os.path.exists(default_name):
                config_file = default_name
                break

    config = {}
    if config_file:
        config = load_config(config_file)
        print(f"Loaded configuration from '{config_file}'")

    # Resolve settings with precedence: CLI Arguments > Config File > Defaults
    port = args.port
    if port is None:
        port = config.get("port")
    if port is None:
        port = 8000

    host = args.host
    if host is None:
        host = config.get("host")
    if host is None:
        host = "127.0.0.1"

    data_dir = args.data_dir
    if data_dir is None:
        data_dir = config.get("data_dir") or config.get("data-dir")

    no_browser = args.no_browser
    if no_browser is None:
        no_browser = config.get("no_browser") or config.get("no-browser")
    if no_browser is None:
        no_browser = False

    log_level = args.log_level
    if log_level is None:
        log_level = config.get("log_level") or config.get("log-level")
    if log_level is None:
        log_level = "warning" if getattr(sys, "frozen", False) else "info"

    # Set data dir env var if resolved
    if data_dir:
        os.environ["JOTTER_DATA_DIR"] = os.path.abspath(os.path.expanduser(data_dir))

    # Set log level env var for the backend
    os.environ["JOTTER_LOG_LEVEL"] = log_level.upper()

    # Print ASCII Art logo and basic startup info
    print(ASCII_LOGO)
    print("Jotter - Local-first Markdown Kanban Board")
    print("==========================================")
    print(f"Starting Jotter on http://{host}:{port}")

    # Start browser in a background thread after a short delay
    if not no_browser:
        Timer(1.5, open_browser, args=[host, port]).start()

    # Run uvicorn server
    from main import app
    import uvicorn

    uvicorn.run(app, host=host, port=port, log_level=log_level.lower())


if __name__ == "__main__":
    main()
