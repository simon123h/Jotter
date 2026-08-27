import sys
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from jotter.config import UserConfig
from jotter.features.buckets import router as buckets_router
from jotter.features.projects import router as projects_router
from jotter.features.settings import router as settings_router
from jotter.features.sync import SyncApplicationService
from jotter.features.sync import router as system_router
from jotter.features.tasks import router as tasks_router
from jotter.shared.db import get_db
from jotter.shared.exceptions import DomainException, EntityNotFoundError, ValidationError

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

    # Global Domain Exception Handlers
    @app.exception_handler(EntityNotFoundError)
    async def not_found_handler(request: Request, exc: EntityNotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(ValidationError)
    async def validation_handler(request: Request, exc: ValidationError):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(DomainException)
    async def domain_exception_handler(request: Request, exc: DomainException):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

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

    static_dir: Path | None = None
    for candidate in [pyinstaller_dist, pkg_dist, dev_dist]:
        if candidate and candidate.is_dir() and (candidate / "index.html").is_file():
            static_dir = candidate
            break

    if static_dir:
        # Mount assets
        assets_dir = static_dir / "assets"
        if assets_dir.is_dir():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

        # SPA fallback route
        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa(full_path: str):
            if full_path.startswith("api/"):
                return JSONResponse(status_code=404, content={"detail": "Not found"})
            file_path = static_dir / full_path
            if file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(static_dir / "index.html")

    return app
