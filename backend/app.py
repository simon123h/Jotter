from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from backend.config import UserConfig
from backend.db import get_db
from backend.routes.buckets import router as buckets_router
from backend.routes.projects import router as projects_router
from backend.routes.settings import router as settings_router
from backend.routes.system import router as system_router
from backend.routes.tasks import router as tasks_router
from backend.services.sync_service import sync_db_only


try:
    from backend._version import __version__ as app_version
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
    sync_db_only(config.data_dir)

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

    # Locate static frontend distribution (bundled package dist or local dev frontend/dist)
    pkg_dist = Path(__file__).resolve().parent / "dist"
    dev_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
    dist_dir = pkg_dist if (pkg_dist.is_dir() and (pkg_dist / "index.html").is_file()) else dev_dist

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
