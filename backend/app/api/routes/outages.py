"""API routes for Grid Interruption, Outage Events, and Timeline Tracking."""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_optional_current_user
from app.core.permissions import enforce_plant_access, is_admin
from app.db.errors import EntityNotFoundError
from app.db.session import get_db
from app.models.plant import Plant
from app.models.user import User
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.outage import (
    OutageDetectionRequest,
    OutageDetectionResponse,
    OutageEventCreate,
    OutageEventResponse,
    OutageEventUpdate,
)
from app.services.outage_service import outage_service

router = APIRouter(prefix="/outages", tags=["Grid Interruption & Outages"])


def normalize_datetime(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


@router.get(
    "",
    response_model=PaginatedResponse[OutageEventResponse],
    summary="List Grid Outage Events",
    description="Retrieve paginated list of grid interruption events with plant, status, and date range filters.",
)
def list_outages(
    plant_id: Optional[int] = Query(default=None, description="Filter by plant ID"),
    inverter_id: Optional[str] = Query(default=None, description="Filter by inverter ID"),
    status_filter: Optional[str] = Query(default=None, alias="status", description="Filter by status ('SUSPECTED', 'CONFIRMED', 'RESOLVED')"),
    event_type: Optional[str] = Query(default=None, description="Filter by event type ('GRID_OUTAGE', 'UNDERVOLTAGE_SAG', etc.)"),
    resolved: Optional[bool] = Query(default=None, description="Filter by resolved state"),
    start_time: Optional[datetime] = Query(default=None, description="Outage start time filter"),
    end_time: Optional[datetime] = Query(default=None, description="Outage end time filter"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[OutageEventResponse]:
    start = normalize_datetime(start_time)
    end = normalize_datetime(end_time)

    if plant_id and current_user:
        plant = db.get(Plant, plant_id)
        if plant:
            enforce_plant_access(current_user, plant)

    offset = (page - 1) * page_size
    items = outage_service.list_outages(
        db,
        plant_id=plant_id,
        inverter_id=inverter_id,
        status=status_filter,
        event_type=event_type,
        resolved=resolved,
        start_time=start,
        end_time=end,
        offset=offset,
        limit=page_size,
    )

    response_items = [OutageEventResponse.model_validate(item) for item in items]
    return PaginatedResponse.create(
        items=response_items,
        total=len(response_items),
        params=PaginationParams(page=page, page_size=page_size),
    )


@router.get(
    "/{outage_id}",
    response_model=OutageEventResponse,
    summary="Get Outage Event by ID",
    description="Retrieve detailed outage timeline, electrical evidence, and loss quantification.",
)
def get_outage(
    outage_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> OutageEventResponse:
    event = outage_service.get_outage(db, outage_id)
    if not event:
        raise EntityNotFoundError("OutageEvent", outage_id)

    if current_user:
        plant = db.get(Plant, event.plant_id)
        if plant:
            enforce_plant_access(current_user, plant)

    return OutageEventResponse.model_validate(event)


@router.post(
    "/detect",
    response_model=OutageDetectionResponse,
    summary="Detect Grid Outage Intervals",
    description="Evaluate AC voltage drop signatures and daylight comms gaps to discover and record power interruptions.",
)
def detect_grid_outages(
    request: OutageDetectionRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> OutageDetectionResponse:
    plant = db.get(Plant, request.plant_id)
    if not plant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Plant '{request.plant_id}' not found.")

    if current_user:
        enforce_plant_access(current_user, plant)

    return outage_service.detect_grid_outages(db, request)


@router.post(
    "",
    response_model=OutageEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Outage Event Record",
    description="Record a known or technician-reported utility grid outage.",
)
def create_outage(
    create_in: OutageEventCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> OutageEventResponse:
    plant = db.get(Plant, create_in.plant_id)
    if not plant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Plant '{create_in.plant_id}' not found.")

    if current_user:
        enforce_plant_access(current_user, plant)

    event = outage_service.create_outage(db, create_in)
    return OutageEventResponse.model_validate(event)


@router.patch(
    "/{outage_id}",
    response_model=OutageEventResponse,
    summary="Update or Resolve Outage Event",
    description="Update restoration timestamp, resolution state, or notes for a grid outage.",
)
def update_outage(
    outage_id: int,
    update_in: OutageEventUpdate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> OutageEventResponse:
    event = outage_service.get_outage(db, outage_id)
    if not event:
        raise EntityNotFoundError("OutageEvent", outage_id)

    if current_user:
        plant = db.get(Plant, event.plant_id)
        if plant:
            enforce_plant_access(current_user, plant)

    updated = outage_service.update_outage(db, outage_id, update_in)
    return OutageEventResponse.model_validate(updated)
