"""
Pydantic schemas for SolarMind Energy Loss Estimation & Recommendation Service.

Models telemetry-driven energy shortfall, financial deficit accounting,
attribution partitioning, baseline comparison, data coverage auditing, and
evidence-grounded priority ranking.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class BaselineMethod(str, Enum):
    """Method used to establish expected generation baseline."""
    PHYSICS_POA_IRRADIANCE = "PHYSICS_POA_IRRADIANCE"
    CLEAR_SKY_SOLAR_GEOMETRY = "CLEAR_SKY_SOLAR_GEOMETRY"
    HEALTHY_HISTORICAL_BENCHMARK = "HEALTHY_HISTORICAL_BENCHMARK"
    NAMEPLATE_DERATED_CAPACITY = "NAMEPLATE_DERATED_CAPACITY"
    HYBRID_PHYSICS_HISTORICAL = "HYBRID_PHYSICS_HISTORICAL"
    USER_SUPPLIED_BASELINE = "USER_SUPPLIED_BASELINE"


class LossCertainty(str, Enum):
    """Certainty level of the energy shortfall calculation."""
    CONFIRMED_LOSS = "CONFIRMED_LOSS"
    ESTIMATED_POTENTIAL_LOSS = "ESTIMATED_POTENTIAL_LOSS"
    CIRCUMSTANTIAL_SUSPICION = "CIRCUMSTANTIAL_SUSPICION"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class InspectionPriorityLevel(str, Enum):
    """Composite priority rating for maintenance recommendations."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFORMATIONAL = "INFORMATIONAL"


class TelemetryIntervalPoint(BaseModel):
    """Individual interval reading for energy loss timeseries integration."""

    model_config = ConfigDict(extra="forbid")

    timestamp: datetime = Field(description="Reading timestamp in UTC")
    actual_power_kw: Optional[float] = Field(default=None, ge=0.0, description="Measured AC generation power in kW")
    expected_power_kw: Optional[float] = Field(default=None, ge=0.0, description="Expected power from baseline in kW")
    poa_irradiance_wm2: Optional[float] = Field(default=None, ge=0.0, description="Plane-of-array irradiance in W/m²")
    ambient_temp_c: Optional[float] = Field(default=None, description="Ambient temperature in °C")
    inverter_status: Optional[str] = Field(default=None, description="Operational status string")
    is_valid: bool = Field(default=True, description="False if sensor reading is corrupted or dropped")


class FaultAttributionItem(BaseModel):
    """Attribution breakdown of energy loss across multiple concurrent causes."""

    model_config = ConfigDict(extra="forbid")

    cause_name: str = Field(description="Fault category or identifier (e.g. 'GRID_OUTAGE', 'DC_GROUND_FAULT', 'THERMAL_DERATING')")
    allocated_shortfall_kwh: float = Field(ge=0.0, description="Attributed energy loss in kWh")
    percentage_of_total: float = Field(ge=0.0, le=100.0, description="Percentage of total observed shortfall")
    attribution_rationale: str = Field(description="Empirical basis for allocating this portion")


class PriorityRankingScore(BaseModel):
    """Transparent, documented multi-factor priority score."""

    model_config = ConfigDict(extra="forbid")

    composite_score: float = Field(ge=0.0, le=100.0, description="Final composite priority score (0-100)")
    priority_level: InspectionPriorityLevel = Field(description="Categorical priority level")
    severity_component: float = Field(description="Points contributed by fault severity (max 40)")
    impact_component: float = Field(description="Points contributed by energy / financial deficit (max 30)")
    duration_component: float = Field(description="Points contributed by fault persistence / duration (max 15)")
    evidence_component: float = Field(description="Points contributed by data coverage & confidence (max 15)")
    ranking_formula_explanation: str = Field(description="Detailed explanation of how the score was computed")


class InspectionRecommendationDetail(BaseModel):
    """Actionable maintenance recommendation grounded in observed evidence."""

    model_config = ConfigDict(extra="forbid")

    action_title: str = Field(description="Concise action directive (e.g. 'Inspect String 2 MC4 Connectors')")
    recommended_priority: InspectionPriorityLevel = Field(description="Priority rating")
    suggested_timeline: str = Field(description="Execution deadline guidance (e.g. 'Within 4 hours', 'Next scheduled visit')")
    evidence_grounding: str = Field(description="Explanation of why this action is recommended based on telemetry")
    safety_precautions: List[str] = Field(default_factory=list, description="Manufacturer electrical hazard warnings")
    tools_required: List[str] = Field(default_factory=list, description="Recommended diagnostic tools")


