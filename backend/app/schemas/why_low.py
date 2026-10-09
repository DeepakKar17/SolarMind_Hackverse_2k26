"""Pydantic schemas for SolarMind Expected Generation Engine and Why-Low Diagnostics."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class SolarPositionInfo(BaseModel):
    """Solar geometry and position metrics."""

    solar_elevation_deg: float = Field(description="Solar elevation angle above horizon in degrees")
    solar_zenith_deg: float = Field(description="Solar zenith angle from vertical in degrees")
    solar_azimuth_deg: float = Field(description="Solar azimuth angle clockwise from North in degrees")
    is_daylight: bool = Field(description="True if sun is above the operational horizon (elevation > 0°)")
    clear_sky_irradiance_wm2: float = Field(description="Modelled theoretical clear-sky POA irradiance in W/m²")


class ExpectedPowerCalculation(BaseModel):
    """Structured breakdown of expected generation output and baseline calculation."""

    installed_capacity_kwp: float = Field(ge=0.0, description="Plant or inverter DC installed capacity in kWp")
    expected_power_kw: float = Field(ge=0.0, description="Expected instantaneous generation in kW")
    baseline_method: str = Field(description="Method used to derive baseline (e.g. PHYSICAL_IRRADIANCE_AND_TEMPERATURE, CLEAR_SKY_SOLAR_POSITION, HISTORICAL_CALIBRATED_BENCHMARK)")
    solar_position: SolarPositionInfo = Field(description="Solar geometry data")
    temperature_derate_factor: float = Field(description="Thermal derating multiplier applied (1.0 = nominal at 25°C)")
    soiling_derate_factor: float = Field(description="Base clean transmission factor")
    inverter_efficiency: float = Field(description="Inverter conversion efficiency factor")
    inputs_used: Dict[str, Any] = Field(default_factory=dict, description="Summary of input values used for computation")


class WhyLowDiagnosticRequest(BaseModel):
    """Request payload to execute Why-Low diagnostic evaluation."""

    model_config = ConfigDict(extra="forbid")

    plant_id: int = Field(ge=1, description="Target plant ID to analyze")
    inverter_id: Optional[str] = Field(default=None, max_length=50, description="Optional specific inverter ID")
    timestamp: Optional[datetime] = Field(default=None, description="Target analysis timestamp in UTC (defaults to latest telemetry)")
    lookback_hours: int = Field(default=24, ge=1, le=168, description="Historical lookback window in hours for context")


class WhyLowDiagnosticResponse(BaseModel):
    """Comprehensive diagnostic result explaining observed generation and root causes."""

    plant_id: int = Field(description="Evaluated plant ID")
    inverter_id: Optional[str] = Field(default=None, description="Evaluated inverter ID")
    timestamp: datetime = Field(description="Evaluation timestamp in UTC")

    # Observed vs Expected Power
    observed_power_kw: float = Field(ge=0.0, description="Measured active AC power output in kW")
    expected_power_kw: float = Field(ge=0.0, description="Modelled expected power output in kW")
    baseline_method: str = Field(description="Baseline model used to compute expected power")

    # Yield Gap
    yield_gap_kw: float = Field(description="Absolute shortfall in kW: max(0, expected - observed)")
    yield_gap_pct: float = Field(ge=0.0, le=100.0, description="Percentage yield gap relative to expected power")

    # Diagnostic Outcome
    candidate_cause: str = Field(description="Standardized diagnostic cause identifier")
    candidate_cause_title: str = Field(description="Human-readable title describing the candidate cause")
    severity: str = Field(description="Severity rating ('NORMAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')")
    is_fault: bool = Field(description="True if this represents an actionable hardware or operational fault")

    # Evidence & Confidence
    supporting_evidence: List[str] = Field(default_factory=list, description="Factual evidence confirming the candidate cause")
    contradictory_evidence: List[str] = Field(default_factory=list, description="Counter-indicators or conflicting signals")
    confidence_score: float = Field(ge=0.0, le=1.0, description="Diagnostic confidence score between 0.0 and 1.0")
    rule_score: Optional[float] = Field(default=None, description="Rule-engine deterministic matching score")
    score_meaning: str = Field(description="Calibrated explanation of what the score reflects")
    data_coverage: float = Field(ge=0.0, le=1.0, description="Ratio of required telemetry measurements successfully verified")

    # Actionable Guidance
    evaluation_step_reached: int = Field(ge=1, le=10, description="Why-Low evaluation pipeline step (1-10) where conclusion was reached")
    recommended_next_check: str = Field(description="Defensible, actionable recommendation for technician or operator")
    solar_position: SolarPositionInfo = Field(description="Solar geometry context")
    raw_measurements: Dict[str, Any] = Field(default_factory=dict, description="Snapshot of telemetry and environmental values evaluated")
