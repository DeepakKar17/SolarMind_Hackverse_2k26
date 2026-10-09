"""Pydantic schemas for PVAsset resources (PV strings, MPPT channels)."""

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class PVAssetBase(BaseModel):
    """Shared base properties for PVAsset schemas."""

    asset_type: str = Field(default="STRING", max_length=40, description="Asset classification ('STRING', 'MPPT', 'MODULE_ARRAY')")
    identifier: str = Field(min_length=1, max_length=60, description="Label/identifier (e.g. 'String 1', 'MPPT-1')")
    capacity_kwp: Optional[float] = Field(default=None, gt=0.0, description="Installed DC capacity in kWp")
    panel_count: Optional[int] = Field(default=None, ge=1, le=100, description="Number of series-connected PV modules")
    panel_model: Optional[str] = Field(default=None, max_length=100, description="Solar module model specification")
    azimuth_deg: Optional[float] = Field(default=None, ge=0.0, le=360.0, description="Azimuth angle (0° to 360°)")
    tilt_deg: Optional[float] = Field(default=None, ge=0.0, le=90.0, description="Tilt angle (0° to 90°)")
    configuration: Optional[Dict[str, Any]] = Field(default=None, description="Extended electrical metadata & specs")


class PVAssetCreate(PVAssetBase):
    """Payload for registering a new PVAsset."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=2, max_length=60, description="Unique asset ID (e.g. 'PVA-INV101-STR1')")
    inverter_id: str = Field(min_length=2, max_length=50, description="Parent inverter identifier")
    status: str = Field(default="NORMAL", max_length=30, description="Initial operating status")


class PVAssetUpdate(BaseModel):
    """Payload for updating a PVAsset."""

    model_config = ConfigDict(extra="forbid")

    asset_type: Optional[str] = Field(default=None, max_length=40)
    identifier: Optional[str] = Field(default=None, min_length=1, max_length=60)
    capacity_kwp: Optional[float] = Field(default=None, gt=0.0)
    panel_count: Optional[int] = Field(default=None, ge=1, le=100)
    panel_model: Optional[str] = Field(default=None, max_length=100)
    azimuth_deg: Optional[float] = Field(default=None, ge=0.0, le=360.0)
    tilt_deg: Optional[float] = Field(default=None, ge=0.0, le=90.0)
    configuration: Optional[Dict[str, Any]] = Field(default=None)
    status: Optional[str] = Field(default=None, max_length=30)


class PVAssetResponse(PVAssetBase):
    """Response schema representing a PVAsset."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(description="Unique asset identifier")
    inverter_id: str = Field(description="Parent inverter identifier")
    status: str = Field(description="Operating status")
    created_at: datetime = Field(description="Record creation timestamp in UTC")
    updated_at: datetime = Field(description="Record last modification timestamp in UTC")
