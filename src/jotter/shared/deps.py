"""FastAPI lightweight dependencies."""

from fastapi import Request


def get_data_dir(request: Request) -> str:
    """Extracts data_dir from FastAPI app state configuration."""
    return request.app.state.config.data_dir
