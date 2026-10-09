"""Pydantic schemas for Technician field service dashboard and job executions."""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.work_order import WorkOrderResponse


class TechnicianDashboardResponse(BaseModel):
    """Field service overview metrics for the authenticated technician."""

    assigned_work_orders_count: int = Field(description="Total work orders assigned to this technician")
    in_progress_count: int = Field(description="Work orders actively under inspection/repair")
    high_priority_count: int = Field(description="High and critical priority jobs")
    completed_today_count: int = Field(description="Jobs verified and completed today")
    assigned_plants_count: int = Field(description="Number of solar plants with active assignments")
    recent_work_orders: List[WorkOrderResponse] = Field(default_factory=list, description="Latest assigned job queue")


class TechnicianInspectionRequest(BaseModel):
    """Payload for submitting field inspection findings."""

    model_config = ConfigDict(extra="forbid")

    findings: str = Field(..., min_length=5, description="Technician diagnostic observations and condition evaluation")
    status: Optional[str] = Field(default="IN_PROGRESS", description="Updated work order status ('IN_PROGRESS', 'PENDING')")
    notes: Optional[str] = Field(default=None, description="Internal field notes")


class TechnicianCompletionRequest(BaseModel):
    """Payload for verifying and completing a maintenance intervention."""

    model_config = ConfigDict(extra="forbid")

    resolution_notes: str = Field(..., min_length=5, description="Summary of repairs, replacements, and verification testing")
    duration_hours: Optional[float] = Field(default=None, ge=0.0, description="Hours spent executing intervention")
    cost_inr: Optional[float] = Field(default=0.0, ge=0.0, description="Total parts or service cost in INR")
    parts_used: Optional[str] = Field(default=None, description="Description or part numbers replaced")
    notes: Optional[str] = Field(default=None, description="Technician completion notes")
