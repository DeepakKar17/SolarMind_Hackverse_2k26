"""SolarMind Hardware & Cloud Integration Providers."""

from app.integrations.base import (
    BaseInverterProvider,
    ConnectionTestResult,
    NormalizedAlert,
    NormalizedDeviceDiscovery,
    NormalizedDeviceStatus,
    NormalizedPlantDiscovery,
    NormalizedTelemetry,
    SyncRunSummary,
)
from app.integrations.deye.client import (
    DeyeAPIError,
    DeyeAuthenticationError,
    DeyeCloudClient,
    DeyeRateLimitError,
)
from app.integrations.deye.provider import DeyeInverterProvider
from app.integrations.simulator.provider import SimulatedInverterProvider
from app.integrations.sync_service import IntegrationSyncService, integration_sync_service

__all__ = [
    "BaseInverterProvider",
    "ConnectionTestResult",
    "NormalizedPlantDiscovery",
    "NormalizedDeviceDiscovery",
    "NormalizedTelemetry",
    "NormalizedAlert",
    "NormalizedDeviceStatus",
    "SyncRunSummary",
    "DeyeCloudClient",
    "DeyeAPIError",
    "DeyeAuthenticationError",
    "DeyeRateLimitError",
    "DeyeInverterProvider",
    "SimulatedInverterProvider",
    "IntegrationSyncService",
    "integration_sync_service",
]
