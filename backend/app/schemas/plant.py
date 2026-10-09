"""Pydantic schemas for Plant resources."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class PlantBase(BaseModel):
    """Shared base properties for Plant schemas."""

    name: str = Field(min_length=2, max_length=120, description="Plant name / site identifier")
    location: str = Field(min_length=2, max_length=200, description="Physical location or facility address")
    timezone: str = Field(default="UTC", max_length=50, description="IANA Timezone string (e.g. 'America/Los_Angeles')")
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0, description="GPS Latitude (-90 to +90 degrees)")
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0, description="GPS Longitude (-180 to +180 degrees)")
    system_type: str = Field(default="Single-String Residential Rooftop", max_length=60, description="Installation topology classification")
    installed_capacity_kwp: float = Field(gt=0.0, description="Installed DC capacity in kWp (must be > 0)")
    tariff_rate_inr: float = Field(default=7.50, ge=0.0, description="Electricity feed-in / grid tariff in local currency (INR) per kWh")


class PlantCreate(PlantBase):
    """Payload for creating a new Plant."""

    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="NORMAL", max_length=30, description="Initial operational status")
    is_active: bool = Field(default=True, description="Whether the plant is currently actively monitored")


class PlantUpdate(BaseModel):
    """Payload for updating an existing Plant (partial update)."""

    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    location: Optional[str] = Field(default=None, min_length=2, max_length=200)
    timezone: Optional[str] = Field(default=None, max_length=50)
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    system_type: Optional[str] = Field(default=None, max_length=60)
    installed_capacity_kwp: Optional[float] = Field(default=None, gt=0.0)
    tariff_rate_inr: Optional[float] = Field(default=None, ge=0.0)
    status: Optional[str] = Field(default=None, max_length=30)
    is_active: Optional[bool] = Field(default=None)


class PlantResponse(PlantBase):
    """Response schema representing a Plant with database-managed fields."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Unique internal plant identifier")
    status: str = Field(description="Current status (e.g. 'NORMAL', 'WARNING', 'FAULT', 'OFFLINE')")
    is_active: bool = Field(description="Active monitoring flag")
    created_at: datetime = Field(description="Record creation timestamp in UTC")
    updated_at: datetime = Field(description="Record last modification timestamp in UTC")


class PlantSummaryResponse(PlantResponse):
    """Extended plant representation with aggregate sub-asset counts."""

    inverters_count: int = Field(default=0, ge=0, description="Total number of connected inverters")
    active_alerts_count: int = Field(default=0, ge=0, description="Count of currently active alarms")
    current_power_kw: Optional[float] = Field(default=None, ge=0.0, description="Latest aggregated output power (kW)")
    daily_yield_kwh: Optional[float] = Field(default=None, ge=0.0, description="Total daily generation yield (kWh)")
