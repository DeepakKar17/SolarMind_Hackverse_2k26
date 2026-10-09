"""PhotoInspection ORM Model.

Tracks site inspection photos, GPS metadata, and vision-AI diagnostic results.
Images are stored on the filesystem / object storage with relative paths;
binary data is NEVER stored directly in database rows.
"""

from datetime import datetime
from typing import Any, Dict, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.plant import Plant
    from app.models.inverter import Inverter
    from app.models.pv_asset import PVAsset
    from app.models.diagnosis import Diagnosis


class PhotoInspection(Base, TimestampMixin):
    __tablename__ = "photo_inspections"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g. "PHOTO-501"
    plant_id: Mapped[int] = mapped_column(Integer, ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True)
    inverter_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("inverters.id", ondelete="SET NULL"), nullable=True, index=True)
    pv_asset_id: Mapped[Optional[str]] = mapped_column(String(60), ForeignKey("pv_assets.id", ondelete="SET NULL"), nullable=True, index=True)
    diagnosis_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("diagnoses.id", ondelete="SET NULL"), nullable=True, index=True)

    image_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    original_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str] = mapped_column(String(50), default="image/jpeg", nullable=False)

    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    gps_accuracy_m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    processing_status: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False, index=True)
    analysis_result: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    fault_detected: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Relationships
    plant: Mapped["Plant"] = relationship("Plant", back_populates="photo_inspections")
    inverter: Mapped[Optional["Inverter"]] = relationship("Inverter", back_populates="photo_inspections")
    pv_asset: Mapped[Optional["PVAsset"]] = relationship("PVAsset", back_populates="photo_inspections")
    diagnosis: Mapped[Optional["Diagnosis"]] = relationship("Diagnosis", back_populates="photo_inspections")

    __table_args__ = (
        Index("ix_photo_inspections_plant_status", "plant_id", "processing_status"),
    )
