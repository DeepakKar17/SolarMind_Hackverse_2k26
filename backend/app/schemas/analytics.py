"""Pydantic schemas for SolarMind Analytics, Generation Trends, Energy Loss, and Fault Distributions."""

from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class AnalyticsTimeseriesPoint(BaseModel):
    """Single aggregated data point for solar generation trends."""

    timestamp: datetime = Field(description="Bin start timestamp in UTC")
    actual_power_kw: float = Field(ge=0.0, description="Measured/integrated actual average power in kW")
    expected_power_kw: float = Field(ge=0.0, description="Clear-sky theoretical expected power in kW")
    actual_energy_kwh: float = Field(ge=0.0, description="Calculated actual energy yield in kWh (via interval integration)")
    expected_energy_kwh: float = Field(ge=0.0, description="Calculated expected energy yield in kWh")
    poa_irradiance_wm2: Optional[float] = Field(default=None, ge=0.0, description="Measured average Plane of Array irradiance (W/m²)")
    performance_ratio_pct: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Performance Ratio (PR %); NULL if irradiance missing")
    data_points_count: int = Field(default=0, ge=0, description="Number of raw telemetry samples in this interval")
    data_coverage_pct: float = Field(default=100.0, ge=0.0, le=100.0, description="Percentage of expected telemetry samples received")


class FaultCategorySummary(BaseModel):
    """Aggregated fault category breakdown and financial impact."""

    fault_class: str = Field(description="Fault classification code (e.g. 'STRING_OPEN_CIRCUIT')")
    fault_title: str = Field(description="Human-readable category title")
    incident_count: int = Field(ge=0, description="Number of diagnosed occurrences")
    total_lost_energy_kwh: float = Field(ge=0.0, description="Estimated total lost yield attributable to category (kWh)")
    total_financial_loss_inr: float = Field(ge=0.0, description="Estimated total financial loss in INR")
    percentage_of_total_loss: float = Field(ge=0.0, le=100.0, description="Percentage of total system loss")


class FaultSeveritySummary(BaseModel):
    """Aggregated fault count and loss by severity rating."""

    severity: str = Field(description="Severity tier ('LOW', 'MEDIUM', 'WARNING', 'HIGH', 'CRITICAL')")
    incident_count: int = Field(ge=0, description="Number of active or confirmed faults")
    total_lost_energy_kwh: float = Field(ge=0.0, description="Estimated lost energy in kWh")
    total_financial_loss_inr: float = Field(ge=0.0, description="Estimated financial loss in INR")


class MaintenanceSlaMetrics(BaseModel):
    """Maintenance response time, resolution time, and cost summary."""

    mean_time_to_acknowledge_hours: Optional[float] = Field(default=None, ge=0.0, description="Mean Time to Acknowledge (MTTA) in hours")
    mean_time_to_resolve_hours: Optional[float] = Field(default=None, ge=0.0, description="Mean Time to Resolve (MTTR) in hours")
    open_tickets_count: int = Field(ge=0, description="Active work orders currently in progress")
    completed_tickets_count: int = Field(ge=0, description="Total completed tickets in period")
    total_maintenance_spend_inr: float = Field(ge=0.0, description="Total maintenance expenditures (INR)")


class AnalyticsSummaryResponse(BaseModel):
    """Response payload for GET /api/v1/analytics/summary."""

    plant_id: Optional[int] = Field(default=None, description="Plant ID if filtered by specific plant, else fleet total")
    period_start: datetime = Field(description="Period start timestamp in UTC")
    period_end: datetime = Field(description="Period end timestamp in UTC")
    # Measured & Calculated Energy
    total_actual_generation_kwh: float = Field(ge=0.0, description="Calculated actual energy generated (kWh)")
    total_expected_generation_kwh: float = Field(ge=0.0, description="Estimated benchmark expected energy (kWh)")
    overall_performance_ratio_pct: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Calculated PR (%); NULL if irradiance unmeasured")
    # Loss & Financial
    total_lost_energy_kwh: float = Field(ge=0.0, description="Estimated total energy lost due to faults and degradation (kWh)")
    total_financial_loss_inr: Optional[float] = Field(default=None, ge=0.0, description="Estimated financial loss in INR; NULL if tariff unavailable")
    applicable_tariff_inr_kwh: Optional[float] = Field(default=None, ge=0.0, description="Tariff rate used for financial calculation (INR/kWh)")
    # Data Quality & Coverage
    telemetry_records_count: int = Field(ge=0, description="Total telemetry packets processed")
    data_coverage_pct: float = Field(ge=0.0, le=100.0, description="Data completeness ratio vs expected sampling frequency")
    calculation_methodology: str = Field(description="Defensible calculation note and baseline assumptions")
    maintenance_sla: MaintenanceSlaMetrics = Field(description="Maintenance SLA performance metrics")


