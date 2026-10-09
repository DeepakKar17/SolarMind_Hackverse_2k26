"""
Pydantic schemas for Background Job Processing & Lifecycle Tracking.

Exposes job lifecycle state, timestamps, retry counts, sanitized error logs,
and structured task execution outputs.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class JobStatus(str, Enum):
    """Lifecycle states for background processing jobs."""
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    NOT_CONFIGURED = "NOT_CONFIGURED"


class JobCreate(BaseModel):
    """Payload for submitting a background processing job."""

    model_config = ConfigDict(extra="forbid")

    job_type: str = Field(description="Task category (e.g. 'PHOTO_ANALYSIS', 'DIAGNOSIS_EVALUATION', 'WEATHER_SYNC')")
    resource_id: str = Field(description="Target resource identifier (e.g. 'PHOTO-001', 'DIAG-101', 'PLANT-1')")
    plant_id: Optional[int] = Field(default=None, description="Optional plant context")
    max_retries: int = Field(default=3, ge=0, le=5, description="Maximum permitted automated retries")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Job parameters and contextual execution metadata")


class JobResponse(BaseModel):
    """Response schema representing background job status."""

    model_config = ConfigDict(extra="forbid")

    job_id: str = Field(description="Unique job identifier")
    job_type: str = Field(description="Task type")
    resource_id: str = Field(description="Associated resource identifier")
    plant_id: Optional[int] = None
    status: JobStatus = Field(description="Current job lifecycle state")
    created_at: datetime = Field(description="Job creation timestamp in UTC")
    started_at: Optional[datetime] = Field(default=None, description="Processing start timestamp in UTC")
    completed_at: Optional[datetime] = Field(default=None, description="Completion timestamp in UTC")
    retry_count: int = Field(default=0, ge=0, description="Number of execution attempts made")
    max_retries: int = Field(default=3, ge=0, description="Maximum allowed retries")
    is_retryable: bool = Field(default=True, description="Whether job can be safely retried")
    error_message: Optional[str] = Field(default=None, description="Sanitized failure explanation (no secrets)")
    result_payload: Optional[Dict[str, Any]] = Field(default=None, description="Execution outputs when completed")
