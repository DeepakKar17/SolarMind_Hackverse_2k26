"""Integration Config Model.

Tracks third-party inverter cloud connections (Deye OpenAPI, Sungrow, Huawei)
and telemetry brokers while safely separating and masking credentials.
"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class IntegrationConfig(Base, TimestampMixin):
    """Third-party hardware provider or telemetry gateway configuration."""

    __tablename__ = "integration_configs"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g., 'deye-cloud'
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    endpoint_url: Mapped[str] = mapped_column(String(500), nullable=False)
    app_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    encrypted_secret: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Masked in APIs
    auth_type: Mapped[str] = mapped_column(String(50), default="OAUTH2", nullable=False)
    
    # Status & Sync Metrics
    status: Mapped[str] = mapped_column(String(50), default="CONNECTED", nullable=False)
    last_successful_sync: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sync_interval_min: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
