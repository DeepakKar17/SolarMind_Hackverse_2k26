"""SolarMind Technician Field Service API Routes.

Provides endpoints for technicians to view assigned work orders, update inspection findings,
and submit work order completions.
Access is strictly scoped to work orders assigned to the authenticated technician.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, require_assigned_work_order, require_roles
from app.core.permissions import can_view_work_order, enforce_work_order_access
from app.db.session import get_db
from app.models.plant import Plant
from app.models.user import User
from app.models.work_order import WorkOrder
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.technician import (
    TechnicianCompletionRequest,
    TechnicianDashboardResponse,
    TechnicianInspectionRequest,
)
from app.schemas.work_order import WorkOrderResponse
from app.services.audit_service import log_audit_event, transactional_audit

router = APIRouter(prefix="/technician", tags=["Technician Portal"])

# Technician role guard (permits technician and admin)
require_technician_user = require_roles(["technician", "admin"])


def get_technician_work_order_filter(user: User):
    """Generate SQLAlchemy filter condition for technician work orders."""
    if user.role and user.role.lower() == "admin":
        return True  # Admins can view all work orders

    return (
        (WorkOrder.technician_id == user.id)
        | (func.lower(WorkOrder.assigned_to) == user.full_name.lower())
        | (func.lower(WorkOrder.assigned_to) == (user.username or "").lower())
        | (func.lower(WorkOrder.assigned_to) == user.email.lower())
    )


@router.get(
    "/dashboard",
    response_model=TechnicianDashboardResponse,
    summary="Get Technician Dashboard Overview",
)
def get_technician_dashboard(
    current_user: User = Depends(require_technician_user),
    db: Session = Depends(get_db),
) -> TechnicianDashboardResponse:
    """Retrieve assigned job counts, priorities, and active work orders for current technician."""
    cond = get_technician_work_order_filter(current_user)

    assigned_count = db.scalar(
        select(func.count(WorkOrder.id)).where(cond, WorkOrder.status.in_(["ASSIGNED", "PENDING"]))
    ) or 0

    in_progress_count = db.scalar(
        select(func.count(WorkOrder.id)).where(cond, WorkOrder.status == "IN_PROGRESS")
    ) or 0

    high_priority_count = db.scalar(
        select(func.count(WorkOrder.id)).where(
            cond,
            WorkOrder.priority.in_(["HIGH", "CRITICAL"]),
            WorkOrder.status != "COMPLETED",
        )
    ) or 0

    today = datetime.now(timezone.utc).date()
    completed_today = db.scalar(
        select(func.count(WorkOrder.id)).where(
            cond,
            WorkOrder.status == "COMPLETED",
            WorkOrder.completed_date == today,
        )
    ) or 0

    assigned_plants = db.scalar(
        select(func.count(func.distinct(WorkOrder.plant_id))).where(cond)
    ) or 0

    recent_jobs = list(
        db.scalars(
            select(WorkOrder)
            .where(cond)
            .order_by(WorkOrder.created_at.desc())
            .limit(5)
        ).all()
    )

    return TechnicianDashboardResponse(
        assigned_work_orders_count=assigned_count,
        in_progress_count=in_progress_count,
        high_priority_count=high_priority_count,
        completed_today_count=completed_today,
        assigned_plants_count=assigned_plants,
        recent_work_orders=[WorkOrderResponse.model_validate(wo) for wo in recent_jobs],
    )


@router.get(
    "/work-orders",
    response_model=PaginatedResponse[WorkOrderResponse],
    summary="List Technician Assigned Work Orders",
)
def list_technician_work_orders(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED')"),
    priority: Optional[str] = Query(None, description="Filter by priority ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_technician_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[WorkOrderResponse]:
    """Retrieve paginated list of work orders assigned to the authenticated technician."""
    pagination = PaginationParams(page=page, page_size=page_size)
    cond = get_technician_work_order_filter(current_user)

    stmt = select(WorkOrder).where(cond)
    count_stmt = select(func.count()).select_from(WorkOrder).where(cond)

    if status_filter:
        stmt = stmt.where(WorkOrder.status == status_filter.upper())
        count_stmt = count_stmt.where(WorkOrder.status == status_filter.upper())

    if priority:
        stmt = stmt.where(WorkOrder.priority == priority.upper())
        count_stmt = count_stmt.where(WorkOrder.priority == priority.upper())

    stmt = stmt.order_by(WorkOrder.created_at.desc()).offset(pagination.offset).limit(pagination.page_size)
    work_orders = list(db.scalars(stmt).all())
    total = db.scalar(count_stmt) or 0

    items = [WorkOrderResponse.model_validate(wo) for wo in work_orders]
    return PaginatedResponse.create(items=items, total=total, params=pagination)


@router.get(
    "/work-orders/{work_order_id}",
    response_model=WorkOrderResponse,
    summary="Get Technician Assigned Work Order Detail",
)
def get_technician_work_order_detail(
    work_order: WorkOrder = Depends(require_assigned_work_order),
    current_user: User = Depends(require_technician_user),
) -> WorkOrderResponse:
    """Retrieve full details of an assigned work order ticket."""
    return WorkOrderResponse.model_validate(work_order)


@router.post(
    "/work-orders/{work_order_id}/inspection",
    response_model=WorkOrderResponse,
    summary="Submit Work Order Inspection Findings",
)
def submit_inspection(
    payload: TechnicianInspectionRequest,
    work_order: WorkOrder = Depends(require_assigned_work_order),
    current_user: User = Depends(require_technician_user),
    db: Session = Depends(get_db),
) -> WorkOrderResponse:
    """Submit technician diagnostic findings, update notes, and set status to in-progress."""
    with transactional_audit(
        db=db,
        actor=current_user,
        action="SUBMIT_INSPECTION",
        target_type="WorkOrder",
        target_id=work_order.id,
        details=f"Inspection findings: {payload.findings[:100]}...",
    ):
        work_order.notes = f"Inspection Findings: {payload.findings}\n{payload.notes or ''}".strip()
        work_order.status = payload.status or "IN_PROGRESS"
        db.add(work_order)

    db.refresh(work_order)
    return WorkOrderResponse.model_validate(work_order)


@router.post(
    "/work-orders/{work_order_id}/completion",
    response_model=WorkOrderResponse,
    summary="Submit Work Order Completion & Verification",
)
def submit_completion(
    payload: TechnicianCompletionRequest,
    work_order: WorkOrder = Depends(require_assigned_work_order),
    current_user: User = Depends(require_technician_user),
    db: Session = Depends(get_db),
) -> WorkOrderResponse:
    """Record resolution notes, labor duration, parts used, and mark work order completed."""
    with transactional_audit(
        db=db,
        actor=current_user,
        action="COMPLETE_WORK_ORDER",
        target_type="WorkOrder",
        target_id=work_order.id,
        details=f"Completed work order {work_order.id} with resolution: {payload.resolution_notes[:100]}...",
    ):
        work_order.resolution_notes = payload.resolution_notes
        work_order.status = "COMPLETED"
        work_order.completed_date = datetime.now(timezone.utc).date()
        if payload.duration_hours is not None:
            work_order.duration_hours = payload.duration_hours
        if payload.cost_inr is not None:
            work_order.cost_inr = payload.cost_inr
        if payload.parts_used:
            work_order.notes = f"Parts Used: {payload.parts_used}\n{work_order.notes or ''}".strip()
        db.add(work_order)

    db.refresh(work_order)
    return WorkOrderResponse.model_validate(work_order)
