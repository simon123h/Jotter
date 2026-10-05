import logging
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from jotter.config import UserConfig, load_config
from jotter.features.buckets import router as buckets_router
from jotter.features.canvas.router import router as canvas_router
from jotter.features.projects import router as projects_router
from jotter.features.settings import router as settings_router
from jotter.features.sync import SyncApplicationService, VaultSyncScheduler
from jotter.features.sync import router as system_router
from jotter.features.tasks import router as tasks_router
from jotter.features.timeblock.router import router as timeblock_router
from jotter.features.vaults import router as vaults_router
from jotter.shared.db import create_sqlite_connection
from jotter.shared.exceptions import DomainException, EntityNotFoundError, ValidationError

try:
    from jotter._version import __version__ as app_version
except ImportError:
    app_version = "3.0.0b1"

logger = logging.getLogger(__name__)

# Requests slower than this are logged, to diagnose environments with slow file access (e.g. antivirus on Windows)
SLOW_REQUEST_SECONDS = 0.5


def create_app(
    config: UserConfig | None = None,
    version: str = app_version,
    enable_background_sync: bool = True,
) -> FastAPI:
    cfg = config or load_config()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        scheduler = None
        if enable_background_sync:
            scheduler = VaultSyncScheduler(app.state.config.data_dir)
            scheduler.start()
            app.state.sync_scheduler = scheduler
        try:
            yield
        finally:
            if scheduler:
                scheduler.stop()

    app = FastAPI(
        title="Jotter API",
        version=version,
        description="Local-first Markdown Kanban Board backend API (Python)",
        lifespan=lifespan,
    )
    app.state.config = cfg
    app.state.version = version

    from jotter.features.vaults.registry import VaultRegistry

    vault_registry = VaultRegistry(
        config_file=cfg.vaults_config_path,
        default_data_dir=cfg.data_dir,
    )
    app.state.vault_registry = vault_registry
    active_vault = vault_registry.get_active()
    cfg.data_dir = active_vault.path

    # Setup database connection on app state
    db_path = str(Path(cfg.data_dir) / "tasks.db")
    app.state.db_path = db_path
    conn = create_sqlite_connection(db_path)
    app.state.db = conn

    # Initial DB sync from disk
    SyncApplicationService.from_data_dir(cfg.data_dir, conn).sync_on_startup()

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

    # Any successful data-changing API call marks the vault dirty, so the next periodic cycle commits it
    @app.middleware("http")
    async def mark_vault_dirty_on_change(request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - started
        if elapsed > SLOW_REQUEST_SECONDS:
            logger.warning("Slow request: %s %s took %.2fs", request.method, request.url.path, elapsed)
        path = request.url.path
        if (
            request.method in ("POST", "PUT", "PATCH", "DELETE")
            and path.startswith("/api/")
            and not path.startswith("/api/system/git")
            and response.status_code < 400
        ):
            scheduler = getattr(request.app.state, "sync_scheduler", None)
            if scheduler is not None:
                scheduler.mark_dirty()
        return response

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
    app.include_router(timeblock_router)
    app.include_router(canvas_router)
    app.include_router(vaults_router)

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
