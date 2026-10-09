"""SolarMind Weather Intelligence Service.

Manages external meteorological providers, observational caching with TTL, circuit-breaker
failure protection, and cloud-versus-fault analytical distinctions.
"""

from datetime import datetime, timedelta, timezone
import logging
import threading
from typing import Dict, Optional, Tuple
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.errors import EntityNotFoundError
from app.models.plant import Plant
from app.models.weather_record import WeatherRecord
from app.schemas.weather import (
    CloudPerformanceAnalysisResponse,
    WeatherForecastHourResponse,
    WeatherForecastResponse,
    WeatherObservationResponse,
    WeatherRecordCreate,
)
from app.services.expected_generation_service import expected_generation_service
from app.weather.base import WeatherForecast, WeatherObservation, WeatherProvider
from app.weather.open_meteo import OpenMeteoWeatherProvider
from app.weather.simulated import SimulatedWeatherProvider

logger = logging.getLogger("solarmind.services.weather")

OBSERVATION_CACHE_TTL_SECONDS = 900.0  # 15 minutes
FORECAST_CACHE_TTL_SECONDS = 7200.0   # 2 hours
CIRCUIT_BREAKER_COOLDOWN_SECONDS = 300.0  # 5 minutes after 3 failures


class WeatherService:
    """Coordinates weather intelligence, caching, provider fallback, and performance attribution."""

    def __init__(self, primary_provider: Optional[WeatherProvider] = None):
        self.primary_provider: WeatherProvider = primary_provider or OpenMeteoWeatherProvider(timeout_seconds=4.0)
        self.fallback_provider: WeatherProvider = SimulatedWeatherProvider()

        # In-memory thread-safe caches
        self._lock = threading.Lock()
        self._obs_cache: Dict[str, Tuple[datetime, WeatherObservation]] = {}
        self._fc_cache: Dict[str, Tuple[datetime, WeatherForecast]] = {}

        # Circuit breaker state
        self._consecutive_errors: int = 0
        self._circuit_open_until: Optional[datetime] = None

    def _is_circuit_open(self) -> bool:
        """Check if external provider circuit breaker is currently open."""
        if self._circuit_open_until is None:
            return False
        if datetime.now(timezone.utc) > self._circuit_open_until:
            # Cooldown expired, half-open trial
            self._circuit_open_until = None
            self._consecutive_errors = 0
            return False
        return True

    def _record_provider_failure(self, error: Exception) -> None:
        """Record external API failure and potentially trip circuit breaker."""
        self._consecutive_errors += 1
        logger.warning(f"Weather provider error ({self._consecutive_errors}/3): {error}")
        if self._consecutive_errors >= 3:
            self._circuit_open_until = datetime.now(timezone.utc) + timedelta(seconds=CIRCUIT_BREAKER_COOLDOWN_SECONDS)
            logger.error(f"Weather provider circuit breaker TRIPPED until {self._circuit_open_until.isoformat()}")

    def _record_provider_success(self) -> None:
        """Reset circuit breaker counters upon successful API response."""
        self._consecutive_errors = 0
        self._circuit_open_until = None

    def get_current_weather(
        self,
        db: Session,
        plant_id: int,
        force_refresh: bool = False,
    ) -> WeatherObservationResponse:
        """Get the latest weather observation for a plant with multi-tier caching and fallback."""
        plant = db.get(Plant, plant_id)
        if not plant:
            raise EntityNotFoundError("Plant", plant_id)

        lat = plant.latitude or 20.2961
        lon = plant.longitude or 85.8245
        cache_key = f"obs_{round(lat, 3)}_{round(lon, 3)}"
        now = datetime.now(timezone.utc)

        # 1. Check In-Memory Cache
        if not force_refresh:
            with self._lock:
                if cache_key in self._obs_cache:
                    cached_at, cached_obs = self._obs_cache[cache_key]
                    age_seconds = (now - cached_at).total_seconds()
                    if age_seconds < OBSERVATION_CACHE_TTL_SECONDS:
                        return WeatherObservationResponse(
                            source=f"{cached_obs.source}_CACHED",
                            observation_time=cached_obs.observation_time,
                            is_forecast=False,
                            temperature_c=cached_obs.temperature_c,
                            relative_humidity_pct=cached_obs.relative_humidity_pct,
                            cloud_cover_pct=cached_obs.cloud_cover_pct,
                            ghi_irradiance_wm2=cached_obs.ghi_irradiance_wm2,
                            poa_irradiance_wm2=cached_obs.poa_irradiance_wm2,
                            wind_speed_ms=cached_obs.wind_speed_ms,
                            weather_code=cached_obs.weather_code,
                            condition_description=cached_obs.condition_description,
                            data_freshness_seconds=round(age_seconds, 1),
                        )

        # 2. Check Recent Database Weather Record (<30 min old)
        recent_db_stmt = (
            select(WeatherRecord)
            .where(
                WeatherRecord.plant_id == plant.id,
                WeatherRecord.timestamp >= now.replace(tzinfo=None) - timedelta(minutes=30),
            )
            .order_by(desc(WeatherRecord.timestamp))
            .limit(1)
        )
        recent_db_record = db.scalars(recent_db_stmt).first()
        if recent_db_record and not force_refresh:
            db_ts = recent_db_record.timestamp
            db_utc = db_ts.replace(tzinfo=timezone.utc) if db_ts.tzinfo is None else db_ts
            age_seconds = (now - db_utc).total_seconds()
            return WeatherObservationResponse(
                source=f"DB_{recent_db_record.data_source}",
                observation_time=db_utc,
                is_forecast=False,
                temperature_c=recent_db_record.ambient_temperature_c,
                relative_humidity_pct=None,
                cloud_cover_pct=recent_db_record.cloud_cover_pct,
                ghi_irradiance_wm2=recent_db_record.ghi_irradiance_wm2,
                poa_irradiance_wm2=recent_db_record.poa_irradiance_wm2,
                wind_speed_ms=recent_db_record.wind_speed_ms,
                weather_code=None,
                condition_description="Local Weather Station Observation",
                data_freshness_seconds=round(age_seconds, 1),
            )

        # 3. Call Primary External Provider (if circuit is closed)
        obs: Optional[WeatherObservation] = None
        if not self._is_circuit_open():
            try:
                obs = self.primary_provider.get_current_observation(latitude=lat, longitude=lon)
                self._record_provider_success()
            except Exception as e:
                self._record_provider_failure(e)

        # 4. Fallback Provider if primary unavailable
        if obs is None:
            logger.info(f"Using simulated fallback weather observation for plant {plant.id}")
            obs = self.fallback_provider.get_current_observation(latitude=lat, longitude=lon)

        # Store in Cache
        with self._lock:
            self._obs_cache[cache_key] = (now, obs)

        # Ingest to database record if not already present
        try:
            wr = WeatherRecord(
                plant_id=plant.id,
                timestamp=obs.observation_time.replace(tzinfo=None) if obs.observation_time.tzinfo else obs.observation_time,
                poa_irradiance_wm2=obs.poa_irradiance_wm2,
                ghi_irradiance_wm2=obs.ghi_irradiance_wm2,
                ambient_temperature_c=obs.temperature_c,
                wind_speed_ms=obs.wind_speed_ms,
                cloud_cover_pct=obs.cloud_cover_pct,
                data_source=obs.source,
            )
            db.add(wr)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning(f"Could not persist weather record to DB: {e}")

        return WeatherObservationResponse(
            source=obs.source,
            observation_time=obs.observation_time,
            is_forecast=False,
            temperature_c=obs.temperature_c,
            relative_humidity_pct=obs.relative_humidity_pct,
            cloud_cover_pct=obs.cloud_cover_pct,
            ghi_irradiance_wm2=obs.ghi_irradiance_wm2,
            poa_irradiance_wm2=obs.poa_irradiance_wm2,
            wind_speed_ms=obs.wind_speed_ms,
            weather_code=obs.weather_code,
            condition_description=obs.condition_description,
            data_freshness_seconds=0.0,
        )

    def get_weather_forecast(
        self,
        db: Session,
        plant_id: int,
        hours: int = 48,
    ) -> WeatherForecastResponse:
        """Get multi-hour weather forecast for plant location with caching."""
        plant = db.get(Plant, plant_id)
        if not plant:
            raise EntityNotFoundError("Plant", plant_id)

        lat = plant.latitude or 20.2961
        lon = plant.longitude or 85.8245
        cache_key = f"fc_{round(lat, 3)}_{round(lon, 3)}_{hours}"
        now = datetime.now(timezone.utc)

        # Check Cache
        with self._lock:
            if cache_key in self._fc_cache:
                cached_at, cached_fc = self._fc_cache[cache_key]
                if (now - cached_at).total_seconds() < FORECAST_CACHE_TTL_SECONDS:
                    return WeatherForecastResponse(
                        source=f"{cached_fc.source}_CACHED",
                        generated_time=cached_fc.generated_time,
                        is_forecast=True,
                        hourly=[
                            WeatherForecastHourResponse(
                                forecast_time=h.forecast_time,
                                is_forecast=True,
                                temperature_c=h.temperature_c,
                                relative_humidity_pct=h.relative_humidity_pct,
                                cloud_cover_pct=h.cloud_cover_pct,
                                ghi_irradiance_wm2=h.ghi_irradiance_wm2,
                                wind_speed_ms=h.wind_speed_ms,
                                weather_code=h.weather_code,
                                condition_description=h.condition_description,
                            )
                            for h in cached_fc.hourly
                        ],
                    )

        # Fetch from Primary Provider or Fallback
        fc: Optional[WeatherForecast] = None
        if not self._is_circuit_open():
            try:
                fc = self.primary_provider.get_forecast(latitude=lat, longitude=lon, hours=hours)
                self._record_provider_success()
            except Exception as e:
                self._record_provider_failure(e)

        if fc is None:
            fc = self.fallback_provider.get_forecast(latitude=lat, longitude=lon, hours=hours)

        with self._lock:
            self._fc_cache[cache_key] = (now, fc)

        return WeatherForecastResponse(
            source=fc.source,
            generated_time=fc.generated_time,
            is_forecast=True,
            hourly=[
                WeatherForecastHourResponse(
                    forecast_time=h.forecast_time,
                    is_forecast=True,
                    temperature_c=h.temperature_c,
                    relative_humidity_pct=h.relative_humidity_pct,
                    cloud_cover_pct=h.cloud_cover_pct,
                    ghi_irradiance_wm2=h.ghi_irradiance_wm2,
                    wind_speed_ms=h.wind_speed_ms,
                    weather_code=h.weather_code,
                    condition_description=h.condition_description,
                )
                for h in fc.hourly
            ],
        )

    def record_weather_observation(
        self,
        db: Session,
        create_in: WeatherRecordCreate,
    ) -> WeatherRecord:
        """Persist a manual or IoT station weather observation."""
        plant = db.get(Plant, create_in.plant_id)
        if not plant:
            raise EntityNotFoundError("Plant", create_in.plant_id)

        ts = create_in.timestamp.replace(tzinfo=None) if create_in.timestamp.tzinfo else create_in.timestamp
        record = WeatherRecord(
            plant_id=plant.id,
            timestamp=ts,
            poa_irradiance_wm2=create_in.poa_irradiance_wm2,
            ghi_irradiance_wm2=create_in.ghi_irradiance_wm2,
            ambient_temperature_c=create_in.ambient_temperature_c,
            cell_temperature_c=create_in.cell_temperature_c,
            wind_speed_ms=create_in.wind_speed_ms,
            cloud_cover_pct=create_in.cloud_cover_pct,
            data_source=create_in.data_source,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    def analyze_cloud_vs_abnormal(
        self,
        db: Session,
        plant_id: int,
        observed_power_kw: float,
        timestamp: Optional[datetime] = None,
    ) -> CloudPerformanceAnalysisResponse:
        """Assess whether a power reduction is consistent with cloud cover vs a potential fault."""
        plant = db.get(Plant, plant_id)
        if not plant:
            raise EntityNotFoundError("Plant", plant_id)

        eval_ts = timestamp or datetime.now(timezone.utc)
        eval_utc = eval_ts.replace(tzinfo=None) if eval_ts.tzinfo else eval_ts
        lat = plant.latitude or 20.2961
        lon = plant.longitude or 85.8245

        # Check for WeatherRecord near evaluation timestamp
        historical_wr_stmt = (
            select(WeatherRecord)
            .where(
                WeatherRecord.plant_id == plant.id,
                WeatherRecord.timestamp >= eval_utc - timedelta(hours=1),
                WeatherRecord.timestamp <= eval_utc + timedelta(hours=1),
            )
            .order_by(desc(WeatherRecord.timestamp))
            .limit(1)
        )
        historical_wr = db.scalars(historical_wr_stmt).first()

        if historical_wr:
            cloud_pct = historical_wr.cloud_cover_pct
            irr_wm2 = historical_wr.poa_irradiance_wm2 or historical_wr.ghi_irradiance_wm2
            temp_c = historical_wr.ambient_temperature_c
            source_name = f"DB_{historical_wr.data_source}"
        else:
            weather_obs = self.get_current_weather(db, plant_id=plant.id)
            cloud_pct = weather_obs.cloud_cover_pct
            irr_wm2 = weather_obs.poa_irradiance_wm2 or weather_obs.ghi_irradiance_wm2
            temp_c = weather_obs.temperature_c
            source_name = weather_obs.source

        # Clear sky calculation
        clear_sky_calc = expected_generation_service.estimate_expected_power(
            installed_capacity_kwp=plant.installed_capacity_kwp,
            timestamp=eval_ts,
            latitude=lat,
            longitude=lon,
        )
        expected_clear = clear_sky_calc.expected_power_kw

        # Weather-adjusted expected power
        weather_calc = expected_generation_service.estimate_expected_power(
            installed_capacity_kwp=plant.installed_capacity_kwp,
            timestamp=eval_ts,
            latitude=lat,
            longitude=lon,
            poa_irradiance_wm2=irr_wm2,
            cloud_cover_pct=cloud_pct,
            ambient_temp_c=temp_c,
        )
        weather_adj_exp = weather_calc.expected_power_kw


        # Check if reduction is weather-explained
        if expected_clear <= 0.05:
            # Night or low sun
            is_weather_explained = True
            summary = "Sun is below operational elevation threshold; zero generation is normal."
            conf = 0.99
        elif cloud_pct is not None and cloud_pct >= 60.0:
            # High cloud cover
            if observed_power_kw >= (weather_adj_exp * 0.70):
                is_weather_explained = True
                summary = f"Observed generation ({observed_power_kw:.2f} kW) aligns with heavy cloud cover ({cloud_pct:.0f}%)."
                conf = 0.92
            else:
                is_weather_explained = False
                summary = f"Generation ({observed_power_kw:.2f} kW) is significantly below weather-adjusted expectation ({weather_adj_exp:.2f} kW)."
                conf = 0.85
        elif observed_power_kw >= (expected_clear * 0.85):
            is_weather_explained = True
            summary = "System is operating at nominal capacity under clear skies."
            conf = 0.95
        else:
            is_weather_explained = False
            summary = f"Power deficit of {max(0, expected_clear - observed_power_kw):.2f} kW cannot be explained by weather alone."
            conf = 0.88

        return CloudPerformanceAnalysisResponse(
            plant_id=plant.id,
            timestamp=eval_ts,
            observed_power_kw=round(observed_power_kw, 2),
            expected_clear_sky_kw=round(expected_clear, 2),
            weather_adjusted_expected_kw=round(weather_adj_exp, 2),
            cloud_cover_pct=cloud_pct,
            irradiance_wm2=irr_wm2,
            is_weather_explained=is_weather_explained,
            explanation_summary=summary,
            confidence_score=conf,
            weather_source=source_name,
        )



weather_service = WeatherService()
