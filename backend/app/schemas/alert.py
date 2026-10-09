"""Pydantic schemas for Alert resources."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class AlertBase(BaseModel):
    """Shared base properties for Alert schemas."""

    severity: str = Field(default="WARNING", max_length=20, description="Severity rating ('INFO', 'WARNING', 'HIGH', 'CRITICAL')")
    code: str = Field(min_length=2, max_length=80, description="Machine-readable alarm code (e.g. 'FAULT_STRING_DISCONNECTED')")
    source: str = Field(default="INVERTER_EVENT", max_length=40, description="Alert origin ('INVERTER_EVENT', 'RULE_ENGINE', 'ML_INSPECTION', 'MANUAL')")
    message: str = Field(min_length=3, description="Descriptive alarm message")
    estimated_power_loss_kw: Optional[float] = Field(default=None, ge=0.0, description="Instantaneous power loss in kW")
    estimated_daily_loss_kwh: Optional[float] = Field(default=None, ge=0.0, description="Projected daily energy loss in kWh")
    actionable_guidance: Optional[str] = Field(default=None, description="Recommended remediation instruction")


class AlertCreate(AlertBase):
    """Payload for creating a new Alert."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=2, max_length=50, description="Unique alert ID (e.g. 'ALT-901')")
    plant_id: int = Field(ge=1, description="Associated plant ID")
    inverter_id: Optional[str] = Field(default=None, max_length=50, description="Associated inverter ID")
    pv_asset_id: Optional[str] = Field(default=None, max_length=60, description="Associated PV asset ID")
    related_diagnosis_id: Optional[str] = Field(default=None, max_length=50, description="Optional linked diagnosis ID")
    string_id: Optional[str] = Field(default=None, max_length=100, description="Affected string identifier")
    status: str = Field(default="ACTIVE", max_length=30, description="Alarm state ('ACTIVE', 'RESOLVED', 'MUTED')")
    event_timestamp: Optional[datetime] = Field(default=None, description="Event occurrence timestamp in UTC")


class AlertAcknowledge(BaseModel):
    """Payload for acknowledging an active Alert."""

    model_config = ConfigDict(extra="forbid")

    acknowledged_by: str = Field(min_length=2, max_length=100, description="User / Operator acknowledging the alarm")


class AlertUpdate(BaseModel):
    """Payload for updating an Alert status."""

    model_config = ConfigDict(extra="forbid")

    severity: Optional[str] = Field(default=None, max_length=20)
    status: Optional[str] = Field(default=None, max_length=30)
    actionable_guidance: Optional[str] = Field(default=None)
    resolved_at: Optional[datetime] = Field(default=None, description="Resolution timestamp in UTC")


class AlertResponse(AlertBase):
    """Response schema representing an Alert."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(description="Unique alert ID")
    plant_id: int = Field(description="Associated plant ID")
    inverter_id: Optional[str] = Field(default=None, description="Associated inverter ID")
    pv_asset_id: Optional[str] = Field(default=None, description="Associated PV asset ID")
    related_diagnosis_id: Optional[str] = Field(default=None, description="Linked diagnosis ID")
    string_id: Optional[str] = Field(default=None, description="Affected string identifier")
    status: str = Field(description="Alert status")
    event_timestamp: datetime = Field(description="Event timestamp in UTC")
    acknowledged: bool = Field(description="Acknowledgement state")
    acknowledged_by: Optional[str] = Field(default=None, description="User who acknowledged")
    acknowledged_at: Optional[datetime] = Field(default=None, description="Acknowledgement timestamp in UTC")
    resolved_at: Optional[datetime] = Field(default=None, description="Resolution timestamp in UTC")
    created_at: datetime = Field(description="Record creation timestamp in UTC")
    updated_at: datetime = Field(description="Record last modification timestamp in UTC")
