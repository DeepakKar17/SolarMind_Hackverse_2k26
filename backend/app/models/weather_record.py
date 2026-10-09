"""WeatherRecord ORM Model for SolarMind.

Stores environmental, meteorological, and solar irradiance readings
(POA, GHI, ambient temperature, cell temperature, and cloud cover).
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.plant import Plant


class WeatherRecord(Base):
    """Environmental and solar irradiance telemetry."""

    __tablename__ = "weather_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    poa_irradiance_wm2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Plane of Array W/m²
    ghi_irradiance_wm2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Global Horizontal W/m²
    ambient_temperature_c: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cell_temperature_c: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    wind_speed_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cloud_cover_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    data_source: Mapped[str] = mapped_column(String(50), default="WEATHER_STATION", nullable=False)

    # Relationships
    plant: Mapped["Plant"] = relationship("Plant", backref="weather_records")

    __table_args__ = (
        Index("ix_weather_plant_timestamp", "plant_id", "timestamp"),
    )
