import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from jotter.config import UserConfig
from jotter.features.buckets import router as buckets_router
from jotter.features.projects import router as projects_router
from jotter.features.settings import router as settings_router
from jotter.features.sync import SyncApplicationService
from jotter.features.sync import router as system_router
from jotter.features.tasks import router as tasks_router
from jotter.shared.db import get_db

try:
    from jotter._version import __version__ as app_version
except ImportError:
    app_version = "3.0.0b1"


def create_app(config: UserConfig, version: str = app_version) -> FastAPI:
    app = FastAPI(
        title="Jotter API",
        version=version,
        description="Local-first Markdown Kanban Board backend API (Python)",
    )
    app.state.config = config
    app.state.version = version

    # Setup database
    db_path = str(Path(config.data_dir) / "tasks.db")
    get_db(db_path)

    # Initial DB sync from disk
    SyncApplicationService(config.data_dir).sync_db_only()

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API Routers
    app.include_router(projects_router)
    app.include_router(buckets_router)
    app.include_router(tasks_router)
    app.include_router(settings_router)
    app.include_router(system_router)

    # Locate static frontend distribution (PyInstaller MEIPASS, bundled package dist, or local dev frontend/dist)
    meipass = getattr(sys, "_MEIPASS", None)
    pyinstaller_dist = (Path(meipass) / "jotter" / "dist") if meipass else None
    pkg_dist = Path(__file__).resolve().parent / "dist"
    dev_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

    if pyinstaller_dist and pyinstaller_dist.is_dir() and (pyinstaller_dist / "index.html").is_file():
        dist_dir = pyinstaller_dist
    elif pkg_dist.is_dir() and (pkg_dist / "index.html").is_file():
        dist_dir = pkg_dist
    else:
        dist_dir = dev_dist

    if dist_dir.is_dir() and (dist_dir / "index.html").is_file():
        # Mount assets folder
        assets_dir = dist_dir / "assets"
        if assets_dir.is_dir():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

        # Catch-all route to serve index.html for SPA routing
        @app.get("/{full_path:path}", include_in_schema=False)
        def serve_spa(full_path: str):
            target = dist_dir / full_path
            if target.is_file():
                return FileResponse(target)
            return FileResponse(dist_dir / "index.html")

    return app
