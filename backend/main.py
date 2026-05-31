from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from database import init_db
from routers.buckets import router as buckets_router
from routers.system import router as system_router
from routers.tasks import router as tasks_router
from storage import sync_db_with_files


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and populate from Markdown files if DB is empty
    init_db()

    # Sync database with existing markdown files automatically on startup
    sync_db_with_files()
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


@app.get("/", include_in_schema=False)
def root():
    """Redirect to OpenAPI documentation (Swagger UI)."""
    return RedirectResponse(url="/docs")


# Include routers
app.include_router(tasks_router)
app.include_router(buckets_router)
app.include_router(system_router)
