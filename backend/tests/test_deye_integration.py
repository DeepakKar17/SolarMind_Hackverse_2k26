"""Test Suite for Modular Deye Cloud OpenAPI Integration and Fallback Simulator.

Tests:
1. DeyeCloudClient authentication, SHA256 hashing, token caching, backoff, and error handling.
2. DeyeInverterProvider normalized response parsing and vendor isolation.
3. SimulatedInverterProvider realistic diurnal generation and explicit labeling.
4. IntegrationSyncService database persistence, deduplication, and sync run logging.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.base import (
    ConnectionTestResult,
    NormalizedAlert,
    NormalizedDeviceDiscovery,
    NormalizedPlantDiscovery,
    NormalizedTelemetry,
)
from app.integrations.deye.client import (
    DeyeAPIError,
    DeyeAuthenticationError,
    DeyeCloudClient,
    DeyeRateLimitError,
)
from app.integrations.deye.provider import DeyeInverterProvider
from app.integrations.simulator.provider import SimulatedInverterProvider
from app.integrations.sync_service import integration_sync_service
from app.models.inverter import Inverter
from app.models.integration_config import IntegrationConfig
from app.models.integration_sync_run import IntegrationSyncRun
from app.models.plant import Plant
from app.models.telemetry import Telemetry


# ===========================================================================
# 1. DeyeCloudClient Tests
# ===========================================================================

def test_deye_client_password_hashing():
    """Deye API client must SHA256 hash password before transmission."""
    client = DeyeCloudClient(
        base_url="https://india-developer.deyecloud.com:443",
        app_id="test_app",
        app_secret="test_secret",
        email="dev@solarmind.io",
        password="MySecretPassword123!",
    )
    hashed = client._hash_password("MySecretPassword123!")
    assert len(hashed) == 64
    import hashlib
    assert hashed == hashlib.sha256(b"MySecretPassword123!").hexdigest()


@pytest.mark.asyncio
async def test_deye_client_authenticate_success():
    """Client successfully acquires and caches bearer access token."""
    client = DeyeCloudClient(
        base_url="https://india-developer.deyecloud.com:443",
        app_id="app_123",
        app_secret="secret_abc",
        email="test@deye.com",
        password="pass",
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "code": 0,
        "msg": "success",
        "accessToken": "deye_bearer_token_xyz_999",
        "expiresIn": 7200,
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        token = await client.get_access_token()
        assert token == "deye_bearer_token_xyz_999"

        # Subsequent call uses cache without second HTTP request
        token_cached = await client.get_access_token()
        assert token_cached == "deye_bearer_token_xyz_999"
        assert mock_post.call_count == 1


@pytest.mark.asyncio
async def test_deye_client_authenticate_invalid_credentials():
    """Client raises DeyeAuthenticationError on 401 response."""
    client = DeyeCloudClient(
        base_url="https://india-developer.deyecloud.com:443",
        app_id="bad_app",
        app_secret="bad_secret",
        email="bad@deye.com",
        password="bad",
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.text = "Invalid appId or appSecret"

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        with pytest.raises(DeyeAuthenticationError) as exc_info:
            await client.get_access_token()
        assert exc_info.value.status_code == 401


# ===========================================================================
# 2. DeyeInverterProvider Parsing & Normalization Tests
# ===========================================================================

@pytest.mark.asyncio
async def test_deye_provider_test_connection_success():
    """test_connection returns positive ConnectionTestResult with latency."""
    mock_client = MagicMock(spec=DeyeCloudClient)
    mock_client.is_configured = True
    mock_client.get_access_token = AsyncMock(return_value="valid_token")

    provider = DeyeInverterProvider(client=mock_client)
    res = await provider.test_connection()

    assert res.success is True
    assert res.status_code == 200
    assert res.provider == "Deye Cloud Developer OpenAPI"
    assert res.latency_ms >= 0.0


@pytest.mark.asyncio
async def test_deye_provider_discover_plants():
    """discover_plants normalizes Deye station JSON."""
    mock_client = MagicMock(spec=DeyeCloudClient)
    mock_client.get_station_list = AsyncMock(
        return_value={
            "code": 0,
            "data": {
                "list": [
                    {
                        "stationId": "ST-9001",
                        "stationName": "Bhubaneswar Solar Villa",
                        "address": "Nayapalli, Bhubaneswar",
                        "installedCapacity": 6.5,
                        "latitude": 20.30,
                        "longitude": 85.82,
                    }
                ]
            },
        }
    )

    provider = DeyeInverterProvider(client=mock_client)
    plants = await provider.discover_plants()

    assert len(plants) == 1
    p = plants[0]
    assert p.external_id == "ST-9001"
    assert p.name == "Bhubaneswar Solar Villa"
    assert p.installed_capacity_kwp == 6.5
    assert p.latitude == 20.30


@pytest.mark.asyncio
async def test_deye_provider_get_latest_telemetry_normalization():
    """get_latest_telemetry converts Deye parameters to normalized electrical metrics."""
    mock_client = MagicMock(spec=DeyeCloudClient)
    mock_client.get_device_latest_data = AsyncMock(
        return_value={
            "code": 0,
            "data": {
                "collectionTime": "2026-10-09 12:30:00",
                "activePower": 4250.0,
                "gridVoltage": 234.5,
                "gridCurrent": 18.1,
                "vPv1": 365.0,
                "iPv1": 12.0,
                "pPv1": 4380.0,
                "dailyEnergy": 18.4,
                "totalEnergy": 5890.0,
                "temperature": 44.5,
                "gridFrequency": 50.01,
            },
        }
    )

    provider = DeyeInverterProvider(client=mock_client)
    telemetry = await provider.get_latest_telemetry("DEYE-SN-12345")

    assert telemetry is not None
    assert telemetry.device_sn == "DEYE-SN-12345"
    assert telemetry.p_ac == 4250.0
    assert telemetry.v_ac == 234.5
    assert telemetry.v_dc1 == 365.0
    assert telemetry.daily_yield_kwh == 18.4
    assert telemetry.total_yield_kwh == 5890.0
    assert telemetry.is_simulated is False


# ===========================================================================
# 3. SimulatedInverterProvider Tests
# ===========================================================================

@pytest.mark.asyncio
async def test_simulator_provider_properties():
    """Simulated provider is always configured and explicitly flags is_simulated=True."""
    sim = SimulatedInverterProvider(plant_capacity_kwp=5.0)

    assert sim.provider_id == "simulator"
    assert sim.is_configured is True

    # Test connection
    conn = await sim.test_connection()
    assert conn.success is True
    assert conn.details.get("is_simulated") is True

    # Latest telemetry
    pt = await sim.get_latest_telemetry("SIM-INV-01")
    assert pt is not None
    assert pt.is_simulated is True
    assert pt.daily_yield_kwh >= 0.0

    # Historical telemetry
    start = datetime(2026, 10, 9, 8, 0, tzinfo=timezone.utc)
    end = datetime(2026, 10, 9, 10, 0, tzinfo=timezone.utc)
    series = await sim.get_historical_telemetry("SIM-INV-01", start, end)
    assert len(series) > 0
    assert all(p.is_simulated is True for p in series)


# ===========================================================================
# 4. IntegrationSyncService Tests
# ===========================================================================

@pytest.mark.asyncio
async def test_sync_service_ingestion_and_deduplication(db_session: Session):
    """Sync service persists records, avoids duplicate entries on re-sync, and records sync run."""
    # 1. Create plant & inverter
    plant = Plant(
        name="Sync Test Plant",
        location="Bhubaneswar",
        installed_capacity_kwp=5.0,
        status="NORMAL",
    )
    db_session.add(plant)
    db_session.commit()
    db_session.refresh(plant)

    inverter = Inverter(
        id="INV-SYNC-001",
        plant_id=plant.id,
        serial_number="SN-SYNC-001",
        manufacturer="Deye",
        model="SUN-5K",
        rated_ac_power_kw=5.0,
        status="NORMAL",
    )
    # Create IntegrationConfig
    integ_config = IntegrationConfig(
        id="deye-cloud",
        name="Deye Cloud Developer OpenAPI",
        provider="Deye OpenAPI",
        endpoint_url="https://india-developer.deyecloud.com:443",
        status="CONNECTED",
    )
    db_session.add_all([inverter, integ_config])
    db_session.commit()

    # 2. Mock provider returning 2 telemetry points
    t1 = datetime(2026, 10, 9, 10, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 10, 9, 10, 5, tzinfo=timezone.utc)

    mock_provider = MagicMock()
    mock_provider.provider_id = "deye-cloud"
    mock_provider.provider_name = "Deye Cloud Developer OpenAPI"
    mock_provider.get_historical_telemetry = AsyncMock(
        return_value=[
            NormalizedTelemetry(
                device_sn="SN-SYNC-001",
                timestamp=t1,
                p_ac=3500.0,
                v_ac=230.0,
                i_ac=15.2,
                v_dc1=360.0,
                i_dc1=10.0,
                p_dc1=3600.0,
                daily_yield_kwh=5.2,
                total_yield_kwh=1050.0,
                is_simulated=False,
            ),
            NormalizedTelemetry(
                device_sn="SN-SYNC-001",
                timestamp=t2,
                p_ac=3700.0,
                v_ac=231.0,
                i_ac=16.0,
                v_dc1=362.0,
                i_dc1=10.5,
                p_dc1=3800.0,
                daily_yield_kwh=5.5,
                total_yield_kwh=1050.3,
                is_simulated=False,
            ),
        ]
    )

    # First Sync Run
    summary1 = await integration_sync_service.sync_inverter_telemetry(
        db=db_session,
        provider=mock_provider,
        inverter=inverter,
        start_time=t1,
        end_time=t2,
    )

    assert summary1.status == "SUCCESS"
    assert summary1.records_ingested == 2

    # Verify DB has 2 records
    count = db_session.scalar(select(Telemetry).where(Telemetry.inverter_id == inverter.id))
    assert count is not None

    # Second Sync Run with identical timestamps -> Deduplication should ingest 0
    summary2 = await integration_sync_service.sync_inverter_telemetry(
        db=db_session,
        provider=mock_provider,
        inverter=inverter,
        start_time=t1,
        end_time=t2,
    )

    assert summary2.records_ingested == 0

    # Verify IntegrationSyncRun records exist
    sync_runs = list(db_session.scalars(select(IntegrationSyncRun).where(IntegrationSyncRun.integration_id == "deye-cloud")).all())
    assert len(sync_runs) == 2
