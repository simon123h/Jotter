"""FastAPI schemas for JSON Canvas documents (Obsidian Canvas format)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CanvasGenericNode(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    type: Literal["text", "file", "link", "group"]
    x: float
    y: float
    width: float
    height: float
    color: str | None = None
    # For 'text' nodes: markdown text
    text: str | None = None
    # For 'file' nodes: relative file path (e.g. "01ARZ3NDEKTSV4RRFFQ69G5FAV.md")
    file: str | None = None
    # For 'link' nodes: URL
    url: str | None = None
    # For 'group' nodes: label/title and optional background
    label: str | None = None
    background: str | None = None
    backgroundStyle: str | None = None


class CanvasEdge(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    fromNode: str
    fromSide: Literal["top", "right", "bottom", "left"] = "right"
    fromEnd: Literal["none", "arrow"] = "none"
    toNode: str
    toSide: Literal["top", "right", "bottom", "left"] = "left"
    toEnd: Literal["none", "arrow"] = "arrow"
    color: str | None = None
    label: str | None = None


class CanvasDocument(BaseModel):
    model_config = ConfigDict(extra="allow")

    nodes: list[CanvasGenericNode] = Field(default_factory=list)
    edges: list[CanvasEdge] = Field(default_factory=list)


class CanvasMeta(BaseModel):
    id: str
    title: str
    filename: str
    created_at: str | None = None
    updated_at: str | None = None
