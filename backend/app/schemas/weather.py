"""Pydantic schemas for Weather Intelligence, observations, and forecasts."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class WeatherObservationResponse(BaseModel):
    """Real-time weather observation response."""

    source: str = Field(description="Data provider source (e.g. 'OPEN_METEO', 'LOCAL_STATION', 'WEATHER_RECORD')")
    observation_time: datetime = Field(description="UTC timestamp of the observation")
    is_forecast: bool = Field(default=False, description="MUST be False for measured physical observations")
    temperature_c: Optional[float] = Field(default=None, description="Ambient temperature in °C")
    relative_humidity_pct: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Relative humidity %")
    cloud_cover_pct: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Cloud cover percentage (0-100%)")
    ghi_irradiance_wm2: Optional[float] = Field(default=None, ge=0.0, description="Global Horizontal Irradiance in W/m²")
    poa_irradiance_wm2: Optional[float] = Field(default=None, ge=0.0, description="Plane of Array Irradiance in W/m²")
    wind_speed_ms: Optional[float] = Field(default=None, ge=0.0, description="Wind speed in m/s")
    weather_code: Optional[int] = Field(default=None, description="WMO weather interpretation code")
    condition_description: Optional[str] = Field(default=None, description="Human-readable weather condition")
    data_freshness_seconds: Optional[float] = Field(default=None, description="Age of data in seconds")


class WeatherForecastHourResponse(BaseModel):
    """Hourly weather forecast item."""

    forecast_time: datetime = Field(description="Forecast target timestamp in UTC")
    is_forecast: bool = Field(default=True, description="Always True for forecasted items")
    temperature_c: Optional[float] = Field(default=None)
    relative_humidity_pct: Optional[float] = Field(default=None)
    cloud_cover_pct: Optional[float] = Field(default=None)
    ghi_irradiance_wm2: Optional[float] = Field(default=None)
    wind_speed_ms: Optional[float] = Field(default=None)
    weather_code: Optional[int] = Field(default=None)
    condition_description: Optional[str] = Field(default=None)


class WeatherForecastResponse(BaseModel):
    """Multi-hour weather forecast payload."""

    source: str = Field(description="Meteorological model source")
    generated_time: datetime = Field(description="Timestamp when forecast was produced")
    is_forecast: bool = Field(default=True, description="Always True for forecasts")
    hourly: List[WeatherForecastHourResponse] = Field(default_factory=list)


class WeatherRecordCreate(BaseModel):
    """Payload to record an on-site weather observation."""

    model_config = ConfigDict(extra="forbid")

    plant_id: int = Field(ge=1)
    timestamp: datetime = Field(description="Observation timestamp in UTC")
    poa_irradiance_wm2: Optional[float] = Field(default=None, ge=0.0)
    ghi_irradiance_wm2: Optional[float] = Field(default=None, ge=0.0)
    ambient_temperature_c: Optional[float] = Field(default=None)
    cell_temperature_c: Optional[float] = Field(default=None)
    wind_speed_ms: Optional[float] = Field(default=None, ge=0.0)
    cloud_cover_pct: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    data_source: str = Field(default="WEATHER_STATION", max_length=50)


class WeatherRecordResponse(BaseModel):
    """Persisted WeatherRecord database entity response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    plant_id: int
    timestamp: datetime
    poa_irradiance_wm2: Optional[float]
    ghi_irradiance_wm2: Optional[float]
    ambient_temperature_c: Optional[float]
    cell_temperature_c: Optional[float]
    wind_speed_ms: Optional[float]
    cloud_cover_pct: Optional[float]
    data_source: str


class CloudPerformanceAnalysisResponse(BaseModel):
    """Analysis assessing whether yield reduction is weather-explained or abnormal."""

    plant_id: int
    timestamp: datetime
    observed_power_kw: float
    expected_clear_sky_kw: float
    weather_adjusted_expected_kw: float
    cloud_cover_pct: Optional[float]
    irradiance_wm2: Optional[float]
    is_weather_explained: bool
    explanation_summary: str
    confidence_score: float
    weather_source: str
