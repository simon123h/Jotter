import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from config import IS_PRODUCTION, get_log_level
from database import init_db
from routers.buckets import router as buckets_router
from routers.projects import router as projects_router
from routers.system import router as system_router
from routers.tasks import router as tasks_router
from storage import sync_db_with_files

# Configure logging using environment variable or config file
log_level_env = get_log_level()
logging.basicConfig(
    level=getattr(logging, log_level_env, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("jotter")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from database import DB_PATH
    from storage import TASKS_DIR

    logger.info(f"Using database file: {DB_PATH}")
    logger.info(f"Using tasks markdown directory: {TASKS_DIR}")

    # Initialize SQLite database and populate from Markdown files if DB is empty
    logger.info("Initializing database schema...")
    init_db()

    # Sync database with existing markdown files automatically on startup
    logger.info("Synchronizing database with markdown files...")
    count = sync_db_with_files()
    logger.info(f"Database synchronization complete. Indexed {count} tasks.")
    yield


app = FastAPI(
    title="Jotter API",
    description="Backend REST API for Jotter - a local-first markdown Kanban board with an ephemeral SQLite database index.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(projects_router)
app.include_router(tasks_router)
app.include_router(buckets_router)
app.include_router(system_router)


def get_frontend_dist_dir() -> Path:
    if IS_PRODUCTION and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS) / "frontend" / "dist"
    return Path(__file__).resolve().parent.parent / "frontend" / "dist"


frontend_dist = get_frontend_dist_dir()

if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
else:

    @app.get("/", include_in_schema=False)
    def root():
        """Redirect to OpenAPI documentation (Swagger UI)."""
        return RedirectResponse(url="/docs")
