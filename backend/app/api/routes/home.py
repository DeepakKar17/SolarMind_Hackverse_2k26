"""SolarMind Homeowner Portal API Routes.

Provides endpoints for residential homeowners to monitor authorized solar plants,
telemetry summaries, active alerts, diagnoses, and work orders.
Access is strictly scoped to the authenticated user's assigned solar assets.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, require_roles
from app.db.session import get_db
from app.models.alert import Alert
from app.models.diagnosis import Diagnosis
from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.plant_user_assignment import PlantUserAssignment
from app.models.telemetry import Telemetry
from app.models.user import User
from app.models.work_order import WorkOrder
from app.repositories.plant import plant_repository
from app.schemas.alert import AlertResponse
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.diagnosis import DiagnosisResponse
from app.schemas.homeowner import HomeownerDashboardResponse
from app.schemas.plant import PlantResponse, PlantSummaryResponse
from app.schemas.work_order import WorkOrderResponse

router = APIRouter(prefix="/home", tags=["Homeowner Portal"])

# Homeowner role guard (also permits admin for support)
require_homeowner_user = require_roles(["homeowner", "admin"])


def get_homeowner_plant_ids(db: Session, user: User) -> List[int]:
    """Resolve all solar plant IDs owned by or assigned to this homeowner."""
    if user.role and user.role.lower() == "admin":
        return list(db.scalars(select(Plant.id).where(Plant.is_active == True)).all())

    # Direct ownership
    owned_ids = set(db.scalars(select(Plant.id).where(Plant.owner_id == user.id, Plant.is_active == True)).all())

    # Multi-tenant assignments
    assigned_ids = set(
        db.scalars(select(PlantUserAssignment.plant_id).where(PlantUserAssignment.user_id == user.id)).all()
    )

    return list(owned_ids.union(assigned_ids))


@router.get(
    "/dashboard",
    response_model=HomeownerDashboardResponse,
    summary="Get Homeowner Dashboard Overview",
)
def get_homeowner_dashboard(
    current_user: User = Depends(require_homeowner_user),
    db: Session = Depends(get_db),
) -> HomeownerDashboardResponse:
    """Retrieve aggregate solar generation, live power, health score, and alerts for current homeowner."""
    plant_ids = get_homeowner_plant_ids(db, current_user)

    if not plant_ids:
        # Return truthful empty state
        return HomeownerDashboardResponse(
            total_plants=0,
            total_capacity_kwp=0.0,
            today_generation_kwh=0.0,
            current_power_kw=0.0,
            expected_vs_actual_ratio=1.0,
            energy_shortfall_kwh=0.0,
            estimated_financial_savings_inr=0.0,
            health_score=100.0,
            active_alerts_count=0,
            open_work_orders_count=0,
            recent_diagnoses=[],
            active_alerts=[],
        )

    # 1. Total capacity and plant count
    total_plants = len(plant_ids)
    total_capacity = db.scalar(
        select(func.sum(Plant.installed_capacity_kwp)).where(Plant.id.in_(plant_ids))
    ) or 0.0

    # 2. Instantaneous power generation (sum of latest telemetry across inverters)
    inverter_ids = list(
        db.scalars(select(Inverter.id).where(Inverter.plant_id.in_(plant_ids))).all()
    )
    current_power = 0.0
    today_generation = 0.0
    if inverter_ids:
        current_power = db.scalar(
            select(func.sum(Telemetry.p_ac)).where(Telemetry.inverter_id.in_(inverter_ids))
        ) or 0.0
        today_generation = db.scalar(
            select(func.sum(Telemetry.daily_yield_kwh)).where(Telemetry.inverter_id.in_(inverter_ids))
        ) or 0.0

    # 3. Active alerts
    alerts_stmt = (
        select(Alert)
        .where(Alert.plant_id.in_(plant_ids), Alert.status == "ACTIVE")
        .order_by(Alert.event_timestamp.desc())
    )
    active_alerts = list(db.scalars(alerts_stmt).all())
    active_alerts_count = len(active_alerts)

    # 4. Open work orders
    open_work_orders_count = db.scalar(
        select(func.count(WorkOrder.id)).where(
            WorkOrder.plant_id.in_(plant_ids),
            WorkOrder.status.in_(["PENDING", "ASSIGNED", "IN_PROGRESS"]),
        )
    ) or 0

    # 5. Recent diagnoses
    diag_stmt = (
        select(Diagnosis)
        .where(Diagnosis.plant_id.in_(plant_ids))
        .order_by(Diagnosis.detected_at.desc())
        .limit(5)
    )
    recent_diagnoses = list(db.scalars(diag_stmt).all())

    # 6. Calculate tariff savings (standard residential tariff ~ 7.50 INR/kWh)
    tariff_savings = round(today_generation * 7.50, 2)

    # 7. Composite health score (degrades with critical/high alerts)
    health_score = 100.0
    for a in active_alerts:
        if a.severity == "CRITICAL":
            health_score -= 15.0
        elif a.severity in ("HIGH", "WARNING"):
            health_score -= 5.0
    health_score = max(0.0, min(100.0, health_score))

    return HomeownerDashboardResponse(
        total_plants=total_plants,
        total_capacity_kwp=round(total_capacity, 2),
        today_generation_kwh=round(today_generation, 2),
        current_power_kw=round(current_power, 2),
        expected_vs_actual_ratio=round(current_power / (total_capacity * 0.8), 2) if total_capacity > 0 else 1.0,
        energy_shortfall_kwh=round(max(0.0, (total_capacity * 4.0) - today_generation), 2),
        estimated_financial_savings_inr=tariff_savings,
        health_score=health_score,
        active_alerts_count=active_alerts_count,
        open_work_orders_count=open_work_orders_count,
        recent_diagnoses=[DiagnosisResponse.model_validate(d) for d in recent_diagnoses],
        active_alerts=[AlertResponse.model_validate(a) for a in active_alerts[:5]],
    )


@router.get(
    "/plants",
    response_model=List[PlantSummaryResponse],
    summary="List Homeowner Authorized Plants",
)
def list_homeowner_plants(
    current_user: User = Depends(require_homeowner_user),
    db: Session = Depends(get_db),
) -> List[PlantSummaryResponse]:
    """List solar plants owned by or assigned to the current homeowner."""
    plant_ids = get_homeowner_plant_ids(db, current_user)
    if not plant_ids:
        return []

    plants = list(db.scalars(select(Plant).where(Plant.id.in_(plant_ids), Plant.is_active == True)).all())
    result = []
    for plant in plants:
        inverter_count = db.scalar(
            select(func.count(Inverter.id)).where(Inverter.plant_id == plant.id)
        ) or 0
        active_alerts = db.scalar(
            select(func.count(Alert.id)).where(Alert.plant_id == plant.id, Alert.status == "ACTIVE")
        ) or 0

        result.append(
            PlantSummaryResponse(
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
                inverter_count=inverter_count,
                active_alerts_count=active_alerts,
                current_power_kw=0.0,
                daily_generation_kwh=0.0,
            )
        )
    return result


@router.get(
    "/alerts",
    response_model=PaginatedResponse[AlertResponse],
    summary="List Homeowner Authorized Alerts",
)
def list_homeowner_alerts(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status ('ACTIVE', 'RESOLVED')"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_homeowner_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[AlertResponse]:
    """List operational alerts across homeowner's solar assets."""
    plant_ids = get_homeowner_plant_ids(db, current_user)
    pagination = PaginationParams(page=page, page_size=page_size)

    if not plant_ids:
        return PaginatedResponse.create(items=[], total=0, params=pagination)

    stmt = select(Alert).where(Alert.plant_id.in_(plant_ids))
    count_stmt = select(func.count()).select_from(Alert).where(Alert.plant_id.in_(plant_ids))

    if status_filter:
        stmt = stmt.where(Alert.status == status_filter.upper())
        count_stmt = count_stmt.where(Alert.status == status_filter.upper())

    stmt = stmt.order_by(Alert.event_timestamp.desc()).offset(pagination.offset).limit(pagination.page_size)
    alerts = list(db.scalars(stmt).all())
    total = db.scalar(count_stmt) or 0

    items = [AlertResponse.model_validate(a) for a in alerts]
    return PaginatedResponse.create(items=items, total=total, params=pagination)


