"""Pydantic schemas for Vault API."""

from pydantic import BaseModel, Field


class VaultResponse(BaseModel):
    id: str
    name: str
    path: str
    is_active: bool = False
    is_git: bool = False
    created_at: str


class VaultCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Human-friendly vault name")
    path: str = Field(..., min_length=1, description="Local folder path for the vault")
    id: str | None = Field(None, description="Optional custom unique slug identifier")


class VaultSwitchRequest(BaseModel):
    vault_id: str = Field(..., description="ID of the vault to activate")