class DataCoverageAudit(BaseModel):
    """Audit of data freshness, sample density, and gaps over the evaluation window."""

    model_config = ConfigDict(extra="forbid")

    total_expected_samples: int = Field(ge=0, description="Expected sample count based on nominal interval")
    valid_samples_received: int = Field(ge=0, description="Actual non-corrupt samples processed")
    missing_samples_count: int = Field(ge=0, description="Missing intervals or null readings")
    coverage_percentage: float = Field(ge=0.0, le=100.0, description="Percentage of valid data coverage")
    nominal_interval_minutes: float = Field(gt=0, description="Nominal sampling interval in minutes")
    is_sufficient_for_integration: bool = Field(description="True if data meets minimum requirements for energy integration")


class EnergyLossEstimationRequest(BaseModel):
    """Input payload for estimating energy shortfall and impact."""

    model_config = ConfigDict(extra="forbid")

    plant_id: int = Field(ge=1, description="Associated plant ID")
    inverter_id: Optional[str] = Field(default=None, description="Target inverter ID")
    installed_capacity_kwp: float = Field(gt=0.0, description="Installed DC plant/inverter capacity in kWp")
    start_time: datetime = Field(description="Evaluation interval start timestamp (UTC)")
    end_time: datetime = Field(description="Evaluation interval end timestamp (UTC)")
    readings: List[TelemetryIntervalPoint] = Field(default_factory=list, description="Timeseries telemetry points")
    expected_baseline_kwh: Optional[float] = Field(default=None, ge=0.0, description="Optional pre-computed aggregate baseline energy in kWh")
    actual_generation_kwh: Optional[float] = Field(default=None, ge=0.0, description="Optional pre-computed aggregate actual generation in kWh")
    tariff_rate_inr: Optional[float] = Field(default=None, ge=0.0, description="Applicable electricity tariff in ₹ per kWh")
    baseline_method: BaselineMethod = Field(default=BaselineMethod.PHYSICS_POA_IRRADIANCE, description="Baseline estimation methodology")
    fault_codes: List[str] = Field(default_factory=list, description="Active manufacturer fault/alarm codes")
    concurrent_diagnoses: List[Dict[str, Any]] = Field(default_factory=list, description="Concurrent active diagnoses during this period")
    inverter_manufacturer: Optional[str] = Field(default=None, description="Inverter OEM name")
    inverter_model: Optional[str] = Field(default=None, description="Inverter model")


class EnergyLossEstimationResponse(BaseModel):
    """Comprehensive energy loss estimation and maintenance recommendation output."""

    model_config = ConfigDict(extra="forbid")

    plant_id: int
    inverter_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    duration_hours: float = Field(ge=0.0, description="Total duration of evaluation interval in hours")

    # Generation Breakdown
    expected_generation_kwh: float = Field(ge=0.0, description="Total expected generation under healthy baseline")
    observed_generation_kwh: float = Field(ge=0.0, description="Actual observed energy produced")
    estimated_shortfall_kwh: float = Field(ge=0.0, description="Total energy loss (expected - observed)")
    confirmed_loss_kwh: float = Field(ge=0.0, description="Portion of shortfall confirmed by verified fault telemetry")
    potential_loss_kwh: float = Field(ge=0.0, description="Portion of shortfall based on circumstantial/unverified conditions")

    # Financial Deficit
    tariff_rate_inr: Optional[float] = Field(default=None, description="Tariff rate used in calculation (₹/kWh)")
    estimated_financial_impact_inr: Optional[float] = Field(default=None, description="Estimated financial loss in ₹ (None if tariff missing)")

    # Baseline & Methodological Context
    baseline_method: BaselineMethod
    calculation_method: str = Field(description="Numerical integration method (e.g. 'TRAPEZOIDAL_INTEGRATION_15MIN')")
    loss_certainty: LossCertainty = Field(description="Certainty classification of the estimate")

    # Attribution Breakdown (Multi-Cause)
    attribution_breakdown: List[FaultAttributionItem] = Field(default_factory=list, description="Partitioning across concurrent fault causes")

    # Audit & Limitations
    data_coverage: DataCoverageAudit
    assumptions: List[str] = Field(default_factory=list, description="Explicit modeling assumptions")
    uncertainty_limitations: List[str] = Field(default_factory=list, description="Explicit uncertainty factors and data caveats")

    # Priority & Recommendations
    priority_ranking: PriorityRankingScore
    recommendations: List[InspectionRecommendationDetail] = Field(default_factory=list, description="Ranked maintenance recommendations")
