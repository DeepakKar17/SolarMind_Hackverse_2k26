"""Pydantic schemas for WorkOrder resources (maintenance tickets) and verification workflows."""

from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ChecklistItem(BaseModel):
    """Structured checklist task item."""

    item: str = Field(min_length=2, description="Inspection task description")
    checked: bool = Field(default=False, description="True if task was inspected and verified")
    notes: Optional[str] = Field(default=None, description="Observation or measurement note for this item")


class WorkOrderBase(BaseModel):
    """Shared base properties for WorkOrder schemas."""

    title: str = Field(min_length=3, max_length=150, description="Work order summary title")
    priority: str = Field(default="HIGH", max_length=20, description="Priority rating ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')")
    assigned_to: str = Field(min_length=2, max_length=100, description="Assigned technician name or identifier")
    service_provider: Optional[str] = Field(default=None, max_length=100, description="External service provider / contractor name")
    instructions: Optional[str] = Field(default=None, description="Detailed repair and safety instructions")
    scheduled_date: date = Field(description="Scheduled service execution date")
    due_date: Optional[date] = Field(default=None, description="SLA target completion date")
    cost_inr: float = Field(default=0.0, ge=0.0, description="Estimated or actual repair cost (INR)")
    notes: Optional[str] = Field(default=None, description="General ticket notes")

    # Structured Checklist & Field Findings
    checklist: Optional[List[Dict[str, Any]]] = Field(default=None, description="Structured inspection checklist items")
    fault_observations: Optional[str] = Field(default=None, description="Field observations and diagnostic measurements")
    repair_action: Optional[str] = Field(default=None, description="Description of corrective repair actions executed")
    parts_replaced: Optional[List[str]] = Field(default=None, description="List of spare parts used or replaced")
    before_photo_id: Optional[str] = Field(default=None, max_length=60, description="Photo inspection ID prior to repair")
    after_photo_id: Optional[str] = Field(default=None, max_length=60, description="Photo inspection ID post repair")
    requires_follow_up: bool = Field(default=False, description="True if subsequent follow-up inspection is needed")
    follow_up_notes: Optional[str] = Field(default=None, description="Details regarding required follow-up service")


