"""SolarMind Synthetic Inverter Simulation Provider.

Explicitly labeled simulator fallback used when live Deye Cloud credentials are
unavailable. Generates physics-consistent single-string diurnal curves while
flagging all telemetry records with is_simulated=True.
"""

import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.integrations.base import (
    BaseInverterProvider,
    ConnectionTestResult,
    NormalizedAlert,
    NormalizedDeviceDiscovery,
    NormalizedDeviceStatus,
    NormalizedPlantDiscovery,
    NormalizedTelemetry,
)


class SimulatedInverterProvider(BaseInverterProvider):
    """Truthful simulation provider clearly distinguished from live OEM hardware."""

    def __init__(self, plant_capacity_kwp: float = 5.5):
        self.capacity_kwp = plant_capacity_kwp

    @property
    def provider_id(self) -> str:
        return "simulator"

    @property
    def provider_name(self) -> str:
        return "SolarMind Synthetic Telemetry Simulator"

    @property
    def is_configured(self) -> bool:
        return True

    async def test_connection(self) -> ConnectionTestResult:
        """Simulate instantaneous successful ping."""
        return ConnectionTestResult(
            success=True,
            provider=self.provider_name,
            status_code=200,
            latency_ms=1.5,
            message="Simulator operational. Generating realistic solar telemetry curves.",
            timestamp=datetime.now(timezone.utc),
            details={"is_simulated": True, "model": "SolarMind Single-String Physics Engine"},
        )

    async def discover_plants(self) -> List[NormalizedPlantDiscovery]:
        """Return simulated plant definitions."""
        return [
            NormalizedPlantDiscovery(
                external_id="SIM-PLANT-001",
                name="Simulated Residential Rooftop Array",
                location="Bhubaneswar, Odisha, India",
                installed_capacity_kwp=self.capacity_kwp,
                timezone="Asia/Kolkata",
                latitude=20.2961,
                longitude=85.8245,
                status="NORMAL",
                raw_metadata={"is_simulated": True},
            )
        ]

    async def discover_devices(self, plant_external_id: Optional[str] = None) -> List[NormalizedDeviceDiscovery]:
        """Return simulated inverter units."""
        return [
            NormalizedDeviceDiscovery(
                device_sn="SIM-INV-5000TL-01",
                plant_external_id=plant_external_id or "SIM-PLANT-001",
                model="Deye-SUN-5K-SG04LP1 (Simulated)",
                manufacturer="Deye (Simulated)",
                rated_ac_power_kw=5.0,
                firmware_version="v-sim-1.0",
                status="NORMAL",
                raw_metadata={"is_simulated": True},
            )
        ]

    def _generate_synthetic_point(self, device_sn: str, dt: datetime) -> NormalizedTelemetry:
        """Calculate physics-based solar generation for a given timestamp."""
        hour_fraction = dt.hour + (dt.minute / 60.0)

        # Diurnal bell curve between 06:00 and 18:00
        if 6.0 <= hour_fraction <= 18.0:
            solar_zenith_ratio = math.sin((hour_fraction - 6.0) / 12.0 * math.pi)
            poa_irradiance = 980.0 * (solar_zenith_ratio ** 1.3)
            p_dc = self.capacity_kwp * 1000.0 * (poa_irradiance / 1000.0) * 0.85
            v_dc = 360.0 + (15.0 * solar_zenith_ratio)
            i_dc = p_dc / max(1.0, v_dc)
            v_ac = 230.0 + (2.0 * math.sin(hour_fraction))
            p_ac = p_dc * 0.975  # 97.5% inverter efficiency
            i_ac = p_ac / max(1.0, v_ac)
            temp = 28.0 + (22.0 * solar_zenith_ratio)
        else:
            poa_irradiance = 0.0
            p_dc = 0.0
            v_dc = 0.0
            i_dc = 0.0
            v_ac = 230.0
            p_ac = 0.0
            i_ac = 0.0
            temp = 25.0

        daily_kwh = max(0.0, self.capacity_kwp * 4.2 * (max(0.0, hour_fraction - 6.0) / 12.0))

        return NormalizedTelemetry(
            device_sn=device_sn,
            timestamp=dt,
            p_ac=round(p_ac, 2),
            v_ac=round(v_ac, 2),
            i_ac=round(i_ac, 2),
            v_dc1=round(v_dc, 2),
            i_dc1=round(i_dc, 2),
            p_dc1=round(p_dc, 2),
            v_dc2=None,
            i_dc2=None,
            p_dc2=None,
            daily_yield_kwh=round(daily_kwh, 2),
            total_yield_kwh=round(12450.0 + daily_kwh, 2),
            temperature_c=round(temp, 1),
            grid_frequency_hz=50.02,
            efficiency_pct=97.5 if p_ac > 0 else 0.0,
            operating_state="NORMAL" if p_ac > 0 else "STANDBY",
            is_simulated=True,
            raw_payload={"irradiance_w_m2": round(poa_irradiance, 1), "simulator": "SolarMind Physics Engine"},
        )

    async def get_latest_telemetry(self, device_sn: str) -> Optional[NormalizedTelemetry]:
        """Generate real-time telemetry point for current time."""
        return self._generate_synthetic_point(device_sn, datetime.now(timezone.utc))

    async def get_historical_telemetry(
        self,
        device_sn: str,
        start_time: datetime,
        end_time: datetime,
    ) -> List[NormalizedTelemetry]:
        """Generate interval-stepped synthetic points across date range."""
        results = []
        curr = start_time
        step = timedelta(minutes=5)
        while curr <= end_time:
            results.append(self._generate_synthetic_point(device_sn, curr))
            curr += step
            if len(results) >= 500:  # Bound response
                break
        return results

    async def get_device_status(self, device_sn: str) -> NormalizedDeviceStatus:
        """Simulate healthy online status."""
        return NormalizedDeviceStatus(
            device_sn=device_sn,
            is_online=True,
            last_seen=datetime.now(timezone.utc),
            status_code="SIMULATED_NORMAL",
            firmware_version="v-sim-1.0",
            communication_signal_pct=100.0,
        )

    async def get_alerts(
        self,
        plant_external_id: Optional[str] = None,
        device_sn: Optional[str] = None,
    ) -> List[NormalizedAlert]:
        """Return empty alert list in normal simulation mode."""
        return []
