import argparse
import sys
import uvicorn
from backend.app import create_app
from backend.config import load_config


def main():
    parser = argparse.ArgumentParser(description="Jotter - Local-First Markdown Kanban Board")
    parser.add_argument("--host", type=str, default=None, help="Host address to bind to")
    parser.add_argument("--port", type=int, default=None, help="Port to listen on")
    parser.add_argument("--data-dir", type=str, default=None, help="Directory to store markdown tasks and database")
    parser.add_argument("--log-level", type=str, default=None, help="Logging level (DEBUG, INFO, WARNING, ERROR)")
    args = parser.parse_args()

    config = load_config()
    if args.host:
        config.host = args.host
    if args.port:
        config.port = args.port
    if args.data_dir:
        config.data_dir = args.data_dir
    if args.log_level:
        config.log_level = args.log_level

    print(f"Starting Jotter server on http://{config.host}:{config.port}")
    print(f"Data Directory: {config.data_dir}")

    app = create_app(config)
    uvicorn.run(
        app,
        host=config.host,
        port=config.port,
        log_level=config.log_level.lower(),
    )


if __name__ == "__main__":
    main()
