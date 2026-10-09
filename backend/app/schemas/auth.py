"""Authentication & Credential Pydantic Schemas for SolarMind.

Validation models for registration, login, session creation, password reset,
and email verification.
"""

import re
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.schemas.user import UserResponse

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class UserRegisterRequest(BaseModel):
    """Registration request schema with strong password validation."""

    full_name: str = Field(..., min_length=2, max_length=255, description="Full name of engineer or operator")
    email: str = Field(..., min_length=5, max_length=255, description="Valid work email address")
    password: str = Field(..., min_length=8, max_length=128, description="Account password (min 8 chars)")
    confirm_password: str = Field(..., min_length=8, max_length=128, description="Password confirmation match")
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    role: Optional[str] = Field("operator", description="Requested role: operator, asset_manager, viewer")
    accept_terms: bool = Field(..., description="Explicit acceptance of security & telemetry terms")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email format.")
        return clean

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not any(c.isupper() for c in v) and not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one uppercase letter or number.")
        return v

    @field_validator("accept_terms")
    @classmethod
    def validate_terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must accept the terms and conditions to register.")
        return v

    @model_validator(mode="after")
    def check_passwords_match(self) -> "UserRegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class UserLoginRequest(BaseModel):
    """Login request schema supporting email or username identifiers."""

    email_or_username: str = Field(..., min_length=3, max_length=255, description="Email address or username")
    password: str = Field(..., min_length=1, max_length=128, description="Account password")
    remember_me: bool = Field(False, description="Persist session for extended period")


class PasswordResetRequest(BaseModel):
    """Request schema for initiating password recovery."""

    email: str = Field(..., min_length=5, max_length=255, description="Registered work email address")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email format.")
        return clean


class PasswordResetConfirm(BaseModel):
    """Confirmation schema for resetting password using a one-time token."""

    token: str = Field(..., min_length=16, description="Cryptographic password reset token")
    new_password: str = Field(..., min_length=8, max_length=128, description="New strong password")
    confirm_password: str = Field(..., min_length=8, max_length=128, description="Confirmation of new password")

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not any(c.isupper() for c in v) and not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one uppercase letter or number.")
        return v

    @model_validator(mode="after")
    def check_passwords_match(self) -> "PasswordResetConfirm":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class EmailVerificationRequest(BaseModel):
    """Schema for validating email using a one-time token."""

    token: str = Field(..., min_length=16, description="Cryptographic email verification token")


class ResendVerificationRequest(BaseModel):
    """Schema for resending a verification link."""

    email: str = Field(..., min_length=5, max_length=255, description="Email address to receive a new verification link")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email format.")
        return clean


class ChangePasswordRequest(BaseModel):
    """Schema for authenticated user changing their own password."""

    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @model_validator(mode="after")
    def check_passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("New passwords do not match.")
        return self


class AuthTokenResponse(BaseModel):
    """Standard token response containing bearer access token and current user profile."""

    access_token: str = Field(..., description="Short-lived or session bearer token")
    token_type: str = Field("bearer", description="Token scheme: bearer")
    expires_in_seconds: int = Field(..., description="Token lifespan in seconds")
    user: UserResponse = Field(..., description="Authenticated user profile")


class AuthMessageResponse(BaseModel):
    """Generic status response for auth workflows without data leakage."""

    success: bool = True
    message: str
    detail: Optional[str] = None
