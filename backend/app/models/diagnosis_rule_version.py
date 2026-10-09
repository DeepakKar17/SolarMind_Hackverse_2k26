"""DiagnosisRuleVersion ORM Model for SolarMind.

Tracks diagnosis rule definitions, thresholds, revision history, and rollback capabilities.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, utc_now


class DiagnosisRuleVersion(Base):
    """Stores versioned diagnosis rule heuristics and threshold configurations."""

    __tablename__ = "diagnosis_rule_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rule_id: Mapped[str] = mapped_column(String(60), index=True, nullable=False)  # e.g. 'RULE-OPEN-CIRCUIT'
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(30), default="WARNING", nullable=False)

    threshold_value: Mapped[float] = mapped_column(Float, nullable=False)
    threshold_unit: Mapped[str] = mapped_column(String(30), default="percent", nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    previous_threshold_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    documentation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        Index("ix_diag_rules_rule_ver", "rule_id", "version"),
    )