@router.get(
    "/diagnoses",
    response_model=PaginatedResponse[DiagnosisResponse],
    summary="List Homeowner Authorized Diagnoses",
)
def list_homeowner_diagnoses(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_homeowner_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[DiagnosisResponse]:
    """List AI fault diagnoses for homeowner's solar assets."""
    plant_ids = get_homeowner_plant_ids(db, current_user)
    pagination = PaginationParams(page=page, page_size=page_size)

    if not plant_ids:
        return PaginatedResponse.create(items=[], total=0, params=pagination)

    stmt = (
        select(Diagnosis)
        .where(Diagnosis.plant_id.in_(plant_ids))
        .order_by(Diagnosis.detected_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    count_stmt = select(func.count()).select_from(Diagnosis).where(Diagnosis.plant_id.in_(plant_ids))

    diagnoses = list(db.scalars(stmt).all())
    total = db.scalar(count_stmt) or 0

    items = [DiagnosisResponse.model_validate(d) for d in diagnoses]
    return PaginatedResponse.create(items=items, total=total, params=pagination)


@router.get(
    "/work-orders",
    response_model=PaginatedResponse[WorkOrderResponse],
    summary="List Homeowner Authorized Work Orders",
)
def list_homeowner_work_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_homeowner_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[WorkOrderResponse]:
    """List maintenance intervention tickets for homeowner's solar plants."""
    plant_ids = get_homeowner_plant_ids(db, current_user)
    pagination = PaginationParams(page=page, page_size=page_size)

    if not plant_ids:
        return PaginatedResponse.create(items=[], total=0, params=pagination)

    stmt = (
        select(WorkOrder)
        .where(WorkOrder.plant_id.in_(plant_ids))
        .order_by(WorkOrder.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    count_stmt = select(func.count()).select_from(WorkOrder).where(WorkOrder.plant_id.in_(plant_ids))

    work_orders = list(db.scalars(stmt).all())
    total = db.scalar(count_stmt) or 0

    items = [WorkOrderResponse.model_validate(wo) for wo in work_orders]
    return PaginatedResponse.create(items=items, total=total, params=pagination)
