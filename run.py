import sys
import os
import argparse
import webbrowser
from threading import Timer
from pathlib import Path

# Add backend directory to sys.path so backend imports work
if getattr(sys, "frozen", False):
    backend_dir = Path(sys._MEIPASS) / "backend"
else:
    backend_dir = Path(__file__).resolve().parent / "backend"

sys.path.insert(0, str(backend_dir))

# Now we can import the FastAPI app
from main import app
import uvicorn

def open_browser(host: str, port: int):
    url = f"http://localhost:{port}" if host == "127.0.0.1" else f"http://{host}:{port}"
    webbrowser.open(url)

def main():
    parser = argparse.ArgumentParser(description="Jotter - Local-first Markdown Kanban Board")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the server on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host address to bind to")
    parser.add_argument("--data-dir", type=str, default=None, help="Directory to store markdown tasks (defaults to './tasks' in current directory)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open the web browser automatically")

    args = parser.parse_args()

    # Set data dir env var if provided
    if args.data_dir:
        os.environ["JOTTER_DATA_DIR"] = os.path.abspath(args.data_dir)

    print(f"Starting Jotter on http://{args.host}:{args.port}")
    
    # Start browser in a background thread after a short delay
    if not args.no_browser:
        Timer(1.5, open_browser, args=[args.host, args.port]).start()

    # Run uvicorn server
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")

if __name__ == "__main__":
    main()
