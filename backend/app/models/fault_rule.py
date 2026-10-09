"""Fault Rule Model with Thresholds and Version History."""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class FaultRule(Base, TimestampMixin):
    """Fault Detection Rule entity with configurable thresholds and versioning."""

    __tablename__ = "fault_rules"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g., 'RULE-SHADING-01'
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)  # 'Environmental', 'Electrical'
    severity: Mapped[str] = mapped_column(String(50), default="WARNING", nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    documentation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Configurable Thresholds (stored in JSON or explicit columns)
    threshold_value: Mapped[float] = mapped_column(Float, nullable=False)
    threshold_unit: Mapped[str] = mapped_column(String(50), default="percent", nullable=False)
    secondary_threshold: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Versioning & Audit
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    previous_threshold_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
