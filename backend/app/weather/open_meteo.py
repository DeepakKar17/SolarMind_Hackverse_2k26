"""Open-Meteo Weather Provider Implementation.

Integrates with the open-access Open-Meteo REST API for plant-level meteorological observations
and hourly solar irradiance forecasts.
"""

from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, Optional
import urllib.error
import urllib.parse
import urllib.request

from app.weather.base import (
    WeatherForecast,
    WeatherForecastHour,
    WeatherObservation,
    WeatherProvider,
)

logger = logging.getLogger("solarmind.weather.open_meteo")

WMO_WEATHER_CODES: Dict[int, str] = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


class OpenMeteoWeatherProvider(WeatherProvider):
    """Fetches real-time observations and forecasts from Open-Meteo API."""

    def __init__(self, timeout_seconds: float = 5.0):
        self.base_url = "https://api.open-meteo.com/v1/forecast"
        self.timeout = timeout_seconds
        self._last_error: Optional[str] = None
        self._consecutive_failures: int = 0

    def get_current_observation(self, latitude: float, longitude: float) -> WeatherObservation:
        """Fetch current weather observation for the given coordinates."""
        params = {
            "latitude": f"{latitude:.4f}",
            "longitude": f"{longitude:.4f}",
            "current": "temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m,shortwave_radiation,direct_normal_irradiance,diffuse_radiation,weather_code",
            "timezone": "UTC",
        }
        url = f"{self.base_url}?{urllib.parse.urlencode(params)}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "SolarMind-Diagnostics/1.0"})
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            current = data.get("current", {})
            obs_time_str = current.get("time")
            if obs_time_str:
                obs_time = datetime.fromisoformat(obs_time_str).replace(tzinfo=timezone.utc)
            else:
                obs_time = datetime.now(timezone.utc)

            wmo_code = current.get("weather_code")
            desc = WMO_WEATHER_CODES.get(wmo_code, "Unknown")
            sw_rad = current.get("shortwave_radiation")  # GHI W/m²

            self._consecutive_failures = 0
            self._last_error = None

            return WeatherObservation(
                source="OPEN_METEO",
                observation_time=obs_time,
                is_forecast=False,
                temperature_c=current.get("temperature_2m"),
                relative_humidity_pct=current.get("relative_humidity_2m"),
                cloud_cover_pct=current.get("cloud_cover"),
                ghi_irradiance_wm2=float(sw_rad) if sw_rad is not None else None,
                poa_irradiance_wm2=float(sw_rad) if sw_rad is not None else None,  # Approximation if horizontal
                wind_speed_ms=current.get("wind_speed_10m"),
                weather_code=wmo_code,
                condition_description=desc,
                data_freshness_seconds=0.0,
                raw_payload=current,
            )
        except Exception as e:
            self._consecutive_failures += 1
            self._last_error = str(e)
            logger.warning(f"Open-Meteo observation fetch failed for ({latitude}, {longitude}): {e}")
            raise

    def get_forecast(self, latitude: float, longitude: float, hours: int = 48) -> WeatherForecast:
        """Fetch multi-hour forecast for coordinates."""
        params = {
            "latitude": f"{latitude:.4f}",
            "longitude": f"{longitude:.4f}",
            "hourly": "temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m,shortwave_radiation,weather_code",
            "forecast_days": max(1, min(7, (hours // 24) + 1)),
            "timezone": "UTC",
        }
        url = f"{self.base_url}?{urllib.parse.urlencode(params)}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "SolarMind-Diagnostics/1.0"})
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            hourly_data = data.get("hourly", {})
            times = hourly_data.get("time", [])
            temps = hourly_data.get("temperature_2m", [])
            humidities = hourly_data.get("relative_humidity_2m", [])
            clouds = hourly_data.get("cloud_cover", [])
            winds = hourly_data.get("wind_speed_10m", [])
            rads = hourly_data.get("shortwave_radiation", [])
            codes = hourly_data.get("weather_code", [])

            hours_list = []
            for i in range(min(hours, len(times))):
                t_str = times[i]
                t_dt = datetime.fromisoformat(t_str).replace(tzinfo=timezone.utc)
                w_code = codes[i] if i < len(codes) else None
                hours_list.append(
                    WeatherForecastHour(
                        forecast_time=t_dt,
                        is_forecast=True,
                        temperature_c=temps[i] if i < len(temps) else None,
                        relative_humidity_pct=humidities[i] if i < len(humidities) else None,
                        cloud_cover_pct=clouds[i] if i < len(clouds) else None,
                        ghi_irradiance_wm2=rads[i] if i < len(rads) else None,
                        wind_speed_ms=winds[i] if i < len(winds) else None,
                        weather_code=w_code,
                        condition_description=WMO_WEATHER_CODES.get(w_code, "Unknown"),
                    )
                )

            self._consecutive_failures = 0
            self._last_error = None

            return WeatherForecast(
                source="OPEN_METEO",
                generated_time=datetime.now(timezone.utc),
                is_forecast=True,
                hourly=hours_list,
            )
        except Exception as e:
            self._consecutive_failures += 1
            self._last_error = str(e)
            logger.warning(f"Open-Meteo forecast fetch failed for ({latitude}, {longitude}): {e}")
            raise

    def is_available(self) -> bool:
        """Returns False if provider had repeated recent failures."""
        return self._consecutive_failures < 3
