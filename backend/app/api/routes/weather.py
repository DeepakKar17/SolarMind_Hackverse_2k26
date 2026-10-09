"""API routes for Weather Intelligence, live observations, and forecasts."""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_optional_current_user
from app.core.permissions import enforce_plant_access
from app.db.session import get_db
from app.models.plant import Plant
from app.models.user import User
from app.schemas.weather import (
    CloudPerformanceAnalysisResponse,
    WeatherForecastResponse,
    WeatherObservationResponse,
    WeatherRecordCreate,
    WeatherRecordResponse,
)
from app.services.weather_service import weather_service

router = APIRouter(prefix="/weather", tags=["Weather Intelligence"])


@router.get(
    "/plants/{plant_id}/current",
    response_model=WeatherObservationResponse,
    summary="Get Current Weather Observation",
    description="Fetch live meteorological observation for plant location with caching and provider fallback.",
)
def get_current_weather(
    plant_id: int,
    force_refresh: bool = Query(default=False, description="Bypass cache and force fresh API fetch"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> WeatherObservationResponse:
    plant = db.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Plant '{plant_id}' not found.")

    if current_user:
        enforce_plant_access(current_user, plant)

    return weather_service.get_current_weather(db, plant_id=plant_id, force_refresh=force_refresh)


@router.get(
    "/plants/{plant_id}/forecast",
    response_model=WeatherForecastResponse,
    summary="Get Solar Weather Forecast",
    description="Retrieve multi-hour meteorological and solar irradiance forecast for plant coordinates.",
)
def get_weather_forecast(
    plant_id: int,
    hours: int = Query(default=48, ge=1, le=168, description="Forecast horizon in hours (1-168)"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> WeatherForecastResponse:
    plant = db.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Plant '{plant_id}' not found.")

    if current_user:
        enforce_plant_access(current_user, plant)

    return weather_service.get_weather_forecast(db, plant_id=plant_id, hours=hours)


@router.post(
    "/plants/{plant_id}/analyze-cloud",
    response_model=CloudPerformanceAnalysisResponse,
    summary="Analyze Cloud-Related Yield Impact",
    description="Evaluate whether current generation shortfall is justified by cloud cover vs potential system fault.",
)
def analyze_cloud_impact(
    plant_id: int,
    observed_power_kw: float = Query(..., ge=0.0, description="Observed active AC generation in kW"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> CloudPerformanceAnalysisResponse:
    plant = db.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Plant '{plant_id}' not found.")

    if current_user:
        enforce_plant_access(current_user, plant)

    return weather_service.analyze_cloud_vs_abnormal(
        db,
        plant_id=plant_id,
        observed_power_kw=observed_power_kw,
    )


@router.post(
    "/records",
    response_model=WeatherRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record On-Site Weather Observation",
    description="Ingest pyranometer or local meteorological station measurement.",
)
def create_weather_record(
    create_in: WeatherRecordCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> WeatherRecordResponse:
    plant = db.get(Plant, create_in.plant_id)
    if not plant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Plant '{create_in.plant_id}' not found.")

    if current_user:
        enforce_plant_access(current_user, plant)

    record = weather_service.record_weather_observation(db, create_in)
    return WeatherRecordResponse.model_validate(record)
