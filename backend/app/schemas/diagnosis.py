"""Pydantic schemas for Fault Diagnosis and AI analysis records."""

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class DiagnosisBase(BaseModel):
    """Shared base properties for Diagnosis schemas."""

    fault_class: str = Field(min_length=2, max_length=60, description="Fault classification code (e.g. 'STRING_OPEN_CIRCUIT', 'PARTIAL_SHADING')")
    fault_title: str = Field(min_length=2, max_length=150, description="Human-readable title describing the anomaly")
    severity: str = Field(default="WARNING", max_length=20, description="Severity rating ('LOW', 'MEDIUM', 'WARNING', 'HIGH', 'CRITICAL')")
    engine_type: str = Field(default="ML_CLASSIFIER", max_length=40, description="Inference engine ('ML_CLASSIFIER', 'DETERMINISTIC_RULE', 'HYBRID', 'HEURISTIC')")
    confidence_score: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Model confidence score between 0.0 and 1.0 (NULL for deterministic rules)")
    rule_score: Optional[float] = Field(default=None, ge=0.0, description="Rule-engine evaluation score")
    is_suspicion_only: bool = Field(default=False, description="True if evidence is insufficient to confirm definite fault")
    has_insufficient_evidence: bool = Field(default=False, description="True if telemetry samples are sparse")
    status: str = Field(default="ACTIVE", max_length=30, description="Status ('ACTIVE', 'CONFIRMED', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE')")
    probable_cause: str = Field(min_length=5, description="Technical explanation of probable fault cause")
    root_cause_summary: str = Field(min_length=5, description="Executive summary of diagnosed issue")
    data_quality_warning: Optional[str] = Field(default=None, description="Notice regarding sensor gaps or noise")
    recommended_action: Optional[str] = Field(default=None, description="Actionable repair or maintenance advice")
    evidence: Optional[Dict[str, Any]] = Field(default=None, description="Discrepancy measurements & telemetry snapshot")
    estimated_lost_energy_kwh: Optional[float] = Field(default=None, ge=0.0, description="Projected energy loss in kWh/day")
    cumulative_lost_energy_kwh: Optional[float] = Field(default=None, ge=0.0, description="Cumulative lost energy in kWh")
    financial_deficit_inr: Optional[float] = Field(default=None, ge=0.0, description="Estimated financial loss in local currency (INR)")


class DiagnosisCreate(DiagnosisBase):
    """Payload for creating a new Diagnosis."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=2, max_length=50, description="Unique diagnosis ID (e.g. 'DIAG-401')")
    plant_id: int = Field(ge=1, description="Associated plant ID")
    inverter_id: Optional[str] = Field(default=None, max_length=50, description="Associated inverter ID")
    pv_asset_id: Optional[str] = Field(default=None, max_length=60, description="Associated PV asset ID")
    affected_string: Optional[str] = Field(default=None, max_length=100, description="Identifier of affected string")
    detected_at: Optional[datetime] = Field(default=None, description="Detection timestamp in UTC (defaults to current time if omitted)")


class DiagnosisUpdate(BaseModel):
    """Payload for updating an existing Diagnosis."""

    model_config = ConfigDict(extra="forbid")

    severity: Optional[str] = Field(default=None, max_length=20)
    status: Optional[str] = Field(default=None, max_length=30)
    confidence_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    probable_cause: Optional[str] = Field(default=None, min_length=5)
    root_cause_summary: Optional[str] = Field(default=None, min_length=5)
    recommended_action: Optional[str] = Field(default=None)
    evidence: Optional[Dict[str, Any]] = Field(default=None)
    estimated_lost_energy_kwh: Optional[float] = Field(default=None, ge=0.0)
    cumulative_lost_energy_kwh: Optional[float] = Field(default=None, ge=0.0)
    financial_deficit_inr: Optional[float] = Field(default=None, ge=0.0)
    resolved_at: Optional[datetime] = Field(default=None, description="Resolution timestamp in UTC")


class DiagnosisResponse(DiagnosisBase):
    """Response schema representing a Diagnosis."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(description="Unique diagnosis ID")
    plant_id: int = Field(description="Associated plant ID")
    inverter_id: Optional[str] = Field(default=None, description="Associated inverter ID")
    pv_asset_id: Optional[str] = Field(default=None, description="Associated PV asset ID")
    affected_string: Optional[str] = Field(default=None, description="Affected string identifier")
    detected_at: datetime = Field(description="Detection timestamp in UTC")
    resolved_at: Optional[datetime] = Field(default=None, description="Resolution timestamp in UTC")
    created_at: datetime = Field(description="Record creation timestamp in UTC")
    updated_at: datetime = Field(description="Record last modification timestamp in UTC")


class DiagnosisAnalysisRequest(BaseModel):
    """Payload for triggering on-demand fault analysis."""

    model_config = ConfigDict(extra="forbid")

    plant_id: int = Field(ge=1, description="Target plant ID to analyze")
    inverter_id: Optional[str] = Field(default=None, max_length=50, description="Optional specific inverter ID")
    lookback_hours: int = Field(default=24, ge=1, le=720, description="Analysis lookback window in hours (1-720)")
    dry_run: bool = Field(default=False, description="If true, returns detected faults without persisting to DB")


class DiagnosisAnalysisResponse(BaseModel):
    """Response payload for on-demand fault diagnosis analysis run."""

    plant_id: int = Field(description="Analyzed plant ID")
    inverters_analyzed: int = Field(ge=0, description="Total inverters evaluated")
    telemetry_samples_evaluated: int = Field(ge=0, description="Total telemetry records processed")
    anomalies_detected: int = Field(ge=0, description="Total anomalies identified")
    new_diagnoses_created: int = Field(ge=0, description="New diagnoses persisted to database")
    diagnoses: list[DiagnosisResponse] = Field(default_factory=list, description="List of detected diagnoses")

