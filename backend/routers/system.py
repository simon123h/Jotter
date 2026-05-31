from fastapi import APIRouter, HTTPException, status

from storage import sync_db_with_files

router = APIRouter(tags=["System"])


@router.post(
    "/system/sync",
    summary="Sync database index",
    description=(
        "Empty the SQLite index tables and re-scan the entire tasks directory, importing YAML "
        "frontmatter data from all markdown files back into the SQLite database. Acts as a fail-safe."
    ),
)
def sync_system():
    try:
        count = sync_db_with_files()
        return {"status": "success", "synchronized_tasks": count}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Synchronization failed: {str(e)}",
        ) from e
