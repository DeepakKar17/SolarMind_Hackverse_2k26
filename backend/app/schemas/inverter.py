"""Pydantic schemas for Inverter resources."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class InverterBase(BaseModel):
    """Shared base properties for Inverter schemas."""

    manufacturer: str = Field(min_length=1, max_length=80, description="Inverter OEM manufacturer (e.g. 'SMA Solar', 'Fronius')")
    model: str = Field(min_length=1, max_length=80, description="Inverter model designation (e.g. 'Sunny Tripower 5.0')")
    rated_ac_power_kw: float = Field(gt=0.0, description="Rated continuous AC power output in kW (must be > 0)")
    mppt_count: int = Field(default=1, ge=1, le=12, description="Number of MPPT tracker channels")
    strings_count: int = Field(default=1, ge=1, le=24, description="Number of connected PV strings")
    firmware_version: Optional[str] = Field(default=None, max_length=50, description="Installed firmware build version")


class InverterCreate(InverterBase):
    """Payload for registering a new Inverter."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=2, max_length=50, description="Unique string identifier (e.g. 'INV-101')")
    plant_id: int = Field(ge=1, description="Associated plant identifier")
    serial_number: str = Field(min_length=2, max_length=100, description="Unique manufacturer serial number")
    status: str = Field(default="NORMAL", max_length=30, description="Initial operational status")


class InverterUpdate(BaseModel):
    """Payload for updating an existing Inverter."""

    model_config = ConfigDict(extra="forbid")

    manufacturer: Optional[str] = Field(default=None, min_length=1, max_length=80)
    model: Optional[str] = Field(default=None, min_length=1, max_length=80)
    rated_ac_power_kw: Optional[float] = Field(default=None, gt=0.0)
    mppt_count: Optional[int] = Field(default=None, ge=1, le=12)
    strings_count: Optional[int] = Field(default=None, ge=1, le=24)
    firmware_version: Optional[str] = Field(default=None, max_length=50)
    status: Optional[str] = Field(default=None, max_length=30)


class InverterResponse(InverterBase):
    """Response schema representing an Inverter."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(description="Unique string identifier")
    plant_id: int = Field(description="Parent plant identifier")
    serial_number: str = Field(description="Unique manufacturer serial number")
    status: str = Field(description="Current status (e.g. 'NORMAL', 'WARNING', 'FAULT', 'OFFLINE')")
    last_telemetry_at: Optional[datetime] = Field(default=None, description="Timestamp of latest received telemetry in UTC")
    created_at: datetime = Field(description="Record creation timestamp in UTC")
    updated_at: datetime = Field(description="Record last modification timestamp in UTC")