class WorkOrderCreate(WorkOrderBase):
    """Payload for creating a new WorkOrder."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=2, max_length=50, description="Unique work order ID (e.g. 'WO-801')")
    plant_id: int = Field(ge=1, description="Associated plant ID")
    inverter_id: Optional[str] = Field(default=None, max_length=50, description="Associated inverter ID")
    pv_asset_id: Optional[str] = Field(default=None, max_length=60, description="Associated PV asset ID")
    diagnosis_id: Optional[str] = Field(default=None, max_length=50, description="Optional linked diagnosis ID")
    status: str = Field(default="OPEN", max_length=40, description="Initial ticket status ('OPEN', 'ASSIGNED', 'IN_PROGRESS')")


class WorkOrderUpdate(BaseModel):
    """Payload for updating a WorkOrder."""

    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=3, max_length=150)
    priority: Optional[str] = Field(default=None, max_length=20)
    assigned_to: Optional[str] = Field(default=None, min_length=2, max_length=100)
    service_provider: Optional[str] = Field(default=None, max_length=100)
    instructions: Optional[str] = Field(default=None)
    scheduled_date: Optional[date] = Field(default=None)
    due_date: Optional[date] = Field(default=None)
    completed_date: Optional[date] = Field(default=None, description="Actual completion date")
    duration_hours: Optional[float] = Field(default=None, ge=0.0, description="Labor hours logged")
    cost_inr: Optional[float] = Field(default=None, ge=0.0)
    status: Optional[str] = Field(default=None, max_length=40)
    resolution_notes: Optional[str] = Field(default=None, description="Technician repair summary")
    notes: Optional[str] = Field(default=None)

    checklist: Optional[List[Dict[str, Any]]] = Field(default=None)
    fault_observations: Optional[str] = Field(default=None)
    repair_action: Optional[str] = Field(default=None)
    parts_replaced: Optional[List[str]] = Field(default=None)
    before_photo_id: Optional[str] = Field(default=None, max_length=60)
    after_photo_id: Optional[str] = Field(default=None, max_length=60)
    requires_follow_up: Optional[bool] = Field(default=None)
    follow_up_notes: Optional[str] = Field(default=None)


class WorkOrderInspectionSubmit(BaseModel):
    """Payload for technician submitting on-site inspection, repair notes, and completion."""

    model_config = ConfigDict(extra="forbid")

    checklist: Optional[List[Dict[str, Any]]] = Field(default=None, description="Completed inspection checklist")
    fault_observations: Optional[str] = Field(default=None, description="Observed root cause in field")
    repair_action: Optional[str] = Field(default=None, description="Corrective actions taken")
    parts_replaced: Optional[List[str]] = Field(default=None, description="Replacement components installed")
    before_photo_id: Optional[str] = Field(default=None, max_length=60)
    after_photo_id: Optional[str] = Field(default=None, max_length=60)
    duration_hours: Optional[float] = Field(default=None, ge=0.0)
    cost_inr: Optional[float] = Field(default=None, ge=0.0)
    requires_follow_up: bool = Field(default=False)
    follow_up_notes: Optional[str] = Field(default=None)
    resolution_notes: Optional[str] = Field(default=None)
    mark_completed: bool = Field(default=True, description="If True, moves status to COMPLETED_PENDING_VERIFICATION")


class WorkOrderVerificationRequest(BaseModel):
    """Payload to trigger post-repair electrical recovery verification."""

    model_config = ConfigDict(extra="forbid")

    verification_window_hours: int = Field(default=4, ge=1, le=48, description="Post-repair evaluation duration in hours")
    auto_close_on_success: bool = Field(default=False, description="If True, transitions work order to CLOSED if verified full recovery")
    reference_time: Optional[datetime] = Field(default=None, description="Anchor timestamp for verification window (defaults to UTC now)")


class WorkOrderVerificationResponse(BaseModel):
    """Results of post-repair generation recovery evaluation."""

    work_order_id: str
    plant_id: int
    inverter_id: Optional[str]
    verification_status: str = Field(description="'VERIFIED_FULL_RECOVERY' | 'PARTIAL_RECOVERY' | 'INCONCLUSIVE' | 'INSUFFICIENT_DATA'")
    is_verified: bool = Field(description="True if generation recovery is affirmatively verified")
    actual_post_repair_power_kw: Optional[float] = Field(default=None)
    expected_baseline_power_kw: Optional[float] = Field(default=None)
    pre_repair_power_kw: Optional[float] = Field(default=None)
    recovery_ratio_pct: Optional[float] = Field(default=None)
    weather_context: Dict[str, Any] = Field(default_factory=dict)
    summary: str
    recommendation: str
    verified_at: datetime


class WorkOrderStatusHistoryResponse(BaseModel):
    """Audit entry for a work order state transition."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    work_order_id: str
    from_status: Optional[str]
    to_status: str
    changed_by_email: Optional[str]
    notes: Optional[str]
    timestamp: datetime


class WorkOrderResponse(WorkOrderBase):
    """Response schema representing a WorkOrder."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(description="Unique work order ID")
    plant_id: int = Field(description="Associated plant ID")
    inverter_id: Optional[str] = Field(default=None, description="Associated inverter ID")
    pv_asset_id: Optional[str] = Field(default=None, description="Associated PV asset ID")
    diagnosis_id: Optional[str] = Field(default=None, description="Linked diagnosis ID")
    status: str = Field(description="Current ticket status")
    verification_status: str = Field(description="Post-repair verification status")
    verification_details: Optional[Dict[str, Any]] = Field(default=None)
    completed_date: Optional[date] = Field(default=None, description="Actual completion date")
    duration_hours: Optional[float] = Field(default=None, description="Labor duration in hours")
    resolution_notes: Optional[str] = Field(default=None, description="Technician resolution notes")
    created_at: datetime = Field(description="Record creation timestamp in UTC")
    updated_at: datetime = Field(description="Record last modification timestamp in UTC")
