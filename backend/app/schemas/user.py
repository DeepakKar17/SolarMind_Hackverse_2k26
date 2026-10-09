"""User Pydantic Schemas for SolarMind.

Validation and serialization models for user profiles, roles, and administrative
updates.
"""

import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class UserBase(BaseModel):
    """Base user schema containing shared attributes."""

    email: str = Field(..., min_length=5, max_length=255, description="Corporate or operational email address")
    full_name: str = Field(..., min_length=2, max_length=255, description="Full name of user")
    username: Optional[str] = Field(None, min_length=3, max_length=100, description="Optional system handle")
    role: str = Field("operator", description="Role: admin, asset_manager, operator, viewer")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email format.")
        return clean


class UserResponse(BaseModel):
    """Public user response schema - NEVER exposes password hash or internal security counters."""

    id: int
    email: str
    username: Optional[str] = None
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    """Schema for updating user details by an administrator or self-profile."""

    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    role: Optional[str] = Field(None, description="Updated role (admin only)")
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None


class UserProfileUpdate(BaseModel):
    """Schema for updating own profile information."""

    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    username: Optional[str] = Field(None, min_length=3, max_length=100)