class GenerationAnalyticsResponse(BaseModel):
    """Response payload for GET /api/v1/analytics/generation."""

    plant_id: Optional[int] = Field(default=None, description="Plant ID if filtered")
    inverter_id: Optional[str] = Field(default=None, description="Inverter ID if filtered")
    interval: str = Field(default="hourly", description="Aggregation bin size ('hourly' or 'daily')")
    period_start: datetime = Field(description="Start time in UTC")
    period_end: datetime = Field(description="End time in UTC")
    total_actual_kwh: float = Field(ge=0.0, description="Total actual generation in interval (kWh)")
    total_expected_kwh: float = Field(ge=0.0, description="Total expected generation in interval (kWh)")
    peak_power_kw: float = Field(ge=0.0, description="Peak actual power recorded (kW)")
    average_performance_ratio_pct: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Fleet/Plant average PR %")
    timeseries: List[AnalyticsTimeseriesPoint] = Field(default_factory=list, description="Aggregated timeseries bins")


class DailyLossPoint(BaseModel):
    """Daily energy loss breakdown point."""

    date: str = Field(description="Date in YYYY-MM-DD format")
    lost_energy_kwh: float = Field(ge=0.0, description="Lost yield on this date (kWh)")
    financial_loss_inr: Optional[float] = Field(default=None, ge=0.0, description="Financial loss on this date (INR)")
    dominant_fault_class: Optional[str] = Field(default=None, description="Primary fault category responsible for loss")


class EnergyLossAnalyticsResponse(BaseModel):
    """Response payload for GET /api/v1/analytics/energy-loss."""

    plant_id: Optional[int] = Field(default=None, description="Plant filter ID")
    period_start: datetime = Field(description="Start time in UTC")
    period_end: datetime = Field(description="End time in UTC")
    total_energy_lost_kwh: float = Field(ge=0.0, description="Total estimated energy lost (kWh)")
    total_financial_loss_inr: Optional[float] = Field(default=None, ge=0.0, description="Total estimated financial deficit (INR)")
    tariff_rate_inr: Optional[float] = Field(default=None, description="Tariff rate applied (INR/kWh)")
    baseline_methodology: str = Field(description="Documented baseline estimation method")
    daily_breakdown: List[DailyLossPoint] = Field(default_factory=list, description="Daily loss timeline")
    category_breakdown: List[FaultCategorySummary] = Field(default_factory=list, description="Loss by fault category")


class FaultDistributionResponse(BaseModel):
    """Response payload for GET /api/v1/analytics/fault-distribution."""

    plant_id: Optional[int] = Field(default=None, description="Plant filter ID")
    period_start: datetime = Field(description="Start time in UTC")
    period_end: datetime = Field(description="End time in UTC")
    total_diagnoses_count: int = Field(ge=0, description="Total faults evaluated")
    categories: List[FaultCategorySummary] = Field(default_factory=list, description="Distribution by fault category")
    severities: List[FaultSeveritySummary] = Field(default_factory=list, description="Distribution by severity rating")
    status_breakdown: Dict[str, int] = Field(default_factory=dict, description="Counts by status ('ACTIVE', 'CONFIRMED', 'RESOLVED')")


# Backwards compatibility alias
AnalyticsDashboardResponse = AnalyticsSummaryResponse
