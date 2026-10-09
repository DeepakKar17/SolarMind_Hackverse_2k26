"""API endpoints for SolarMind Analytics and Reporting."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.analytics import (
    AnalyticsSummaryResponse,
    EnergyLossAnalyticsResponse,
    FaultDistributionResponse,
    GenerationAnalyticsResponse,
)
from app.services.analytics_service import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def normalize_datetime(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure naive UTC datetimes for consistent DB comparison."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


@router.get(
    "/summary",
    response_model=AnalyticsSummaryResponse,
    summary="Get Analytics Summary",
    description="Retrieve high-level energy generation, performance ratio, and financial metrics across a plant or the entire fleet.",
)
def get_analytics_summary(
    plant_id: Optional[int] = Query(default=None, description="Optional plant ID filter"),
    start_time: Optional[datetime] = Query(default=None, description="Start timestamp (UTC)"),
    end_time: Optional[datetime] = Query(default=None, description="End timestamp (UTC)"),
    db: Session = Depends(get_db),
) -> AnalyticsSummaryResponse:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    end = normalize_datetime(end_time) or now
    start = normalize_datetime(start_time) or (end - timedelta(days=7))

    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_time must be less than or equal to end_time.",
        )

    return analytics_service.get_summary(
        db,
        plant_id=plant_id,
        start_time=start,
        end_time=end,
    )


@router.get(
    "/generation",
    response_model=GenerationAnalyticsResponse,
    summary="Get Generation Trends",
    description="Retrieve time-series aggregated power, energy generation, and performance ratio binned by interval.",
)
def get_generation_trends(
    plant_id: Optional[int] = Query(default=None, description="Optional plant ID filter"),
    inverter_id: Optional[str] = Query(default=None, description="Optional inverter ID filter"),
    interval: str = Query(default="hourly", pattern="^(hourly|daily)$", description="Aggregation bin ('hourly' or 'daily')"),
    start_time: Optional[datetime] = Query(default=None, description="Start timestamp (UTC)"),
    end_time: Optional[datetime] = Query(default=None, description="End timestamp (UTC)"),
    db: Session = Depends(get_db),
) -> GenerationAnalyticsResponse:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    end = normalize_datetime(end_time) or now
    default_delta = timedelta(hours=24) if interval == "hourly" else timedelta(days=30)
    start = normalize_datetime(start_time) or (end - default_delta)

    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_time must be less than or equal to end_time.",
        )

    return analytics_service.get_generation_trends(
        db,
        plant_id=plant_id,
        inverter_id=inverter_id,
        interval=interval,
        start_time=start,
        end_time=end,
    )


@router.get(
    "/energy-loss",
    response_model=EnergyLossAnalyticsResponse,
    summary="Get Energy Loss Breakdown",
    description="Retrieve categorized and daily energy deficit and financial impact caused by faults and soiling.",
)
def get_energy_loss(
    plant_id: Optional[int] = Query(default=None, description="Optional plant ID filter"),
    start_time: Optional[datetime] = Query(default=None, description="Start timestamp (UTC)"),
    end_time: Optional[datetime] = Query(default=None, description="End timestamp (UTC)"),
    db: Session = Depends(get_db),
) -> EnergyLossAnalyticsResponse:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    end = normalize_datetime(end_time) or now
    start = normalize_datetime(start_time) or (end - timedelta(days=30))

    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_time must be less than or equal to end_time.",
        )

    return analytics_service.get_energy_loss_breakdown(
        db,
        plant_id=plant_id,
        start_time=start,
        end_time=end,
    )


@router.get(
    "/fault-distribution",
    response_model=FaultDistributionResponse,
    summary="Get Fault Distribution",
    description="Retrieve distribution of AI diagnoses across categories, severities, and operational statuses.",
)
def get_fault_distribution(
    plant_id: Optional[int] = Query(default=None, description="Optional plant ID filter"),
    start_time: Optional[datetime] = Query(default=None, description="Start timestamp (UTC)"),
    end_time: Optional[datetime] = Query(default=None, description="End timestamp (UTC)"),
    db: Session = Depends(get_db),
) -> FaultDistributionResponse:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    end = normalize_datetime(end_time) or now
    start = normalize_datetime(start_time) or (end - timedelta(days=30))

    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_time must be less than or equal to end_time.",
        )

    return analytics_service.get_fault_distribution(
        db,
        plant_id=plant_id,
        start_time=start,
        end_time=end,
    )
