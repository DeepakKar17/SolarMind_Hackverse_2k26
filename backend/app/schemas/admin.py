"""Pydantic Request & Response Schemas for SolarMind Administration."""

import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


# --- User Administration Schemas ---

class AdminUserCreate(BaseModel):
    """Schema for administrator-initiated user registration/invitation."""

    email: str = Field(..., min_length=5, max_length=255)
    full_name: str = Field(..., min_length=2, max_length=255)
    role: str = Field(default="homeowner", pattern="^(admin|homeowner|technician|operator)$")
    password: Optional[str] = Field(None, min_length=8)
    is_active: bool = True
    is_verified: bool = True

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email format.")
        return clean


class AdminUserStatusUpdate(BaseModel):
    """Schema for activating or deactivating user accounts."""

    is_active: bool


class AdminUserRoleUpdate(BaseModel):
    """Schema for assigning or changing user role."""

    role: str = Field(..., pattern="^(admin|homeowner|technician|operator)$")


class AdminUserUpdate(BaseModel):
    """Schema for updating general user attributes."""

    full_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    role: Optional[str] = Field(default=None, pattern="^(admin|homeowner|technician|operator)$")
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None


class AdminOverviewResponse(BaseModel):
    """System-wide summary metrics for administrators."""

    total_users: int
    active_users: int
    homeowners_count: int
    technicians_count: int
    operators_count: int
    total_plants: int
    total_inverters: int
    plants_reporting_telemetry: int
    unresolved_diagnoses: int
    open_work_orders: int
    overdue_work_orders: int
    active_alerts: int
    integrations_connected: int
    system_status: str


class AdminSystemHealthResponse(BaseModel):
    """System operational readiness and dependency status."""

    status: str
    environment: str
    database: Dict[str, Any]
    active_connections: int
    audit_events_count: int
    uptime_seconds: float
    timestamp: datetime


class AdminUserResponse(BaseModel):
    """Detailed user entity representation for administrators."""

    id: int
    email: str
    username: Optional[str] = None
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    failed_login_attempts: int
    locked_until: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    last_login_ip: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserActivityResponse(BaseModel):
    """User account activity summary."""

    user_id: int
    email: str
    total_logins: int
    last_login: Optional[datetime]
    audit_events: List[Dict[str, Any]] = []


# --- Fault Rule Schemas ---

class FaultRuleUpdate(BaseModel):
    """Schema for updating configurable diagnosis rule thresholds."""

    threshold_value: float
    threshold_unit: Optional[str] = None
    secondary_threshold: Optional[float] = None
    is_active: Optional[bool] = None
    documentation: Optional[str] = None


class FaultRuleResponse(BaseModel):
    """Detailed fault rule entity."""

    id: str
    name: str
    category: str
    severity: str
    description: Optional[str]
    documentation: Optional[str]
    threshold_value: float
    threshold_unit: str
    secondary_threshold: Optional[float]
    version: int
    previous_threshold_value: Optional[float]
    is_active: bool
    updated_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Integration Schemas ---

class IntegrationConfigUpdate(BaseModel):
    """Schema for updating integration endpoints and credentials."""

    endpoint_url: Optional[str] = None
    app_id: Optional[str] = None
    secret: Optional[str] = None  # Inbound secret, will be encrypted/stored
    sync_interval_min: Optional[int] = Field(None, ge=1, le=1440)


class IntegrationConfigResponse(BaseModel):
    """Sanitized integration response that NEVER reveals plaintext secrets."""

    id: str
    provider: str
    name: str
    endpoint_url: str
    app_id: Optional[str]
    masked_secret: Optional[str]  # e.g., '••••••••••'
    auth_type: str
    status: str
    last_successful_sync: Optional[datetime]
    last_error: Optional[str]
    sync_interval_min: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IntegrationTestResult(BaseModel):
    """Result of safe test-connection execution."""

    integration_id: str
    status: str
    latency_ms: float
    message: str
    timestamp: datetime


# --- Audit Event Schemas ---

class AuditEventResponse(BaseModel):
    """Immutable audit trail log record."""

    id: int
    timestamp: datetime
    actor_id: Optional[int]
    actor_email: str
    role: str
    action: str
    target_type: str
    target_id: Optional[str]
    details: Optional[str]
    ip_address: Optional[str]
    status: str

    model_config = ConfigDict(from_attributes=True)
