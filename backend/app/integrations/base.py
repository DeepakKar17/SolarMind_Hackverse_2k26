"""SolarMind Modular Inverter Integration Provider Interface.

Defines the abstract base contract and normalized internal schemas for all solar
hardware integrations (Deye Cloud OpenAPI, Sungrow, Huawei, Simulator).
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class ConnectionTestResult:
    """Standardized result of hardware connection and ping verification."""

    success: bool
    provider: str
    status_code: int
    latency_ms: float
    message: str
    timestamp: datetime
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedPlantDiscovery:
    """Normalized solar power plant / station metadata."""

    external_id: str
    name: str
    location: str
    installed_capacity_kwp: float
    timezone: str = "UTC"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: str = "NORMAL"
    raw_metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedDeviceDiscovery:
    """Normalized string inverter device metadata."""

    device_sn: str
    plant_external_id: Optional[str]
    model: str
    manufacturer: str
    rated_ac_power_kw: float
    firmware_version: Optional[str] = None
    status: str = "NORMAL"
    raw_metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedTelemetry:
    """Normalized 5-minute electrical telemetry record."""

    device_sn: str
    timestamp: datetime
    p_ac: float  # AC Active Power in W or kW (normalized to W)
    v_ac: float  # AC Voltage in V
    i_ac: float  # AC Current in A
    v_dc1: float  # PV1 DC Voltage in V
    i_dc1: float  # PV1 DC Current in A
    p_dc1: float  # PV1 DC Power in W
    v_dc2: Optional[float] = None  # PV2 DC Voltage in V
    i_dc2: Optional[float] = None  # PV2 DC Current in A
    p_dc2: Optional[float] = None  # PV2 DC Power in W
    daily_yield_kwh: float = 0.0  # Daily generation in kWh
    total_yield_kwh: float = 0.0  # Lifetime cumulative yield in kWh
    temperature_c: Optional[float] = None  # Inverter heatsink temperature
    grid_frequency_hz: Optional[float] = 50.0  # Grid frequency in Hz
    efficiency_pct: Optional[float] = None  # DC-to-AC conversion efficiency %
    operating_state: str = "NORMAL"  # 'NORMAL', 'STANDBY', 'FAULT', 'OFFLINE'
    is_simulated: bool = False
    raw_payload: Optional[Dict[str, Any]] = None


@dataclass
class NormalizedAlert:
    """Normalized hardware fault / trip alarm."""

    alert_id: str
    plant_external_id: Optional[str]
    device_sn: str
    code: str
    severity: str  # 'INFO', 'WARNING', 'HIGH', 'CRITICAL'
    message: str
    timestamp: datetime
    is_active: bool = True
    actionable_guidance: Optional[str] = None
    raw_metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedDeviceStatus:
    """Normalized live connection and operational status."""

    device_sn: str
    is_online: bool
    last_seen: datetime
    status_code: str
    firmware_version: Optional[str] = None
    communication_signal_pct: Optional[float] = None


@dataclass
class SyncRunSummary:
    """Summary metrics of an integration sync execution."""

    integration_id: str
    provider: str
    status: str  # 'SUCCESS', 'PARTIAL', 'FAILED'
    records_ingested: int
    errors_count: int
    duration_seconds: float
    started_at: datetime
    completed_at: datetime
    details: Optional[str] = None


class BaseInverterProvider(ABC):
    """Abstract Base Class for all solar inverter cloud and hardware providers."""

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Unique provider identifier (e.g. 'deye-cloud', 'sungrow', 'simulator')."""
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable provider name."""
        pass

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        """Evaluate if required API credentials and URLs are supplied."""
        pass

    @abstractmethod
    async def test_connection(self) -> ConnectionTestResult:
        """Perform a live round-trip ping and credential validation."""
        pass

    @abstractmethod
    async def discover_plants(self) -> List[NormalizedPlantDiscovery]:
        """Discover solar plants/stations registered under the account."""
        pass

    @abstractmethod
    async def discover_devices(self, plant_external_id: Optional[str] = None) -> List[NormalizedDeviceDiscovery]:
        """Discover inverters and data-loggers associated with plants."""
        pass

    @abstractmethod
    async def get_latest_telemetry(self, device_sn: str) -> Optional[NormalizedTelemetry]:
        """Query the latest electrical telemetry metrics for a device."""
        pass

    @abstractmethod
    async def get_historical_telemetry(
        self,
        device_sn: str,
        start_time: datetime,
        end_time: datetime,
    ) -> List[NormalizedTelemetry]:
        """Query historical time-series generation records."""
        pass

    @abstractmethod
    async def get_device_status(self, device_sn: str) -> NormalizedDeviceStatus:
        """Query online status and connectivity health."""
        pass

    @abstractmethod
    async def get_alerts(
        self,
        plant_external_id: Optional[str] = None,
        device_sn: Optional[str] = None,
    ) -> List[NormalizedAlert]:
        """Query hardware alarm trips and fault logs."""
        pass
