"""ApplicationSetting ORM Model for SolarMind.

Stores application configuration parameters, grid tariffs, alerting thresholds,
and securely encrypted system settings with audit timestamps.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, utc_now


class ApplicationSetting(Base):
    """Scoped key-value configuration parameters."""

    __tablename__ = "application_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(
        String(50), default="SYSTEM", nullable=False, index=True
    )  # 'TARIFF' | 'SECURITY' | 'TELEMETRY' | 'ALERT_THRESHOLDS' | 'SYSTEM'

    is_secret: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    __table_args__ = (
        Index("ix_app_settings_cat_key", "category", "key"),
    )
