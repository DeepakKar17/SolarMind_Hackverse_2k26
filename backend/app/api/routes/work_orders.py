"""API endpoints for WorkOrder tickets and maintenance lifecycle workflows."""

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_optional_current_user
from app.core.permissions import (
    can_view_work_order,
    enforce_work_order_access,
    is_admin,
    is_homeowner,
    is_technician,
)
from app.db.errors import EntityNotFoundError
from app.db.session import get_db
from app.models.plant import Plant
from app.models.user import User
from app.repositories.work_order import work_order_repository
from app.schemas.common import PaginatedResponse, PaginationParams

from app.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderInspectionSubmit,
    WorkOrderResponse,
    WorkOrderStatusHistoryResponse,
    WorkOrderUpdate,
    WorkOrderVerificationRequest,
    WorkOrderVerificationResponse,
)
from app.services.work_order_service import work_order_service

router = APIRouter(prefix="/work-orders", tags=["Work Orders"])



@router.get(
    "",
    response_model=PaginatedResponse[WorkOrderResponse],
    summary="List Work Orders",
    description="Retrieve paginated list of maintenance work orders with filtering by plant, technician, status, priority, and due dates.",
)
def list_work_orders(
    plant_id: Optional[int] = Query(default=None, description="Filter by plant ID"),
    assigned_to: Optional[str] = Query(default=None, description="Filter by assigned technician identifier"),
    status: Optional[str] = Query(default=None, description="Filter by status ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')"),
    priority: Optional[str] = Query(default=None, description="Filter by priority ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')"),
    due_before: Optional[date] = Query(default=None, description="Filter work orders due on or before date"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[WorkOrderResponse]:
    offset = (page - 1) * page_size
    items = work_order_repository.list_with_filters(
        db,
        plant_id=plant_id,
        assigned_to=assigned_to,
        status=status,
        priority=priority,
        due_before=due_before,
        offset=offset,
        limit=page_size,
    )

    # Filter by user permissions
    if current_user:
        items = [wo for wo in items if can_view_work_order(current_user, wo)]

    total = len(items) if current_user and not is_admin(current_user) else work_order_repository.count_with_filters(
        db,
        plant_id=plant_id,
        assigned_to=assigned_to,
        status=status,
        priority=priority,
        due_before=due_before,
    )

    response_items = [WorkOrderResponse.model_validate(item) for item in items]
    return PaginatedResponse.create(
        items=response_items,
        total=total,
        params=PaginationParams(page=page, page_size=page_size),
    )


@router.post(
    "",
    response_model=WorkOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Work Order",
    description="Create a new maintenance intervention ticket, optionally linked to a fault diagnosis, inverter, or string asset.",
)
def create_work_order(
    work_order_in: WorkOrderCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> WorkOrderResponse:
    if current_user and is_technician(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Technicians cannot create new work order tickets directly.",
        )
    created = work_order_service.create_work_order(db, work_order_in)
    return WorkOrderResponse.model_validate(created)


@router.get(
    "/{work_order_id}",
    response_model=WorkOrderResponse,
    summary="Get Work Order by ID",
    description="Retrieve full details for a maintenance work order ticket.",
)
def get_work_order(
    work_order_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> WorkOrderResponse:
    work_order = work_order_repository.get_with_diagnosis(db, work_order_id)
    if not work_order:
        raise EntityNotFoundError("WorkOrder", work_order_id)

    if current_user:
        enforce_work_order_access(current_user, work_order, write=False)

    return WorkOrderResponse.model_validate(work_order)


@router.patch(
    "/{work_order_id}",
    response_model=WorkOrderResponse,
    summary="Update Work Order Status & Resolution",
    description="Update technician assignment, execution status, labor duration, resolution notes, and completion verification.",
)
def update_work_order(
    work_order_id: str,
    update_in: WorkOrderUpdate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> WorkOrderResponse:
    work_order = work_order_repository.get_with_diagnosis(db, work_order_id)
    if not work_order:
        raise EntityNotFoundError("WorkOrder", work_order_id)

    if current_user:
        enforce_work_order_access(current_user, work_order, write=True)

    updated = work_order_service.update_work_order(db, work_order_id, update_in, current_user=current_user)
    return WorkOrderResponse.model_validate(updated)


@router.post(
    "/{work_order_id}/inspection",
    response_model=WorkOrderResponse,
    summary="Submit Technician Field Inspection",
    description="Record checklist execution, fault observations, repair actions, parts used, and before/after photos.",
)
def submit_inspection(
    work_order_id: str,
    submit_in: WorkOrderInspectionSubmit,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> WorkOrderResponse:
    work_order = work_order_repository.get_with_diagnosis(db, work_order_id)
    if not work_order:
        raise EntityNotFoundError("WorkOrder", work_order_id)

    if current_user:
        enforce_work_order_access(current_user, work_order, write=True)

    updated = work_order_service.submit_technician_inspection(db, work_order_id, submit_in, current_user=current_user)
    return WorkOrderResponse.model_validate(updated)


@router.post(
    "/{work_order_id}/verify",
    response_model=WorkOrderVerificationResponse,
    summary="Verify Post-Repair Recovery",
    description="Quantitatively evaluate post-repair solar generation recovery against physical clear-sky and weather baselines.",
)
def verify_work_order_recovery(
    work_order_id: str,
    request: WorkOrderVerificationRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> WorkOrderVerificationResponse:
    work_order = work_order_repository.get_with_diagnosis(db, work_order_id)
    if not work_order:
        raise EntityNotFoundError("WorkOrder", work_order_id)

    if current_user:
        enforce_work_order_access(current_user, work_order, write=True)

    return work_order_service.verify_recovery(db, work_order_id, request, current_user=current_user)


@router.get(
    "/{work_order_id}/history",
    response_model=list[WorkOrderStatusHistoryResponse],
    summary="Get Work Order Status History",
    description="Retrieve chronological audit trail of all status transitions, actors, and technician notes.",
)
def get_work_order_history(
    work_order_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> list[WorkOrderStatusHistoryResponse]:
    work_order = work_order_repository.get_with_diagnosis(db, work_order_id)
    if not work_order:
        raise EntityNotFoundError("WorkOrder", work_order_id)

    if current_user:
        enforce_work_order_access(current_user, work_order, write=False)

    history_items = work_order_service.get_status_history(db, work_order_id)
    return [WorkOrderStatusHistoryResponse.model_validate(h) for h in history_items]

