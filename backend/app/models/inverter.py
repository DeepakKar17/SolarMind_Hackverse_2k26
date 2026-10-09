"""Inverter ORM Model.

Represents a solar string inverter unit.
"""

from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.plant import Plant
    from app.models.pv_asset import PVAsset
    from app.models.telemetry import Telemetry
    from app.models.diagnosis import Diagnosis
    from app.models.alert import Alert
    from app.models.photo_inspection import PhotoInspection
    from app.models.work_order import WorkOrder


class Inverter(Base, TimestampMixin):
    __tablename__ = "inverters"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g. "INV-101"
    plant_id: Mapped[int] = mapped_column(Integer, ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True)
    serial_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    manufacturer: Mapped[str] = mapped_column(String(80), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    firmware_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    rated_ac_power_kw: Mapped[float] = mapped_column(Float, nullable=False)
    mppt_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    strings_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="NORMAL", nullable=False, index=True)
    last_telemetry_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    plant: Mapped["Plant"] = relationship("Plant", back_populates="inverters")
    pv_assets: Mapped[List["PVAsset"]] = relationship("PVAsset", back_populates="inverter", cascade="all, delete-orphan")
    telemetries: Mapped[List["Telemetry"]] = relationship("Telemetry", back_populates="inverter", cascade="all, delete-orphan")
    diagnoses: Mapped[List["Diagnosis"]] = relationship("Diagnosis", back_populates="inverter", cascade="all, delete-orphan")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="inverter", cascade="all, delete-orphan")
    work_orders: Mapped[List["WorkOrder"]] = relationship("WorkOrder", back_populates="inverter")
    photo_inspections: Mapped[List["PhotoInspection"]] = relationship("PhotoInspection", back_populates="inverter")

    __table_args__ = (
        Index("ix_inverters_plant_status", "plant_id", "status"),
    )
