"""DiagnosisEvidence ORM Model for SolarMind.

Stores granular physical and visual evidence supporting automated fault diagnoses,
including telemetry deltas, thermal scans, photo inspection references, and IV curve deviations.
"""

from datetime import datetime
from typing import Any, Dict, Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.diagnosis import Diagnosis
    from app.models.photo_inspection import PhotoInspection


class DiagnosisEvidence(Base, TimestampMixin):
    """Granular evidence item supporting a fault diagnosis hypothesis."""

    __tablename__ = "diagnosis_evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    diagnosis_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("diagnoses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    evidence_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # 'TELEMETRY_ANOMALY' | 'THERMAL_DELTA' | 'PHOTO_INSPECTION' | 'IV_CURVE' | 'DISCOM_SIGNAL'

    metric_name: Mapped[str] = mapped_column(String(80), nullable=False)  # e.g. 'v_dc_drop_pct', 'current_deficit_amps'
    metric_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    metric_unit: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # '%', 'V', 'A', 'W/m²', '°C'

    reference_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    photo_inspection_id: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("photo_inspections.id", ondelete="SET NULL"), nullable=True, index=True
    )
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Relationships
    diagnosis: Mapped["Diagnosis"] = relationship("Diagnosis", backref="evidence_records")
    photo_inspection: Mapped[Optional["PhotoInspection"]] = relationship("PhotoInspection")

    __table_args__ = (
        Index("ix_diag_evidence_type_time", "diagnosis_id", "evidence_type"),
    )
