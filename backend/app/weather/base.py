"""Base weather provider abstractions, observation schemas, and forecast contracts."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class WeatherObservation:
    """Represents a measured meteorological observation for a plant location.

    CRITICAL INVARIANT: is_forecast MUST be False for actual observations.
    """

    source: str
    observation_time: datetime
    is_forecast: bool = False
    temperature_c: Optional[float] = None
    relative_humidity_pct: Optional[float] = None
    cloud_cover_pct: Optional[float] = None
    ghi_irradiance_wm2: Optional[float] = None  # Global Horizontal
    poa_irradiance_wm2: Optional[float] = None  # Plane of Array
    wind_speed_ms: Optional[float] = None
    weather_code: Optional[int] = None
    condition_description: Optional[str] = None
    data_freshness_seconds: Optional[float] = None
    raw_payload: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WeatherForecastHour:
    """Individual hourly forecasted meteorological condition."""

    forecast_time: datetime
    is_forecast: bool = True
    temperature_c: Optional[float] = None
    relative_humidity_pct: Optional[float] = None
    cloud_cover_pct: Optional[float] = None
    ghi_irradiance_wm2: Optional[float] = None
    wind_speed_ms: Optional[float] = None
    weather_code: Optional[int] = None
    condition_description: Optional[str] = None


@dataclass
class WeatherForecast:
    """Represents a multi-hour weather forecast from an external meteorological model."""

    source: str
    generated_time: datetime
    is_forecast: bool = True
    hourly: List[WeatherForecastHour] = field(default_factory=list)


class WeatherProvider(ABC):
    """Abstract interface for external weather intelligence providers."""

    @abstractmethod
    def get_current_observation(self, latitude: float, longitude: float) -> WeatherObservation:
        """Fetch current weather observation for coordinates."""
        raise NotImplementedError

    @abstractmethod
    def get_forecast(self, latitude: float, longitude: float, hours: int = 48) -> WeatherForecast:
        """Fetch multi-hour forecast for coordinates."""
        raise NotImplementedError

    @abstractmethod
    def is_available(self) -> bool:
        """Check if provider is healthy and responsive."""
        raise NotImplementedError
