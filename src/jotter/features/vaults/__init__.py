"""Vault feature package."""

from jotter.features.vaults.domain import Vault
from jotter.features.vaults.registry import VaultRegistry
from jotter.features.vaults.router import router
from jotter.features.vaults.schemas import VaultCreate, VaultResponse, VaultSwitchRequest
from jotter.features.vaults.service import VaultApplicationService

__all__ = [
    "Vault",
    "VaultRegistry",
    "VaultApplicationService",
    "VaultCreate",
    "VaultResponse",
    "VaultSwitchRequest",
    "router",
]
