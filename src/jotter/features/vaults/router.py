"""FastAPI routes for Vault management and switching."""

from fastapi import APIRouter, Depends, Request

from jotter.features.vaults.registry import VaultRegistry
from jotter.features.vaults.schemas import (
    VaultCreate,
    VaultResponse,
    VaultSwitchRequest,
    VaultUpdate,
)
from jotter.features.vaults.service import VaultApplicationService

router = APIRouter(prefix="/api/vaults", tags=["vaults"])


def get_vault_service(request: Request) -> VaultApplicationService:
    default_dir = request.app.state.config.data_dir
    registry = getattr(request.app.state, "vault_registry", None)
    if not registry:
        registry = VaultRegistry(default_data_dir=default_dir)
        request.app.state.vault_registry = registry
    return VaultApplicationService(registry)


@router.get("", response_model=list[VaultResponse])
def list_vaults(svc: VaultApplicationService = Depends(get_vault_service)) -> list[VaultResponse]:
    return svc.list_vaults()


@router.get("/active", response_model=VaultResponse)
def get_active_vault(svc: VaultApplicationService = Depends(get_vault_service)) -> VaultResponse:
    return svc.get_active_vault()


@router.post("", response_model=VaultResponse, status_code=201)
def create_vault(req: VaultCreate, svc: VaultApplicationService = Depends(get_vault_service)) -> VaultResponse:
    return svc.create_vault(req)


@router.post("/switch", response_model=VaultResponse)
def switch_vault(
    req: VaultSwitchRequest,
    request: Request,
    svc: VaultApplicationService = Depends(get_vault_service),
) -> VaultResponse:
    return svc.switch_vault(req.vault_id, app_state=request.app.state)


@router.patch("/{vault_id}", response_model=VaultResponse)
def rename_vault(
    vault_id: str,
    req: VaultUpdate,
    svc: VaultApplicationService = Depends(get_vault_service),
) -> VaultResponse:
    return svc.rename_vault(vault_id, req)


@router.delete("/{vault_id}", status_code=204)
def delete_vault(
    vault_id: str,
    request: Request,
    svc: VaultApplicationService = Depends(get_vault_service),
) -> None:
    svc.delete_vault(vault_id, app_state=request.app.state)
