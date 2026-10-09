"""OutageEvent ORM Model for SolarMind.

Tracks grid outages, anti-islanding trips, inverter thermal shutdowns,
and utility curtailment events with financial and generation loss estimates.
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.plant import Plant
    from app.models.inverter import Inverter


class OutageEvent(Base, TimestampMixin):
    """Grid or hardware outage event record."""

    __tablename__ = "outage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inverter_id: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("inverters.id", ondelete="SET NULL"), nullable=True, index=True
    )

    event_type: Mapped[str] = mapped_column(
        String(50), default="GRID_OUTAGE", nullable=False, index=True
    )  # 'GRID_OUTAGE' | 'OVERVOLTAGE_TRIP' | 'UNDERVOLTAGE_SAG' | 'FREQUENCY_TRIP' | 'TELEMETRY_GAP_SUSPECTED' | 'MANUAL_CURTAILMENT'

    status: Mapped[str] = mapped_column(
        String(30), default="SUSPECTED", nullable=False, index=True
    )  # 'SUSPECTED' | 'CONFIRMED' | 'RESOLVED'

    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    estimated_lost_energy_kwh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    estimated_financial_loss_inr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    detection_limitations: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


    # Relationships
    plant: Mapped["Plant"] = relationship("Plant", backref="outage_events")
    inverter: Mapped[Optional["Inverter"]] = relationship("Inverter")

    __table_args__ = (
        Index("ix_outage_plant_start", "plant_id", "start_time"),
    )
