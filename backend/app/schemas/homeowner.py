"""Pydantic schemas for Homeowner dashboard and portal API."""

from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.alert import AlertResponse
from app.schemas.diagnosis import DiagnosisResponse
from app.schemas.plant import PlantResponse
from app.schemas.work_order import WorkOrderResponse


class HomeownerDashboardResponse(BaseModel):
    """Aggregated dashboard telemetry and asset status for residential homeowners."""

    total_plants: int = Field(description="Total solar installations owned by the homeowner")
    total_capacity_kwp: float = Field(description="Total installed DC capacity in kWp")
    today_generation_kwh: float = Field(description="Total electrical energy generated today in kWh")
    current_power_kw: float = Field(description="Instantaneous AC generation power in kW")
    expected_vs_actual_ratio: float = Field(default=1.0, description="Ratio of actual output against modeled baseline")
    energy_shortfall_kwh: float = Field(default=0.0, description="Estimated generation deficit in kWh")
    estimated_financial_savings_inr: float = Field(default=0.0, description="Calculated tariff savings in INR (₹)")
    health_score: float = Field(default=98.5, ge=0.0, le=100.0, description="Composite health index (0-100)")
    active_alerts_count: int = Field(description="Count of currently active alarms")
    open_work_orders_count: int = Field(description="Count of active maintenance intervention tickets")
    recent_diagnoses: List[DiagnosisResponse] = Field(default_factory=list, description="Latest AI fault dossiers")
    active_alerts: List[AlertResponse] = Field(default_factory=list, description="Active alerts requiring attention")
