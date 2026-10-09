"""Pydantic schemas for Grid Interruption, Outage Events, and Detection Workflow."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class OutageEventBase(BaseModel):
    """Base fields for OutageEvent schemas."""

    event_type: str = Field(default="GRID_OUTAGE", max_length=50, description="'GRID_OUTAGE' | 'OVERVOLTAGE_TRIP' | 'UNDERVOLTAGE_SAG' | 'FREQUENCY_TRIP' | 'TELEMETRY_GAP_SUSPECTED' | 'MANUAL_CURTAILMENT'")
    status: str = Field(default="SUSPECTED", max_length=30, description="'SUSPECTED' | 'CONFIRMED' | 'RESOLVED'")
    start_time: datetime = Field(description="Outage start timestamp in UTC")
    end_time: Optional[datetime] = Field(default=None, description="Outage restoration timestamp in UTC (None if ongoing)")
    duration_minutes: Optional[float] = Field(default=None, ge=0.0, description="Outage duration in minutes")
    estimated_lost_energy_kwh: Optional[float] = Field(default=None, ge=0.0, description="Projected energy loss in kWh during daylight hours")
    estimated_financial_loss_inr: Optional[float] = Field(default=None, ge=0.0, description="Financial loss in INR based on tariff rate")
    reason: Optional[str] = Field(default=None, description="Technical description of the outage or interruption cause")
    evidence: Optional[Dict[str, Any]] = Field(default=None, description="Snapshot of electrical metrics (V_ac, V_dc, frequency, alerts)")
    detection_limitations: Optional[List[str]] = Field(default=None, description="Caveats regarding sensor fidelity or comms ambiguity")
    resolved: bool = Field(default=False, description="True if power export has successfully resumed")


class OutageEventCreate(OutageEventBase):
    """Payload to create an OutageEvent."""

    model_config = ConfigDict(extra="forbid")

    plant_id: int = Field(ge=1)
    inverter_id: Optional[str] = Field(default=None, max_length=50)


class OutageEventUpdate(BaseModel):
    """Payload to update/resolve an OutageEvent."""

    model_config = ConfigDict(extra="forbid")

    end_time: Optional[datetime] = Field(default=None)
    status: Optional[str] = Field(default=None, max_length=30)
    resolved: Optional[bool] = Field(default=None)
    reason: Optional[str] = Field(default=None)
    estimated_lost_energy_kwh: Optional[float] = Field(default=None, ge=0.0)
    estimated_financial_loss_inr: Optional[float] = Field(default=None, ge=0.0)
    evidence: Optional[Dict[str, Any]] = Field(default=None)
    detection_limitations: Optional[List[str]] = Field(default=None)


class OutageEventResponse(OutageEventBase):
    """Response representing an OutageEvent record."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    plant_id: int
    inverter_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class OutageDetectionRequest(BaseModel):
    """Payload to trigger grid interruption and outage evaluation."""

    model_config = ConfigDict(extra="forbid")

    plant_id: int = Field(ge=1, description="Target plant ID to evaluate")
    inverter_id: Optional[str] = Field(default=None, max_length=50, description="Optional specific inverter ID")
    start_time: Optional[datetime] = Field(default=None, description="Evaluation window start UTC (defaults to lookback)")
    end_time: Optional[datetime] = Field(default=None, description="Evaluation window end UTC (defaults to now)")
    lookback_hours: int = Field(default=24, ge=1, le=720, description="Lookback hours if start_time omitted")
    auto_persist: bool = Field(default=True, description="If True, persists detected outage events to database")


class OutageDetectionResponse(BaseModel):
    """Response payload summarizing detected grid interruption events."""

    plant_id: int
    inverters_evaluated: int
    telemetry_records_evaluated: int
    outages_detected: int
    new_outages_created: int
    events: List[OutageEventResponse] = Field(default_factory=list)
    summary_notes: str
