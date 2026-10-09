"""Unit & Integration Tests for Weather Intelligence and Grid Interruption Detection."""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import engine
from app.main import app
from app.models.inverter import Inverter
from app.models.outage_event import OutageEvent
from app.models.plant import Plant
from app.models.telemetry import Telemetry
from app.models.weather_record import WeatherRecord
from app.schemas.outage import (
    OutageDetectionRequest,
    OutageEventCreate,
    OutageEventUpdate,
)
from app.schemas.weather import WeatherRecordCreate
from app.services.outage_service import outage_service
from app.services.weather_service import weather_service
from app.weather.base import WeatherObservation
from app.weather.simulated import SimulatedWeatherProvider


@pytest.fixture(autouse=True)
def setup_database():
    """Ensure clean database for each test run."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    with Session(engine) as session:
        yield session


@pytest.fixture
def test_plant(db_session: Session):
    """Create test plant and inverter."""
    plant = Plant(
        id=1,
        name="Grid Test Solar Plant",
        location="Bhubaneswar, Odisha",
        timezone="Asia/Kolkata",
        latitude=20.2961,
        longitude=85.8245,
        installed_capacity_kwp=10.0,
        tariff_rate_inr=7.50,
        status="NORMAL",
        is_active=True,
    )
    inverter = Inverter(
        id="INV-TEST-01",
        plant_id=1,
        serial_number="SN-TEST-INV-01",
        manufacturer="Deye",
        model="SUN-10K-G05",
        rated_ac_power_kw=10.0,
        status="NORMAL",
    )
    db_session.add(plant)
    db_session.add(inverter)
    db_session.commit()
    return plant, inverter


# =============================================================================
# 1. WEATHER SERVICE & PROVIDER UNIT TESTS
# =============================================================================

def test_weather_observation_vs_forecast_distinction():
    """Verify that observations have is_forecast=False and forecasts have is_forecast=True."""
    provider = SimulatedWeatherProvider(default_cloud_cover_pct=25.0, default_ambient_temp_c=32.0)

    # 1. Current Observation
    obs = provider.get_current_observation(latitude=20.2961, longitude=85.8245)
    assert obs.is_forecast is False
    assert obs.temperature_c == 32.0
    assert obs.cloud_cover_pct == 25.0
    assert obs.observation_time is not None

    # 2. Hourly Forecast
    fc = provider.get_forecast(latitude=20.2961, longitude=85.8245, hours=24)
    assert fc.is_forecast is True
    assert len(fc.hourly) == 24
    for h in fc.hourly:
        assert h.is_forecast is True
        assert h.forecast_time is not None


def test_weather_service_caching_and_freshness(db_session: Session, test_plant):
    """Verify in-memory caching with TTL and data freshness seconds."""
    plant, _ = test_plant

    # First call -> creates fresh observation
    obs1 = weather_service.get_current_weather(db_session, plant_id=plant.id)
    assert obs1.is_forecast is False
    assert obs1.data_freshness_seconds == 0.0

    # Second call -> returned from cache
    obs2 = weather_service.get_current_weather(db_session, plant_id=plant.id)
    assert "CACHED" in obs2.source or "DB_" in obs2.source
    assert obs2.is_forecast is False

    # Forecast caching
    fc1 = weather_service.get_weather_forecast(db_session, plant_id=plant.id, hours=24)
    assert fc1.is_forecast is True
    assert len(fc1.hourly) == 24

    fc2 = weather_service.get_weather_forecast(db_session, plant_id=plant.id, hours=24)
    assert "CACHED" in fc2.source
    assert fc2.is_forecast is True


def test_weather_service_circuit_breaker_and_fallback(db_session: Session, test_plant):
    """Verify that when primary provider fails 3 times, fallback is utilized without crashing."""
    plant, _ = test_plant

    class FailingProvider:
        def get_current_observation(self, latitude, longitude):
            raise ConnectionError("Upstream meteorological service unavailable")

        def get_forecast(self, latitude, longitude, hours=48):
            raise ConnectionError("Upstream meteorological service unavailable")

        def is_available(self):
            return False

    failing_svc = weather_service.__class__(primary_provider=FailingProvider())

    # Should fall back to SimulatedWeatherProvider cleanly
    obs = failing_svc.get_current_weather(db_session, plant_id=plant.id)
    assert obs.source == "SIMULATED"
    assert obs.is_forecast is False
    assert obs.temperature_c is not None


def test_cloud_vs_abnormal_performance_attribution(db_session: Session, test_plant):
    """Verify cloud attribution distinguishing weather reduction from actual defects."""
    plant, _ = test_plant
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    # Store overcast weather record (80% cloud cover)
    wr = WeatherRecord(
        plant_id=plant.id,
        timestamp=noon_time.replace(tzinfo=None),
        cloud_cover_pct=80.0,
        poa_irradiance_wm2=200.0,
        ghi_irradiance_wm2=200.0,
        ambient_temperature_c=28.0,
        data_source="WEATHER_STATION",
    )
    db_session.add(wr)
    db_session.commit()

    # Case A: 1.5 kW output under 80% cloud cover is weather-explained
    res_a = weather_service.analyze_cloud_vs_abnormal(
        db_session,
        plant_id=plant.id,
        observed_power_kw=1.5,
        timestamp=noon_time,
    )
    assert res_a.is_weather_explained is True
    assert res_a.cloud_cover_pct == 80.0

    # Case B: 0.1 kW output under 80% cloud cover is NOT weather-explained (too low even for clouds)
    res_b = weather_service.analyze_cloud_vs_abnormal(
        db_session,
        plant_id=plant.id,
        observed_power_kw=0.1,
        timestamp=noon_time,
    )
    assert res_b.is_weather_explained is False


# =============================================================================
# 2. GRID INTERRUPTION & OUTAGE DETECTION TESTS
# =============================================================================

def test_outage_detection_confirmed_grid_collapse(db_session: Session, test_plant):
    """Verify detection of confirmed grid collapse (Vac < 15V with DC voltage energized)."""
    plant, inverter = test_plant
    noon_time = datetime(2026, 3, 21, 6, 0, 0, tzinfo=timezone.utc)

    # Telemetry stream: Normal -> Grid Collapse for 45 mins -> Restored
    t1 = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time,
        p_ac=8.0,
        v_dc=370.0,
        i_dc=22.0,
        v_ac=230.0,
        frequency_hz=50.0,
        data_quality_flag="VALID",
    )
    t2 = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time + timedelta(minutes=15),
        p_ac=0.0,
        v_dc=380.0,
        i_dc=0.0,
        v_ac=0.0,  # Grid loss
        frequency_hz=0.0,
        data_quality_flag="VALID",
    )
    t3 = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time + timedelta(minutes=30),
        p_ac=0.0,
        v_dc=380.0,
        i_dc=0.0,
        v_ac=0.0,  # Grid loss
        frequency_hz=0.0,
        data_quality_flag="VALID",
    )
    t4 = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time + timedelta(minutes=60),
        p_ac=8.2,
        v_dc=370.0,
        i_dc=22.5,
        v_ac=230.0,
        frequency_hz=50.0,
        data_quality_flag="VALID",
    )
    db_session.add_all([t1, t2, t3, t4])
    db_session.commit()

    req = OutageDetectionRequest(
        plant_id=plant.id,
        start_time=noon_time - timedelta(minutes=10),
        end_time=noon_time + timedelta(minutes=70),
        auto_persist=True,
    )
    resp = outage_service.detect_grid_outages(db_session, req)

    assert resp.outages_detected == 1
    event = resp.events[0]
    assert event.event_type == "GRID_OUTAGE"
    assert event.status == "CONFIRMED"
    assert event.duration_minutes >= 30.0
    assert event.resolved is True
    assert event.estimated_lost_energy_kwh is not None and event.estimated_lost_energy_kwh > 0.0
    assert event.estimated_financial_loss_inr is not None and event.estimated_financial_loss_inr > 0.0


def test_outage_detection_daylight_telemetry_gap(db_session: Session, test_plant):
    """Verify suspected outage detection on daylight comms gap with careful language."""
    plant, inverter = test_plant
    morning_time = datetime(2026, 3, 21, 4, 0, 0, tzinfo=timezone.utc)  # 09:30 IST daylight

    # Normal reading at 09:30 IST, then 90-minute gap during bright sunshine, then recovery at 11:00 IST
    t_before = Telemetry(
        inverter_id=inverter.id,
        timestamp=morning_time,
        p_ac=6.5,
        v_dc=360.0,
        i_dc=18.0,
        v_ac=230.0,
        data_quality_flag="VALID",
    )
    t_after = Telemetry(
        inverter_id=inverter.id,
        timestamp=morning_time + timedelta(minutes=90),
        p_ac=7.8,
        v_dc=365.0,
        i_dc=21.5,
        v_ac=230.0,
        data_quality_flag="VALID",
    )
    db_session.add_all([t_before, t_after])
    db_session.commit()

    req = OutageDetectionRequest(
        plant_id=plant.id,
        start_time=morning_time - timedelta(minutes=15),
        end_time=morning_time + timedelta(minutes=120),
        auto_persist=True,
    )
    resp = outage_service.detect_grid_outages(db_session, req)

    assert resp.outages_detected == 1
    event = resp.events[0]
    assert event.event_type == "TELEMETRY_GAP_SUSPECTED"
    assert event.status == "SUSPECTED"
    assert event.duration_minutes == 90.0
    # Verify non-accusatory careful language
    assert any("AC supply interruption suspected" in lim for lim in event.detection_limitations)
    assert any("cannot be confirmed remotely" in lim for lim in event.detection_limitations)


def test_outage_detection_ongoing_incomplete_interval(db_session: Session, test_plant):
    """Verify that an active outage with no restoration sample has end_time=None and resolved=False."""
    plant, inverter = test_plant
    noon_time = datetime(2026, 3, 21, 6, 0, 0, tzinfo=timezone.utc)

    # Initial normal reading, then outage that remains active at the end of the evaluation window
    t1 = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time,
        p_ac=7.0,
        v_dc=360.0,
        i_dc=19.5,
        v_ac=230.0,
        data_quality_flag="VALID",
    )
    t2 = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time + timedelta(minutes=20),
        p_ac=0.0,
        v_dc=370.0,
        i_dc=0.0,
        v_ac=0.0,  # Ongoing outage
        data_quality_flag="VALID",
    )
    db_session.add_all([t1, t2])
    db_session.commit()

    req = OutageDetectionRequest(
        plant_id=plant.id,
        start_time=noon_time - timedelta(minutes=10),
        end_time=noon_time + timedelta(minutes=30),
        auto_persist=True,
    )
    resp = outage_service.detect_grid_outages(db_session, req)

    assert resp.outages_detected == 1
    event = resp.events[0]
    assert event.end_time is None
    assert event.resolved is False
    assert event.status == "CONFIRMED"


# =============================================================================
# 3. REST API ENDPOINTS INTEGRATION TESTS
# =============================================================================

def test_api_weather_endpoints(client: TestClient, db_session: Session, test_plant):
    """Test /api/v1/weather endpoints."""
    plant, _ = test_plant

    # GET /weather/plants/{plant_id}/current
    res_curr = client.get(f"/api/v1/weather/plants/{plant.id}/current")
    assert res_curr.status_code == 200
    curr_data = res_curr.json()
    assert curr_data["is_forecast"] is False
    assert curr_data["temperature_c"] is not None

    # GET /weather/plants/{plant_id}/forecast
    res_fc = client.get(f"/api/v1/weather/plants/{plant.id}/forecast?hours=24")
    assert res_fc.status_code == 200
    fc_data = res_fc.json()
    assert fc_data["is_forecast"] is True
    assert len(fc_data["hourly"]) == 24
    for h in fc_data["hourly"]:
        assert h["is_forecast"] is True

    # POST /weather/records
    record_payload = {
        "plant_id": plant.id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "poa_irradiance_wm2": 750.0,
        "ghi_irradiance_wm2": 720.0,
        "ambient_temperature_c": 33.0,
        "wind_speed_ms": 2.8,
        "cloud_cover_pct": 20.0,
        "data_source": "WEATHER_STATION",
    }
    res_rec = client.post("/api/v1/weather/records", json=record_payload)
    assert res_rec.status_code == 201
    assert res_rec.json()["poa_irradiance_wm2"] == 750.0


def test_api_outages_endpoints(client: TestClient, db_session: Session, test_plant):
    """Test /api/v1/outages endpoints."""
    plant, inverter = test_plant
    start_dt = datetime(2026, 3, 21, 6, 0, 0, tzinfo=timezone.utc)
    end_dt = datetime(2026, 3, 21, 7, 0, 0, tzinfo=timezone.utc)

    # POST /outages (Manual create)
    create_payload = {
        "plant_id": plant.id,
        "inverter_id": inverter.id,
        "event_type": "GRID_OUTAGE",
        "status": "CONFIRMED",
        "start_time": start_dt.isoformat(),
        "end_time": end_dt.isoformat(),
        "duration_minutes": 60.0,
        "estimated_lost_energy_kwh": 7.5,
        "estimated_financial_loss_inr": 56.25,
        "reason": "11kV feeder maintenance shutdown.",
        "resolved": True,
    }
    res_create = client.post("/api/v1/outages", json=create_payload)
    assert res_create.status_code == 201
    outage_id = res_create.json()["id"]

    # GET /outages
    res_list = client.get(f"/api/v1/outages?plant_id={plant.id}")
    assert res_list.status_code == 200
    list_data = res_list.json()
    assert list_data["total"] >= 1

    # GET /outages/{id}
    res_get = client.get(f"/api/v1/outages/{outage_id}")
    assert res_get.status_code == 200
    assert res_get.json()["event_type"] == "GRID_OUTAGE"

    # PATCH /outages/{id}
    res_patch = client.patch(
        f"/api/v1/outages/{outage_id}",
        json={"reason": "11kV feeder maintenance completed and verified."},
    )
    assert res_patch.status_code == 200
    assert "completed and verified" in res_patch.json()["reason"]
