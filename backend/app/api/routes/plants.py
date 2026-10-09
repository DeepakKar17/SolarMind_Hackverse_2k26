from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_optional_current_user
from app.core.permissions import (
    can_view_plant,
    enforce_plant_access,
    enforce_plant_modification,
    is_homeowner,
)
from app.db.errors import EntityNotFoundError
from app.db.session import get_db
from app.models.alert import Alert
from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.telemetry import Telemetry
from app.models.user import User
from app.repositories.plant import plant_repository
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.plant import (
    PlantCreate,
    PlantResponse,
    PlantSummaryResponse,
    PlantUpdate,
)

router = APIRouter(prefix="/plants", tags=["Plants"])


@router.get(
    "",
    response_model=PaginatedResponse[PlantSummaryResponse],
    summary="List Solar Plants",
    description="Retrieve a paginated list of solar power plants with optional status, system type, and text search filters.",
)
def list_plants(
    status_filter: Optional[str] = Query(default=None, alias="status", description="Filter by operational status"),
    system_type: Optional[str] = Query(default=None, description="Filter by system topology type"),
    search: Optional[str] = Query(default=None, description="Search term for plant name or location"),
    is_active: Optional[bool] = Query(default=None, description="Filter by active status"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[PlantSummaryResponse]:
    pagination = PaginationParams(page=page, page_size=page_size)

    plants = plant_repository.list_with_filters(
        db,
        status=status_filter,
        system_type=system_type,
        search=search,
        is_active=is_active,
        offset=pagination.offset,
        limit=pagination.page_size,
    )

    # Apply homeowner resource isolation
    if current_user and is_homeowner(current_user):
        plants = [p for p in plants if p.owner_id == current_user.id]

    total = len(plants) if (current_user and is_homeowner(current_user)) else plant_repository.count_with_filters(
        db,
        status=status_filter,
        system_type=system_type,
        search=search,
        is_active=is_active,
    )

    # Enrich with aggregate summary metrics
    summary_items = []
    for plant in plants:
        inverter_count = db.scalar(
            select(func.count(Inverter.id)).where(Inverter.plant_id == plant.id)
        ) or 0

        active_alerts = db.scalar(
            select(func.count(Alert.id)).where(
                Alert.plant_id == plant.id,
                Alert.status == "ACTIVE",
            )
        ) or 0

        # Latest power
        latest_power = db.scalar(
            select(func.sum(Telemetry.p_ac))
            .join(Inverter, Telemetry.inverter_id == Inverter.id)
            .where(Inverter.plant_id == plant.id)
        )

        item = PlantSummaryResponse(
            id=plant.id,
            name=plant.name,
            location=plant.location,
            timezone=plant.timezone,
            latitude=plant.latitude,
            longitude=plant.longitude,
            system_type=plant.system_type,
            installed_capacity_kwp=plant.installed_capacity_kwp,
            tariff_rate_inr=plant.tariff_rate_inr,
            status=plant.status,
            is_active=plant.is_active,
            created_at=plant.created_at,
            updated_at=plant.updated_at,
            inverters_count=inverter_count,
            active_alerts_count=active_alerts,
            current_power_kw=round(latest_power, 2) if latest_power else None,
            daily_yield_kwh=None,
        )
        summary_items.append(item)

    return PaginatedResponse.create(items=summary_items, total=total, params=pagination)


from app.services.audit_service import log_audit_event

@router.post(
    "",
    response_model=PlantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Solar Plant",
    description="Register a new solar installation site.",
)
def create_plant(
    plant_in: PlantCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PlantResponse:
    if current_user:
        enforce_plant_modification(current_user)
    plant = plant_repository.create(db, obj_in=plant_in)
    if current_user:
        log_audit_event(
            db=db,
            actor=current_user,
            action="CREATE_PLANT",
            target_type="PLANT",
            target_id=str(plant.id),
            details=f"Registered plant '{plant.name}' (capacity={plant.installed_capacity_kwp}kWp, owner_id={plant.owner_id})",
        )
    db.commit()
    db.refresh(plant)
    return PlantResponse.model_validate(plant)


@router.get(
    "/{plant_id}",
    response_model=PlantSummaryResponse,
    summary="Get Solar Plant Details",
    description="Retrieve comprehensive details and current metrics for a specific solar plant.",
)
def get_plant(
    plant_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PlantSummaryResponse:
    plant = plant_repository.get(db, plant_id)
    if not plant:
        raise EntityNotFoundError("Plant", plant_id)

    if current_user:
        enforce_plant_access(current_user, plant)

    inverter_count = db.scalar(
        select(func.count(Inverter.id)).where(Inverter.plant_id == plant.id)
    ) or 0

    active_alerts = db.scalar(
        select(func.count(Alert.id)).where(
            Alert.plant_id == plant.id,
            Alert.status == "ACTIVE",
        )
    ) or 0

    latest_power = db.scalar(
        select(func.sum(Telemetry.p_ac))
        .join(Inverter, Telemetry.inverter_id == Inverter.id)
        .where(Inverter.plant_id == plant.id)
    )

    return PlantSummaryResponse(
        id=plant.id,
        name=plant.name,
        location=plant.location,
        timezone=plant.timezone,
        latitude=plant.latitude,
        longitude=plant.longitude,
        system_type=plant.system_type,
        installed_capacity_kwp=plant.installed_capacity_kwp,
        tariff_rate_inr=plant.tariff_rate_inr,
        status=plant.status,
        is_active=plant.is_active,
        created_at=plant.created_at,
        updated_at=plant.updated_at,
        inverters_count=inverter_count,
        active_alerts_count=active_alerts,
        current_power_kw=round(latest_power, 2) if latest_power else None,
        daily_yield_kwh=None,
    )


@router.put(
    "/{plant_id}",
    response_model=PlantResponse,
    summary="Update Solar Plant",
    description="Update metadata, capacity, or configuration for an existing solar plant.",
)
def update_plant(
    plant_id: int,
    plant_in: PlantUpdate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PlantResponse:
    plant = plant_repository.get(db, plant_id)
    if not plant:
        raise EntityNotFoundError("Plant", plant_id)

    if current_user:
        enforce_plant_modification(current_user, plant)

    updated_plant = plant_repository.update(db, db_obj=plant, obj_in=plant_in)
    if current_user:
        log_audit_event(
            db=db,
            actor=current_user,
            action="UPDATE_PLANT",
            target_type="PLANT",
            target_id=str(updated_plant.id),
            details=f"Updated plant metadata for '{updated_plant.name}'",
        )
    db.commit()
    db.refresh(updated_plant)
    return PlantResponse.model_validate(updated_plant)
