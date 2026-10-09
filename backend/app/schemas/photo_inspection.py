"""
Pydantic schemas for PhotoInspection resources and Vision AI outputs.

Models site inspection photo records, GPS coordinates, MIME validation,
vision pipeline status, and structured visual anomaly detections.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class VisualDetectionItem(BaseModel):
    """Individual visual defect or anomaly detected in photo."""

    model_config = ConfigDict(extra="forbid")

    defect_class: str = Field(description="Defect category ('SOILING', 'SHADING', 'SURFACE_CRACK', 'HOTSPOT_DISCOLORATION', 'DELAMINATION', 'VEGETATION')")
    description: str = Field(description="Description of visual observation")
    confidence: float = Field(ge=0.0, le=1.0, description="Model prediction confidence score")
    severity: str = Field(default="MEDIUM", description="Visual defect severity ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')")
    bounding_box: Optional[Dict[str, float]] = Field(default=None, description="Normalized bounding box coords {ymin, xmin, ymax, xmax}")
    is_visual_observation_only: bool = Field(default=True, description="True indicates visible surface observation distinct from internal electrical faults")


class VisionAnalysisResult(BaseModel):
    """Complete structured output from the Geo Photo AI vision pipeline."""

    model_config = ConfigDict(extra="forbid")

    status: str = Field(description="Processing status ('COMPLETED', 'NOT_CONFIGURED', 'FAILED')")
    model_name: Optional[str] = Field(default=None, description="Identifier of computer vision model used")
    model_version: Optional[str] = Field(default=None, description="Version string of model")
    detections: List[VisualDetectionItem] = Field(default_factory=list, description="List of visual defects found")
    summary: str = Field(description="Executive summary of visual inspection")
    electrical_testing_required: bool = Field(default=False, description="True if visual defect requires electrical multimeter/megger testing")
    recommended_actions: List[str] = Field(default_factory=list, description="Follow-up technician maintenance actions")
    processed_at: Optional[datetime] = Field(default=None, description="Processing timestamp in UTC")


class PhotoProcessingStatusResponse(BaseModel):
    """Status inquiry response for an uploaded photo."""

    model_config = ConfigDict(extra="forbid")

    photo_id: str
    processing_status: str = Field(description="'PENDING' | 'ANALYZING' | 'COMPLETED' | 'NOT_CONFIGURED' | 'FAILED'")
    uploaded_at: datetime
    is_analyzed: bool
    fault_detected: Optional[bool] = None
    confidence_score: Optional[float] = None
    message: str


class PhotoInspectionBase(BaseModel):
    """Shared base properties for PhotoInspection schemas."""

    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0, description="GPS Latitude (-90 to +90 degrees)")
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0, description="GPS Longitude (-180 to +180 degrees)")
    gps_accuracy_m: Optional[float] = Field(default=None, ge=0.0, description="GPS accuracy radius in meters")
    notes: Optional[str] = Field(default=None, description="Technician field inspection observations")


class PhotoInspectionCreate(PhotoInspectionBase):
    """Payload for registering an uploaded photo inspection record."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=2, max_length=50, description="Unique photo inspection ID (e.g. 'PHOTO-501')")
    plant_id: int = Field(ge=1, description="Associated plant ID")
    inverter_id: Optional[str] = Field(default=None, max_length=50, description="Associated inverter ID")
    pv_asset_id: Optional[str] = Field(default=None, max_length=60, description="Associated PV asset ID")
    diagnosis_id: Optional[str] = Field(default=None, max_length=50, description="Optional linked diagnosis ID")
    image_path: str = Field(min_length=1, max_length=255, description="Relative storage file path / URL (no binary, no absolute OS path)")
    original_filename: Optional[str] = Field(default=None, max_length=255, description="Client uploaded filename")
    file_size_bytes: Optional[int] = Field(default=None, ge=0, description="File size in bytes")
    mime_type: str = Field(default="image/jpeg", max_length=50, description="MIME content type")
    uploaded_at: datetime = Field(description="Upload timestamp in UTC")


class PhotoInspectionUpdate(BaseModel):
    """Payload for updating a PhotoInspection (e.g. by Vision AI background worker)."""

    model_config = ConfigDict(extra="forbid")

    processing_status: Optional[str] = Field(default=None, max_length=30, description="Status ('PENDING', 'ANALYZING', 'COMPLETED', 'NOT_CONFIGURED', 'FAILED')")
    analysis_result: Optional[Dict[str, Any]] = Field(default=None, description="Vision AI bounding boxes and tag annotations")
    fault_detected: Optional[bool] = Field(default=None, description="Whether visual anomalies were detected")
    confidence_score: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Vision model confidence score")
    notes: Optional[str] = Field(default=None)


class PhotoInspectionResponse(PhotoInspectionBase):
    """Response schema representing a PhotoInspection record."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(description="Unique photo inspection ID")
    plant_id: int = Field(description="Associated plant ID")
    inverter_id: Optional[str] = Field(default=None, description="Associated inverter ID")
    pv_asset_id: Optional[str] = Field(default=None, description="Associated PV asset ID")
    diagnosis_id: Optional[str] = Field(default=None, description="Linked diagnosis ID")
    image_path: str = Field(description="Relative image path (no binary)")
    original_filename: Optional[str] = Field(default=None, description="Uploaded filename")
    file_size_bytes: Optional[int] = Field(default=None, description="Size in bytes")
    mime_type: str = Field(description="MIME type")
    uploaded_at: datetime = Field(description="Upload timestamp in UTC")
    processing_status: str = Field(description="Vision AI processing status")
    analysis_result: Optional[Dict[str, Any]] = Field(default=None, description="Vision analysis outputs")
    fault_detected: Optional[bool] = Field(default=None, description="Defect detected flag")
    confidence_score: Optional[float] = Field(default=None, description="Confidence score")
    created_at: datetime = Field(description="Record creation timestamp in UTC")
    updated_at: datetime = Field(description="Record last modification timestamp in UTC")
