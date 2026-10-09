"""SolarMind Expected-Generation Engine.

Calculates deterministic, physics-based, and calibrated solar generation expectations
using plant geographic coordinates, solar celestial geometry, plane-of-array (POA)
irradiance, ambient/cell temperature derating, and healthy historical benchmarks.
"""

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Tuple
from app.schemas.why_low import ExpectedPowerCalculation, SolarPositionInfo

# Physical Constants & PV Parameters
SOLAR_CONSTANT_WM2 = 1367.0
STC_IRRADIANCE_WM2 = 1000.0
STC_CELL_TEMP_C = 25.0
DEFAULT_TEMP_COEFF_PMAX = -0.0038  # -0.38% / °C for crystalline silicon
DEFAULT_NOCT_C = 45.0  # Nominal Operating Cell Temperature
DEFAULT_INVERTER_EFFICIENCY = 0.97
DEFAULT_CLEAN_TRANSMISSION_FACTOR = 0.98
DEFAULT_OVERALL_CLEAR_SKY_DERATE = 0.82

# Fallback coordinates for India (Bhubaneswar / Central Odisha)
DEFAULT_LATITUDE = 20.2961
DEFAULT_LONGITUDE = 85.8245


class ExpectedGenerationService:
    """Service computing expected solar power output using physical and calibrated models."""

    @staticmethod
    def calculate_solar_position(
        timestamp: datetime,
        latitude: float = DEFAULT_LATITUDE,
        longitude: float = DEFAULT_LONGITUDE,
    ) -> SolarPositionInfo:
        """Compute solar elevation, zenith, azimuth, and theoretical clear-sky irradiance.

        Args:
            timestamp: UTC datetime of observation.
            latitude: Geographic latitude in decimal degrees (-90 to +90).
            longitude: Geographic longitude in decimal degrees (-180 to +180).

        Returns:
            SolarPositionInfo with solar angles and clear-sky POA irradiance.
        """
        # Ensure UTC naive representation for math
        if timestamp.tzinfo is not None:
            ts = timestamp.astimezone(timezone.utc).replace(tzinfo=None)
        else:
            ts = timestamp

        day_of_year = ts.timetuple().tm_yday
        hour_fraction = ts.hour + (ts.minute / 60.0) + (ts.second / 3600.0)

        # 1. Fractional year in radians
        gamma = (2.0 * math.pi / 365.0) * (day_of_year - 1 + (hour_fraction - 12.0) / 24.0)

        # 2. Solar declination angle delta (in radians)
        # Spencer's formula for solar declination
        declination_rad = (
            0.006918
            - 0.399912 * math.cos(gamma)
            + 0.070257 * math.sin(gamma)
            - 0.006758 * math.cos(2.0 * gamma)
            + 0.000907 * math.sin(2.0 * gamma)
            - 0.002697 * math.cos(3.0 * gamma)
            + 0.00148 * math.sin(3.0 * gamma)
        )
        declination_deg = math.degrees(declination_rad)

        # 3. Equation of Time (EoT in minutes)
        eot_minutes = 229.18 * (
            0.000075
            + 0.001868 * math.cos(gamma)
            - 0.032077 * math.sin(gamma)
            - 0.014615 * math.cos(2.0 * gamma)
            - 0.040849 * math.sin(2.0 * gamma)
        )

        # 4. Solar Time & Hour Angle (omega)
        # Longitude offset in minutes (4 min per degree from Greenwich UTC)
        time_offset_minutes = eot_minutes + (4.0 * longitude)
        true_solar_time_minutes = (hour_fraction * 60.0) + time_offset_minutes
        solar_time_hours = (true_solar_time_minutes / 60.0) % 24.0

        hour_angle_deg = 15.0 * (solar_time_hours - 12.0)
        hour_angle_rad = math.radians(hour_angle_deg)

        lat_rad = math.radians(latitude)

        # 5. Solar Elevation Angle (alpha)
        sin_elevation = (
            math.sin(lat_rad) * math.sin(declination_rad)
            + math.cos(lat_rad) * math.cos(declination_rad) * math.cos(hour_angle_rad)
        )
        # Clamp to [-1.0, 1.0] for arcsin safety
        sin_elevation = max(-1.0, min(1.0, sin_elevation))
        elevation_rad = math.asin(sin_elevation)
        elevation_deg = math.degrees(elevation_rad)

        # 6. Solar Zenith Angle (theta_z)
        zenith_deg = max(0.0, 90.0 - elevation_deg)
        zenith_rad = math.radians(zenith_deg)

        # 7. Solar Azimuth Angle (gamma_s)
        cos_azimuth = 0.0
        if math.cos(elevation_rad) != 0.0:
            cos_azimuth = (
                (math.sin(elevation_rad) * math.sin(lat_rad) - math.sin(declination_rad))
                / (math.cos(elevation_rad) * math.cos(lat_rad))
            )
            cos_azimuth = max(-1.0, min(1.0, cos_azimuth))

        azimuth_deg = math.degrees(math.acos(cos_azimuth))
        if hour_angle_deg > 0:
            azimuth_deg = 360.0 - azimuth_deg

        # 8. Clear-Sky Irradiance Model (Haurwitz / Ineichen Formulation)
        is_daylight = elevation_deg > 0.0
        clear_sky_wm2 = 0.0

        if elevation_deg > 2.0:
            # Extraterrestrial normal solar irradiance adjusted for orbital eccentricity
            eccentricity_factor = 1.0 + 0.033 * math.cos(2.0 * math.pi * day_of_year / 365.0)
            g_on = SOLAR_CONSTANT_WM2 * eccentricity_factor

            # Relative Air Mass (Kasten-Young model)
            air_mass = 1.0 / (
                math.sin(elevation_rad)
                + 0.50572 * math.pow(max(0.1, elevation_deg + 6.07995), -1.6364)
            )
            air_mass = max(1.0, min(20.0, air_mass))

            # Empirical atmospheric beam transmission
            direct_normal = g_on * math.pow(0.7, math.pow(air_mass, 0.678))
            diffuse_horizontal = 0.1 * g_on * math.sin(elevation_rad)

            # Global clear sky estimate
            clear_sky_wm2 = max(0.0, (direct_normal * math.sin(elevation_rad)) + diffuse_horizontal)

        return SolarPositionInfo(
            solar_elevation_deg=round(elevation_deg, 2),
            solar_zenith_deg=round(zenith_deg, 2),
            solar_azimuth_deg=round(azimuth_deg, 2),
            is_daylight=is_daylight,
            clear_sky_irradiance_wm2=round(clear_sky_wm2, 1),
        )

    @staticmethod
    def calculate_cell_temperature(
        ambient_temp_c: Optional[float],
        poa_irradiance_wm2: Optional[float],
        noct_c: float = DEFAULT_NOCT_C,
    ) -> Optional[float]:
        """Estimate PV module cell temperature from ambient temperature and irradiance.

        Formula: T_cell = T_ambient + (G_POA / 800.0) * (NOCT - 20.0)
        """
        if ambient_temp_c is None:
            return None
        if poa_irradiance_wm2 is None or poa_irradiance_wm2 <= 0.0:
            return ambient_temp_c

        cell_temp = ambient_temp_c + (poa_irradiance_wm2 / 800.0) * (noct_c - 20.0)
        return round(cell_temp, 2)

    @staticmethod
    def calculate_temperature_derating(
        cell_temperature_c: Optional[float],
        temp_coeff_pmax: float = DEFAULT_TEMP_COEFF_PMAX,
    ) -> float:
        """Compute thermal derate factor f_temp = 1 + gamma * (T_cell - 25°C)."""
        if cell_temperature_c is None:
            return 1.0  # Nominal baseline (no derating applied)

        delta_t = cell_temperature_c - STC_CELL_TEMP_C
        derate_factor = 1.0 + (temp_coeff_pmax * delta_t)
        # Bounded between 0.60 (extreme heat) and 1.25 (extreme cold enhancement)
        return max(0.60, min(1.25, derate_factor))

    def estimate_expected_power(
        self,
        *,
        installed_capacity_kwp: float,
        timestamp: datetime,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        poa_irradiance_wm2: Optional[float] = None,
        temperature_c: Optional[float] = None,  # Inverter core or cell temp
        ambient_temp_c: Optional[float] = None,
        cloud_cover_pct: Optional[float] = None,
        historical_healthy_points: Optional[List[Tuple[datetime, float]]] = None,
    ) -> ExpectedPowerCalculation:
        """Estimate expected instantaneous power (kW) using the most specific valid baseline model.

        Baseline selection order:
        1. Night / Low Sun (<3° elevation): NIGHT_ZERO_SOLAR_BASELINE (0.0 kW).
        2. Direct POA irradiance + temperature: PHYSICAL_IRRADIANCE_AND_TEMPERATURE.
        3. Weather station irradiance + cloud cover: WEATHER_STATION_IRRADIANCE.
        4. Healthy historical operating baseline: HISTORICAL_CALIBRATED_BENCHMARK.
        5. Solar position + clear-sky model: CLEAR_SKY_SOLAR_POSITION.
        """
        lat = latitude if latitude is not None else DEFAULT_LATITUDE
        lon = longitude if longitude is not None else DEFAULT_LONGITUDE
        ts = timestamp.astimezone(timezone.utc).replace(tzinfo=None) if timestamp.tzinfo is not None else timestamp

        # Compute solar celestial position
        solar_pos = self.calculate_solar_position(timestamp=ts, latitude=lat, longitude=lon)


        # 1. Night-Time or Low Sun Zenith Check
        if not solar_pos.is_daylight or solar_pos.solar_elevation_deg < 3.0:
            return ExpectedPowerCalculation(
                installed_capacity_kwp=round(installed_capacity_kwp, 2),
                expected_power_kw=0.0,
                baseline_method="NIGHT_ZERO_SOLAR_BASELINE",
                solar_position=solar_pos,
                temperature_derate_factor=1.0,
                soiling_derate_factor=DEFAULT_CLEAN_TRANSMISSION_FACTOR,
                inverter_efficiency=DEFAULT_INVERTER_EFFICIENCY,
                inputs_used={
                    "solar_elevation_deg": solar_pos.solar_elevation_deg,
                    "reason": "Sun below operational threshold (elevation < 3°). Expected generation is 0 kW.",
                },
            )

        # Determine Cell Temperature
        effective_cell_temp = temperature_c
        if effective_cell_temp is None and ambient_temp_c is not None:
            effective_cell_temp = self.calculate_cell_temperature(
                ambient_temp_c=ambient_temp_c,
                poa_irradiance_wm2=poa_irradiance_wm2 or solar_pos.clear_sky_irradiance_wm2,
            )

        f_temp = self.calculate_temperature_derating(effective_cell_temp)
        eta_inv = DEFAULT_INVERTER_EFFICIENCY
        eta_clean = DEFAULT_CLEAN_TRANSMISSION_FACTOR

        # 2. Method 1: Measured Plane-of-Array Irradiance & Temperature
        if poa_irradiance_wm2 is not None and poa_irradiance_wm2 >= 0.0:
            # Physical formula: P_exp = P_stc * (G_poa / 1000) * f_temp * eta_inv * eta_clean
            irr_factor = poa_irradiance_wm2 / STC_IRRADIANCE_WM2
            expected_p = installed_capacity_kwp * irr_factor * f_temp * eta_inv * eta_clean
            expected_p = max(0.0, min(installed_capacity_kwp * 1.15, expected_p))

            return ExpectedPowerCalculation(
                installed_capacity_kwp=round(installed_capacity_kwp, 2),
                expected_power_kw=round(expected_p, 3),
                baseline_method="PHYSICAL_IRRADIANCE_AND_TEMPERATURE",
                solar_position=solar_pos,
                temperature_derate_factor=round(f_temp, 4),
                soiling_derate_factor=eta_clean,
                inverter_efficiency=eta_inv,
                inputs_used={
                    "poa_irradiance_wm2": round(poa_irradiance_wm2, 1),
                    "effective_cell_temp_c": round(effective_cell_temp, 1) if effective_cell_temp is not None else None,
                    "ambient_temp_c": round(ambient_temp_c, 1) if ambient_temp_c is not None else None,
                    "derate_factor": round(f_temp * eta_inv * eta_clean, 4),
                },
            )

        # 3. Method 2: Weather Station Irradiance + Cloud Cover
        if cloud_cover_pct is not None and cloud_cover_pct > 0.0:
            # Kasten-Czeplak cloud attenuation model on clear sky
            # G_cloud = G_clear * (1 - 0.75 * (C / 100)^3.4)
            cloud_fraction = min(1.0, max(0.0, cloud_cover_pct / 100.0))
            attenuation = max(0.15, 1.0 - 0.75 * math.pow(cloud_fraction, 3.0))
            estimated_g = solar_pos.clear_sky_irradiance_wm2 * attenuation
            irr_factor = estimated_g / STC_IRRADIANCE_WM2
            expected_p = installed_capacity_kwp * irr_factor * f_temp * eta_inv * eta_clean
            expected_p = max(0.0, min(installed_capacity_kwp * 1.15, expected_p))

            return ExpectedPowerCalculation(
                installed_capacity_kwp=round(installed_capacity_kwp, 2),
                expected_power_kw=round(expected_p, 3),
                baseline_method="WEATHER_STATION_IRRADIANCE",
                solar_position=solar_pos,
                temperature_derate_factor=round(f_temp, 4),
                soiling_derate_factor=eta_clean,
                inverter_efficiency=eta_inv,
                inputs_used={
                    "cloud_cover_pct": round(cloud_cover_pct, 1),
                    "estimated_cloud_attenuated_irradiance_wm2": round(estimated_g, 1),
                    "clear_sky_wm2": solar_pos.clear_sky_irradiance_wm2,
                },
            )

        # 4. Method 3: Historical Calibrated Benchmark
        if historical_healthy_points and len(historical_healthy_points) >= 5:
            # Filter historical readings within +/- 30 minutes solar time
            target_minute = (ts.hour * 60) + ts.minute
            matching_powers: List[float] = []
            for h_ts, h_p in historical_healthy_points:
                h_min = (h_ts.hour * 60) + h_ts.minute
                if abs(h_min - target_minute) <= 45 and h_p > 0.0:
                    matching_powers.append(h_p)

            if len(matching_powers) >= 3:
                # 90th percentile of healthy historical generation at this time of day
                matching_powers.sort()
                p90_idx = int(math.ceil(0.90 * len(matching_powers))) - 1
                p90_power = matching_powers[max(0, min(len(matching_powers) - 1, p90_idx))]

                return ExpectedPowerCalculation(
                    installed_capacity_kwp=round(installed_capacity_kwp, 2),
                    expected_power_kw=round(p90_power, 3),
                    baseline_method="HISTORICAL_CALIBRATED_BENCHMARK",
                    solar_position=solar_pos,
                    temperature_derate_factor=round(f_temp, 4),
                    soiling_derate_factor=eta_clean,
                    inverter_efficiency=eta_inv,
                    inputs_used={
                        "historical_sample_count": len(matching_powers),
                        "p90_calibrated_kw": round(p90_power, 3),
                        "solar_time_minute": target_minute,
                    },
                )

        # 5. Method 4: Clear-Sky Solar Geometry Model (Standard Baseline)
        irr_factor = solar_pos.clear_sky_irradiance_wm2 / STC_IRRADIANCE_WM2
        expected_p = installed_capacity_kwp * irr_factor * DEFAULT_OVERALL_CLEAR_SKY_DERATE
        expected_p = max(0.0, min(installed_capacity_kwp * 1.15, expected_p))

        return ExpectedPowerCalculation(
            installed_capacity_kwp=round(installed_capacity_kwp, 2),
            expected_power_kw=round(expected_p, 3),
            baseline_method="CLEAR_SKY_SOLAR_POSITION",
            solar_position=solar_pos,
            temperature_derate_factor=DEFAULT_OVERALL_CLEAR_SKY_DERATE,
            soiling_derate_factor=eta_clean,
            inverter_efficiency=eta_inv,
            inputs_used={
                "clear_sky_irradiance_wm2": solar_pos.clear_sky_irradiance_wm2,
                "solar_elevation_deg": solar_pos.solar_elevation_deg,
                "overall_derate": DEFAULT_OVERALL_CLEAR_SKY_DERATE,
            },
        )


expected_generation_service = ExpectedGenerationService()
