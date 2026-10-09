from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_optional_current_user
from app.core.permissions import (
    can_view_inverter,
    enforce_plant_modification,
    is_admin,
)
from app.db.errors import EntityConflictError, EntityNotFoundError
from app.db.session import get_db
from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.user import User
from app.repositories.inverter import inverter_repository
from app.repositories.plant import plant_repository
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.inverter import (
    InverterCreate,
    InverterResponse,
    InverterUpdate,
)

router = APIRouter(prefix="/inverters", tags=["Inverters"])


@router.get(
    "",
    response_model=PaginatedResponse[InverterResponse],
    summary="List Inverters",
    description="Retrieve a paginated list of inverters with optional filtering by plant and status.",
)
def list_inverters(
    plant_id: Optional[int] = Query(default=None, description="Filter inverters by parent plant ID"),
    status_filter: Optional[str] = Query(default=None, alias="status", description="Filter by inverter status"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[InverterResponse]:
    pagination = PaginationParams(page=page, page_size=page_size)

    stmt = select(Inverter)
    count_stmt = select(func.count()).select_from(Inverter)

    if plant_id:
        stmt = stmt.where(Inverter.plant_id == plant_id)
        count_stmt = count_stmt.where(Inverter.plant_id == plant_id)
    if status_filter:
        stmt = stmt.where(Inverter.status == status_filter)
        count_stmt = count_stmt.where(Inverter.status == status_filter)

    stmt = stmt.order_by(Inverter.id.asc()).offset(pagination.offset).limit(pagination.page_size)

    inverters = list(db.scalars(stmt).all())

    if current_user:
        inverters = [inv for inv in inverters if can_view_inverter(current_user, inv)]

    total = len(inverters) if current_user and not is_admin(current_user) else (db.scalar(count_stmt) or 0)

    items = [InverterResponse.model_validate(inv) for inv in inverters]
    return PaginatedResponse.create(items=items, total=total, params=pagination)


@router.post(
    "",
    response_model=InverterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register Inverter",
    description="Register a new inverter under an existing solar plant.",
)
def create_inverter(
    inverter_in: InverterCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> InverterResponse:
    if current_user:
        enforce_plant_modification(current_user)

    # 1. Verify parent plant exists
    plant = plant_repository.get(db, inverter_in.plant_id)
    if not plant:
        raise EntityNotFoundError("Plant", inverter_in.plant_id)

    # 2. Check for duplicate ID or serial number
    if inverter_repository.get(db, inverter_in.id):
        raise EntityConflictError(f"Inverter with ID '{inverter_in.id}' already exists.")

    if inverter_repository.get_by_serial(db, inverter_in.serial_number):
        raise EntityConflictError(f"Inverter with serial number '{inverter_in.serial_number}' already exists.")

    inverter = inverter_repository.create(db, obj_in=inverter_in)
    db.commit()
    db.refresh(inverter)
    return InverterResponse.model_validate(inverter)


@router.get(
    "/{inverter_id}",
    response_model=InverterResponse,
    summary="Get Inverter Details",
    description="Retrieve details for a specific inverter unit.",
)
def get_inverter(
    inverter_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> InverterResponse:
    inverter = inverter_repository.get(db, inverter_id)
    if not inverter:
        raise EntityNotFoundError("Inverter", inverter_id)

    if current_user and not can_view_inverter(current_user, inverter):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You do not have permission to view inverter '{inverter_id}'.",
        )

    return InverterResponse.model_validate(inverter)


@router.put(
    "/{inverter_id}",
    response_model=InverterResponse,
    summary="Update Inverter",
    description="Update metadata or ratings for an existing inverter.",
)
def update_inverter(
    inverter_id: str,
    inverter_in: InverterUpdate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> InverterResponse:
    if current_user:
        enforce_plant_modification(current_user)

    inverter = inverter_repository.get(db, inverter_id)
    if not inverter:
        raise EntityNotFoundError("Inverter", inverter_id)

    updated_inverter = inverter_repository.update(db, db_obj=inverter, obj_in=inverter_in)
    db.commit()
    db.refresh(updated_inverter)
    return InverterResponse.model_validate(updated_inverter)
