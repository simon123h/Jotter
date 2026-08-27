import argparse
import os
import threading
import webbrowser

import uvicorn

from jotter.app import app_version, create_app
from jotter.config import load_config, normalize_log_level


def open_browser_delayed(url: str, delay_seconds: float = 0.5):
    def _open():
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Timer(delay_seconds, _open).start()


def main():
    parser = argparse.ArgumentParser(description="Jotter - Local-First Markdown Kanban Board")
    parser.add_argument(
        "-v",
        "--version",
        action="version",
        version=f"Jotter {app_version}",
        help="Show Jotter version and exit",
    )
    parser.add_argument("--host", type=str, default=None, help="Host address to bind to")
    parser.add_argument("--port", type=int, default=None, help="Port to listen on")
    parser.add_argument("--data-dir", type=str, default=None, help="Directory to store markdown tasks and database")
    parser.add_argument("--log-level", type=str, default=None, help="Logging level (DEBUG, INFO, WARNING, ERROR)")
    parser.add_argument(
        "--no-browser",
        action="store_true",
        default=False,
        help="Do not automatically open the default web browser on launch",
    )
    parser.add_argument(
        "--open-browser",
        action="store_true",
        default=False,
        help="Force opening the default web browser on launch",
    )
    parser.add_argument(
        "--no-color",
        "--no-colors",
        dest="no_color",
        action="store_true",
        default=False,
        help="Disable ANSI colored output in terminal logs (useful on legacy Windows terminals)",
    )
    parser.add_argument(
        "--use-colors",
        dest="use_colors",
        action="store_true",
        default=None,
        help="Force ANSI colored output in terminal logs",
    )
    args = parser.parse_args()

    config = load_config()
    if args.host:
        config.host = args.host
    if args.port:
        config.port = args.port
    if args.data_dir:
        config.data_dir = args.data_dir
    if args.log_level:
        config.log_level = normalize_log_level(args.log_level)
    if args.no_color:
        config.use_colors = False
    elif args.use_colors is not None:
        config.use_colors = args.use_colors

    # Determine browser launch behavior
    if args.no_browser or os.environ.get("JOTTER_NO_BROWSER") in ("1", "true", "yes"):
        config.open_browser = False
    elif args.open_browser:
        config.open_browser = True

    display_host = "127.0.0.1" if config.host in ("0.0.0.0", "::") else config.host
    server_url = f"http://{display_host}:{config.port}"

    print(f"Starting Jotter server on {server_url}")
    print(f"Data Directory: {config.data_dir}")

    if config.open_browser:
        open_browser_delayed(server_url)

    access_log = config.log_level.lower() == "debug"

    app = create_app(config)
    uvicorn.run(
        app,
        host=config.host,
        port=config.port,
        log_level=config.log_level.lower(),
        access_log=access_log,
        use_colors=config.use_colors,
    )


if __name__ == "__main__":
    main()
