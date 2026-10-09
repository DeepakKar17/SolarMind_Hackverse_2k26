"""Alert ORM Model.

Real-time threshold trips, fault events, and alert acknowledgement lifecycle.
"""

from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.plant import Plant
    from app.models.inverter import Inverter
    from app.models.pv_asset import PVAsset
    from app.models.diagnosis import Diagnosis


class Alert(Base, TimestampMixin):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g. "ALT-901"
    plant_id: Mapped[int] = mapped_column(Integer, ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True)
    inverter_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("inverters.id", ondelete="CASCADE"), nullable=True, index=True)
    pv_asset_id: Mapped[Optional[str]] = mapped_column(String(60), ForeignKey("pv_assets.id", ondelete="SET NULL"), nullable=True, index=True)
    string_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    severity: Mapped[str] = mapped_column(String(20), default="WARNING", nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(40), default="INVERTER_EVENT", nullable=False, index=True)  # 'INVERTER_EVENT' | 'RULE_ENGINE' | 'ML_INSPECTION' | 'MANUAL'
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False, index=True)

    event_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Acknowledgement Lifecycle
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    acknowledged_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Related Diagnosis link
    related_diagnosis_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("diagnoses.id", ondelete="SET NULL"), nullable=True)
    estimated_power_loss_kw: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    estimated_daily_loss_kwh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    actionable_guidance: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    plant: Mapped["Plant"] = relationship("Plant", back_populates="alerts")
    inverter: Mapped[Optional["Inverter"]] = relationship("Inverter", back_populates="alerts")
    pv_asset: Mapped[Optional["PVAsset"]] = relationship("PVAsset", back_populates="alerts")
    diagnosis: Mapped[Optional["Diagnosis"]] = relationship("Diagnosis", back_populates="alerts")

    __table_args__ = (
        Index("ix_alerts_plant_status_ack", "plant_id", "status", "acknowledged"),
        Index("ix_alerts_source_time", "source", "event_timestamp"),
    )
