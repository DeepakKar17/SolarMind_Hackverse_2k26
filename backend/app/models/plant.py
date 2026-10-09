"""Plant ORM Model.

Represents a solar photovoltaic installation.
"""

from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.inverter import Inverter
    from app.models.diagnosis import Diagnosis
    from app.models.alert import Alert
    from app.models.work_order import WorkOrder
    from app.models.photo_inspection import PhotoInspection


class Plant(Base, TimestampMixin):
    __tablename__ = "plants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(200), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    system_type: Mapped[str] = mapped_column(String(60), default="Single-String Residential Rooftop", nullable=False)
    installed_capacity_kwp: Mapped[float] = mapped_column(Float, nullable=False)
    tariff_rate_inr: Mapped[float] = mapped_column(Float, default=7.50, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="NORMAL", nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    owner_id: Mapped[Optional[int]] = mapped_column(Integer, index=True, nullable=True)

    # Relationships
    inverters: Mapped[List["Inverter"]] = relationship("Inverter", back_populates="plant", cascade="all, delete-orphan")
    diagnoses: Mapped[List["Diagnosis"]] = relationship("Diagnosis", back_populates="plant", cascade="all, delete-orphan")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="plant", cascade="all, delete-orphan")
    work_orders: Mapped[List["WorkOrder"]] = relationship("WorkOrder", back_populates="plant", cascade="all, delete-orphan")
    photo_inspections: Mapped[List["PhotoInspection"]] = relationship("PhotoInspection", back_populates="plant", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_plants_status_active", "status", "is_active"),
    )
