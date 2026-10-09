"""Simulated Weather Provider for deterministic testing and offline fallback."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from app.services.expected_generation_service import expected_generation_service
from app.weather.base import (
    WeatherForecast,
    WeatherForecastHour,
    WeatherObservation,
    WeatherProvider,
)


class SimulatedWeatherProvider(WeatherProvider):
    """Generates physics-aligned solar weather observations and forecasts."""

    def __init__(
        self,
        default_cloud_cover_pct: float = 15.0,
        default_ambient_temp_c: float = 30.0,
    ):
        self.default_cloud_cover = default_cloud_cover_pct
        self.default_ambient_temp = default_ambient_temp_c

    def get_current_observation(self, latitude: float, longitude: float) -> WeatherObservation:
        now = datetime.now(timezone.utc)
        solar_pos = expected_generation_service.calculate_solar_position(
            timestamp=now,
            latitude=latitude,
            longitude=longitude,
        )
        ghi = solar_pos.clear_sky_irradiance_wm2 * (1.0 - 0.75 * (self.default_cloud_cover / 100.0) ** 3)
        return WeatherObservation(
            source="SIMULATED",
            observation_time=now,
            is_forecast=False,
            temperature_c=self.default_ambient_temp,
            relative_humidity_pct=55.0,
            cloud_cover_pct=self.default_cloud_cover,
            ghi_irradiance_wm2=round(ghi, 1),
            poa_irradiance_wm2=round(ghi, 1),
            wind_speed_ms=3.2,
            weather_code=1 if self.default_cloud_cover < 20 else (2 if self.default_cloud_cover < 50 else 3),
            condition_description="Clear" if self.default_cloud_cover < 20 else ("Partly Cloudy" if self.default_cloud_cover < 50 else "Overcast"),
            data_freshness_seconds=0.0,
        )

    def get_forecast(self, latitude: float, longitude: float, hours: int = 48) -> WeatherForecast:
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        hourly_list = []
        for h in range(hours):
            fc_time = now + timedelta(hours=h)
            solar_pos = expected_generation_service.calculate_solar_position(
                timestamp=fc_time,
                latitude=latitude,
                longitude=longitude,
            )
            ghi = solar_pos.clear_sky_irradiance_wm2 * (1.0 - 0.75 * (self.default_cloud_cover / 100.0) ** 3)
            hourly_list.append(
                WeatherForecastHour(
                    forecast_time=fc_time,
                    is_forecast=True,
                    temperature_c=self.default_ambient_temp - 5.0 + (10.0 * (solar_pos.solar_elevation_deg / 90.0) if solar_pos.solar_elevation_deg > 0 else 0),
                    relative_humidity_pct=60.0,
                    cloud_cover_pct=self.default_cloud_cover,
                    ghi_irradiance_wm2=round(max(0.0, ghi), 1),
                    wind_speed_ms=3.0,
                    weather_code=1 if self.default_cloud_cover < 20 else 2,
                    condition_description="Forecast Clear" if self.default_cloud_cover < 20 else "Forecast Partly Cloudy",
                )
            )
        return WeatherForecast(
            source="SIMULATED",
            generated_time=now,
            is_forecast=True,
            hourly=hourly_list,
        )

    def is_available(self) -> bool:
        return True
