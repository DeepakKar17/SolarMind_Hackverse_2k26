"""PVAsset ORM Model.

Represents a solar PV string, MPPT tracker channel, or module subarray.
"""

from typing import Any, Dict, List, Optional, TYPE_CHECKING
from sqlalchemy import Float, ForeignKey, Index, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.inverter import Inverter
    from app.models.telemetry import Telemetry
    from app.models.diagnosis import Diagnosis
    from app.models.alert import Alert
    from app.models.work_order import WorkOrder
    from app.models.photo_inspection import PhotoInspection


class PVAsset(Base, TimestampMixin):
    __tablename__ = "pv_assets"

    id: Mapped[str] = mapped_column(String(60), primary_key=True)  # e.g. "PVA-INV101-STR1"
    inverter_id: Mapped[str] = mapped_column(String(50), ForeignKey("inverters.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_type: Mapped[str] = mapped_column(String(40), default="STRING", nullable=False, index=True)  # 'STRING' | 'MPPT' | 'MODULE_ARRAY'
    identifier: Mapped[str] = mapped_column(String(60), nullable=False, index=True)  # e.g. "String 1", "MPPT-1"
    capacity_kwp: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    panel_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    panel_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    azimuth_deg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    tilt_deg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    configuration: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="NORMAL", nullable=False, index=True)

    # Relationships
    inverter: Mapped["Inverter"] = relationship("Inverter", back_populates="pv_assets")
    telemetries: Mapped[List["Telemetry"]] = relationship("Telemetry", back_populates="pv_asset")
    diagnoses: Mapped[List["Diagnosis"]] = relationship("Diagnosis", back_populates="pv_asset")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="pv_asset")
    work_orders: Mapped[List["WorkOrder"]] = relationship("WorkOrder", back_populates="pv_asset")
    photo_inspections: Mapped[List["PhotoInspection"]] = relationship("PhotoInspection", back_populates="pv_asset")

    __table_args__ = (
        Index("ix_pv_assets_inverter_identifier", "inverter_id", "identifier"),
    )
