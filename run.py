import sys
from pathlib import Path

"""
Jotter - Local-First Markdown Kanban Board
Top-level entry point to run the Python backend.
"""

# Ensure local jotter package in ./src is prioritized over any globally installed package
src_dir = Path(__file__).resolve().parent / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from jotter.main import main

if __name__ == "__main__":
    main()
