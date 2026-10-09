"""Diagnosis ORM Model.

AI-driven fault classifications, deterministic electrical rule evaluations, and loss estimations.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.plant import Plant
    from app.models.inverter import Inverter
    from app.models.pv_asset import PVAsset
    from app.models.work_order import WorkOrder
    from app.models.alert import Alert
    from app.models.photo_inspection import PhotoInspection


class Diagnosis(Base, TimestampMixin):
    __tablename__ = "diagnoses"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g. "DIAG-401"
    plant_id: Mapped[int] = mapped_column(Integer, ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True)
    inverter_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("inverters.id", ondelete="CASCADE"), nullable=True, index=True)
    pv_asset_id: Mapped[Optional[str]] = mapped_column(String(60), ForeignKey("pv_assets.id", ondelete="SET NULL"), nullable=True, index=True)

    affected_string: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fault_class: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    fault_title: Mapped[str] = mapped_column(String(150), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="WARNING", nullable=False, index=True)

    # Engine Methodology: 'ML_CLASSIFIER' | 'DETERMINISTIC_RULE' | 'HYBRID' | 'HEURISTIC'
    engine_type: Mapped[str] = mapped_column(String(40), default="ML_CLASSIFIER", nullable=False)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # NULL for deterministic rules
    rule_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_suspicion_only: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_insufficient_evidence: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False, index=True)
    evidence: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    estimated_lost_energy_kwh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cumulative_lost_energy_kwh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    financial_deficit_inr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    probable_cause: Mapped[str] = mapped_column(Text, nullable=False)
    root_cause_summary: Mapped[str] = mapped_column(Text, nullable=False)
    data_quality_warning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recommended_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    plant: Mapped["Plant"] = relationship("Plant", back_populates="diagnoses")
    inverter: Mapped[Optional["Inverter"]] = relationship("Inverter", back_populates="diagnoses")
    pv_asset: Mapped[Optional["PVAsset"]] = relationship("PVAsset", back_populates="diagnoses")
    work_orders: Mapped[List["WorkOrder"]] = relationship("WorkOrder", back_populates="diagnosis")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="diagnosis")
    photo_inspections: Mapped[List["PhotoInspection"]] = relationship("PhotoInspection", back_populates="diagnosis")

    __table_args__ = (
        Index("ix_diagnoses_plant_status", "plant_id", "status"),
        Index("ix_diagnoses_class_severity", "fault_class", "severity"),
    )
