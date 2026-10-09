"""Telemetry ORM Model.

High-resolution electrical telemetry timeseries records and quality flags.
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.inverter import Inverter
    from app.models.pv_asset import PVAsset


class Telemetry(Base):
    __tablename__ = "telemetries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    inverter_id: Mapped[str] = mapped_column(String(50), ForeignKey("inverters.id", ondelete="CASCADE"), nullable=False, index=True)
    pv_asset_id: Mapped[Optional[str]] = mapped_column(String(60), ForeignKey("pv_assets.id", ondelete="SET NULL"), nullable=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    # DC Electrical Measurements
    v_dc: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Volts
    i_dc: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Amps
    p_dc: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # kW

    # AC Electrical Measurements
    v_ac: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Volts
    i_ac: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Amps
    p_ac: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # kW
    frequency_hz: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Hz

    # Environmental / Thermal Measurements
    temperature_c: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Inverter internal °C
    ambient_temp_c: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Ambient weather °C
    poa_irradiance_wm2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Plane of Array W/m²

    # Yield
    daily_yield_kwh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # kWh
    total_yield_kwh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # kWh

    # Data Quality & Ingestion Source
    data_source: Mapped[str] = mapped_column(String(40), default="SIMULATED", nullable=False, index=True)  # 'MODBUS' | 'SIMULATED' | 'MQTT' | 'MANUAL'
    data_quality_flag: Mapped[str] = mapped_column(String(40), default="VALID", nullable=False, index=True)  # 'VALID' | 'SUSPICIOUS' | 'INTERPOLATED' | 'MISSING_MEASUREMENTS'

    # Relationships
    inverter: Mapped["Inverter"] = relationship("Inverter", back_populates="telemetries")
    pv_asset: Mapped[Optional["PVAsset"]] = relationship("PVAsset", back_populates="telemetries")

    __table_args__ = (
        Index("ix_telemetries_inverter_time", "inverter_id", "timestamp"),
        Index("ix_telemetries_asset_time", "pv_asset_id", "timestamp"),
        Index("ix_telemetries_quality_time", "data_quality_flag", "timestamp"),
    )


# Type alias for explicit TelemetryRecord naming convention
TelemetryRecord = Telemetry
