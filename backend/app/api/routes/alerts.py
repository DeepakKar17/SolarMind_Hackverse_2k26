"""SolarMind Alerts & Alarm Lifecycle API Routes.

Provides endpoints for monitoring, acknowledging, and resolving real-time alarms.
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_optional_current_user, require_authenticated_user
from app.core.permissions import can_view_alert, is_admin
from app.db.errors import EntityNotFoundError
from app.db.session import get_db
from app.models.alert import Alert
from app.models.user import User
from app.repositories.alert import alert_repository
from app.schemas.alert import AlertAcknowledge, AlertCreate, AlertResponse, AlertUpdate
from app.schemas.common import PaginatedResponse, PaginationParams
from app.services.audit_service import log_audit_event, transactional_audit

router = APIRouter(prefix="/alerts", tags=["Alerts & Notifications"])


@router.get(
    "",
    response_model=PaginatedResponse[AlertResponse],
    summary="List System Alerts",
    description="Retrieve paginated alarms with filtering by plant, severity, status, source, and date range.",
)
def list_alerts(
    plant_id: Optional[int] = Query(default=None, description="Filter by plant ID"),
    inverter_id: Optional[str] = Query(default=None, description="Filter by inverter ID"),
    severity: Optional[str] = Query(default=None, description="Filter by severity ('INFO', 'WARNING', 'HIGH', 'CRITICAL')"),
    status_filter: Optional[str] = Query(default=None, alias="status", description="Filter by status ('ACTIVE', 'RESOLVED')"),
    acknowledged: Optional[bool] = Query(default=None, description="Filter by acknowledgement flag"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[AlertResponse]:
    offset = (page - 1) * page_size
    alerts = alert_repository.list_with_filters(
        db,
        plant_id=plant_id,
        inverter_id=inverter_id,
        severity=severity,
        status=status_filter,
        acknowledged=acknowledged,
        offset=offset,
        limit=page_size,
    )

    if current_user:
        alerts = [a for a in alerts if can_view_alert(current_user, a)]

    total = len(alerts) if current_user and not is_admin(current_user) else alert_repository.count_with_filters(
        db,
        plant_id=plant_id,
        inverter_id=inverter_id,
        severity=severity,
        status=status_filter,
        acknowledged=acknowledged,
    )

    items = [AlertResponse.model_validate(a) for a in alerts]
    return PaginatedResponse.create(
        items=items,
        total=total,
        params=PaginationParams(page=page, page_size=page_size),
    )


@router.get(
    "/{alert_id}",
    response_model=AlertResponse,
    summary="Get Alert by ID",
)
def get_alert(
    alert_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> AlertResponse:
    alert = alert_repository.get(db, alert_id)
    if not alert:
        raise EntityNotFoundError("Alert", alert_id)

    if current_user and not can_view_alert(current_user, alert):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You are not authorized to view alert '{alert_id}'.",
        )

    return AlertResponse.model_validate(alert)


@router.post(
    "/{alert_id}/acknowledge",
    response_model=AlertResponse,
    summary="Acknowledge Alert",
)
def acknowledge_alert(
    alert_id: str,
    payload: AlertAcknowledge,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> AlertResponse:
    alert = alert_repository.get(db, alert_id)
    if not alert:
        raise EntityNotFoundError("Alert", alert_id)

    if not can_view_alert(current_user, alert):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You are not authorized to modify alert '{alert_id}'.",
        )

    with transactional_audit(
        db=db,
        actor=current_user,
        action="ACKNOWLEDGE_ALERT",
        target_type="Alert",
        target_id=alert.id,
        details=f"Acknowledged by {payload.acknowledged_by}",
    ):
        alert.acknowledged = True
        alert.acknowledged_by = payload.acknowledged_by
        alert.acknowledged_at = datetime.now(timezone.utc)
        db.add(alert)

    db.refresh(alert)
    return AlertResponse.model_validate(alert)


@router.post(
    "/{alert_id}/resolve",
    response_model=AlertResponse,
    summary="Resolve Alert",
)
def resolve_alert(
    alert_id: str,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> AlertResponse:
    alert = alert_repository.get(db, alert_id)
    if not alert:
        raise EntityNotFoundError("Alert", alert_id)

    if not is_admin(current_user) and not (current_user.role or "").lower() in ("operator", "technician"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only operators, technicians, or administrators can resolve alarms.",
        )

    with transactional_audit(
        db=db,
        actor=current_user,
        action="RESOLVE_ALERT",
        target_type="Alert",
        target_id=alert.id,
        details=f"Alert resolved by {current_user.email}",
    ):
        alert.status = "RESOLVED"
        alert.resolved_at = datetime.now(timezone.utc)
        db.add(alert)

    db.refresh(alert)
    return AlertResponse.model_validate(alert)
