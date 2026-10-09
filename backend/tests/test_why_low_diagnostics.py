"""Unit & Integration Tests for SolarMind Expected Generation Engine & Why-Low Diagnostic Workflow."""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import engine
from app.main import app
from app.models.alert import Alert
from app.models.inverter import Inverter
from app.models.outage_event import OutageEvent
from app.models.plant import Plant
from app.models.pv_asset import PVAsset
from app.models.telemetry import Telemetry
from app.models.user import User
from app.models.weather_record import WeatherRecord
from app.schemas.why_low import WhyLowDiagnosticRequest
from app.services.auth_service import auth_service
from app.services.expected_generation_service import expected_generation_service
from app.services.why_low_service import why_low_service


@pytest.fixture(autouse=True)
def setup_database():
    """Ensure clean schema for tests."""
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
def test_plant_and_inverter(db_session: Session):
    """Create test plant and inverter."""
    plant = Plant(
        id=1,
        name="Solar Test Plant Alpha",
        location="Bhubaneswar, Odisha",
        timezone="Asia/Kolkata",
        latitude=20.2961,
        longitude=85.8245,
        system_type="Rooftop Grid-Tied",
        installed_capacity_kwp=10.0,
        tariff_rate_inr=7.50,
        status="NORMAL",
        is_active=True,
    )
    inverter = Inverter(
        id="INV-TEST-01",
        plant_id=1,
        serial_number="SN-TEST-INV01",
        manufacturer="Deye",
        model="SUN-10K-G05",
        rated_ac_power_kw=10.0,
        mppt_count=2,
        strings_count=2,
        status="NORMAL",
    )
    db_session.add(plant)
    db_session.add(inverter)
    db_session.commit()
    return plant, inverter


# =============================================================================
# 1. EXPECTED GENERATION ENGINE UNIT TESTS
# =============================================================================

def test_solar_position_solar_noon_vs_midnight():
    """Test solar position elevation calculations for solar noon vs midnight."""
    # Solar Noon near Bhubaneswar (approx 06:30 UTC / 12:00 IST) on equinox
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)
    noon_pos = expected_generation_service.calculate_solar_position(
        timestamp=noon_time,
        latitude=20.2961,
        longitude=85.8245,
    )
    assert noon_pos.is_daylight is True
    assert noon_pos.solar_elevation_deg > 60.0  # High sun elevation
    assert noon_pos.clear_sky_irradiance_wm2 > 800.0

    # Midnight (18:30 UTC / 00:00 IST)
    midnight_time = datetime(2026, 3, 21, 18, 30, 0, tzinfo=timezone.utc)
    midnight_pos = expected_generation_service.calculate_solar_position(
        timestamp=midnight_time,
        latitude=20.2961,
        longitude=85.8245,
    )
    assert midnight_pos.is_daylight is False
    assert midnight_pos.solar_elevation_deg < 0.0
    assert midnight_pos.clear_sky_irradiance_wm2 == 0.0


def test_temperature_derating_factors():
    """Test temperature coefficient derating at 25C, 50C, and cold temperatures."""
    # STC 25°C -> Derate factor exactly 1.0
    assert expected_generation_service.calculate_temperature_derating(25.0) == 1.0

    # Hot cell 50°C -> Derating f = 1 + (-0.0038 * 25) = 0.905
    hot_derate = expected_generation_service.calculate_temperature_derating(50.0)
    assert round(hot_derate, 3) == 0.905

    # Cold cell 10°C -> Power enhancement f = 1 + (-0.0038 * -15) = 1.057
    cold_derate = expected_generation_service.calculate_temperature_derating(10.0)
    assert round(cold_derate, 3) == 1.057

    # Missing temperature -> Nominal 1.0
    assert expected_generation_service.calculate_temperature_derating(None) == 1.0


def test_estimate_expected_power_methods():
    """Test baseline model selection under different sensor configurations."""
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    # 1. Direct POA Irradiance & Temperature
    calc1 = expected_generation_service.estimate_expected_power(
        installed_capacity_kwp=10.0,
        timestamp=noon_time,
        latitude=20.2961,
        longitude=85.8245,
        poa_irradiance_wm2=1000.0,
        temperature_c=25.0,
    )
    assert calc1.baseline_method == "PHYSICAL_IRRADIANCE_AND_TEMPERATURE"
    assert calc1.expected_power_kw > 9.0  # Approx 10 * 1.0 * 1.0 * 0.97 * 0.98 = 9.506 kW

    # 2. Weather Station Irradiance + Cloud Cover
    calc2 = expected_generation_service.estimate_expected_power(
        installed_capacity_kwp=10.0,
        timestamp=noon_time,
        latitude=20.2961,
        longitude=85.8245,
        cloud_cover_pct=80.0,
    )
    assert calc2.baseline_method == "WEATHER_STATION_IRRADIANCE"
    assert calc2.expected_power_kw < calc1.expected_power_kw

    # 3. Night Time Baseline
    midnight_time = datetime(2026, 3, 21, 18, 30, 0, tzinfo=timezone.utc)
    calc3 = expected_generation_service.estimate_expected_power(
        installed_capacity_kwp=10.0,
        timestamp=midnight_time,
        latitude=20.2961,
        longitude=85.8245,
    )
    assert calc3.baseline_method == "NIGHT_ZERO_SOLAR_BASELINE"
    assert calc3.expected_power_kw == 0.0


# =============================================================================
# 2. WHY-LOW DIAGNOSTIC PIPELINE STEP-BY-STEP TESTS
# =============================================================================

def test_why_low_step1_missing_telemetry(db_session: Session, test_plant_and_inverter):
    """Step 1: Returns DATA_QUALITY_OR_STALENESS when no telemetry records exist."""
    plant, _ = test_plant_and_inverter
    req = WhyLowDiagnosticRequest(plant_id=plant.id)
    res = why_low_service.diagnose_why_low(db_session, req)

    assert res.evaluation_step_reached == 1
    assert res.candidate_cause == "DATA_QUALITY_OR_STALENESS"
    assert res.is_fault is False
    assert res.data_coverage == 0.0
    assert "No telemetry records found" in res.supporting_evidence[0]


def test_why_low_step1_stale_telemetry_daylight(db_session: Session, test_plant_and_inverter):
    """Step 1: Returns DATA_QUALITY_OR_STALENESS when latest telemetry is >2 hours stale during daylight."""
    plant, inverter = test_plant_and_inverter
    now_daylight = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    # Telemetry is 3 hours old
    old_time = now_daylight - timedelta(hours=3)
    t = Telemetry(
        inverter_id=inverter.id,
        timestamp=old_time,
        p_ac=5.0,
        v_dc=350.0,
        i_dc=14.2,
        data_quality_flag="VALID",
    )
    db_session.add(t)
    db_session.commit()

    req = WhyLowDiagnosticRequest(plant_id=plant.id, timestamp=now_daylight)
    res = why_low_service.diagnose_why_low(db_session, req)

    assert res.evaluation_step_reached == 1
    assert res.candidate_cause == "DATA_QUALITY_OR_STALENESS"
    assert "Latest telemetry reading is" in res.supporting_evidence[0]


def test_why_low_step1_suspicious_quality_flag(db_session: Session, test_plant_and_inverter):
    """Step 1: Returns DATA_QUALITY_OR_STALENESS when sensor flags SUSPICIOUS or negative values."""
    plant, inverter = test_plant_and_inverter
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    t = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time,
        p_ac=-2.5,  # Invalid negative power
        v_dc=350.0,
        i_dc=10.0,
        data_quality_flag="SUSPICIOUS",
    )
    db_session.add(t)
    db_session.commit()

    req = WhyLowDiagnosticRequest(plant_id=plant.id, timestamp=noon_time)
    res = why_low_service.diagnose_why_low(db_session, req)

    assert res.evaluation_step_reached == 1
    assert res.candidate_cause == "DATA_QUALITY_OR_STALENESS"
    assert res.is_fault is False


def test_why_low_step2_night_time_solar_absence(db_session: Session, test_plant_and_inverter):
    """Step 2: Returns NIGHT_TIME_OR_LOW_SUN with is_fault=False when solar elevation is <5°."""
    plant, inverter = test_plant_and_inverter
    midnight_time = datetime(2026, 3, 21, 18, 30, 0, tzinfo=timezone.utc)

    t = Telemetry(
        inverter_id=inverter.id,
        timestamp=midnight_time,
        p_ac=0.0,
        v_dc=0.0,
        i_dc=0.0,
        v_ac=230.0,
        poa_irradiance_wm2=0.0,
        data_quality_flag="VALID",
    )
    db_session.add(t)
    db_session.commit()

    req = WhyLowDiagnosticRequest(plant_id=plant.id, timestamp=midnight_time)
    res = why_low_service.diagnose_why_low(db_session, req)

    assert res.evaluation_step_reached == 2
    assert res.candidate_cause == "NIGHT_TIME_OR_LOW_SUN"
    assert res.is_fault is False
    assert res.severity == "NORMAL"
    assert res.yield_gap_kw == 0.0
    assert res.yield_gap_pct == 0.0
    assert "below daylight threshold" in res.supporting_evidence[0]


def test_why_low_step3_weather_cloud_reduction(db_session: Session, test_plant_and_inverter):
    """Step 3: Returns WEATHER_RELATED_REDUCTION when POA irradiance is low and power is proportional."""
    plant, inverter = test_plant_and_inverter
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    # Low irradiance (150 W/m²) due to rain/overcast, generation matches (1.2 kW on 10 kWp system)
    t = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time,
        p_ac=1.2,
        v_dc=310.0,
        i_dc=3.9,
        v_ac=230.0,
        poa_irradiance_wm2=150.0,
        temperature_c=28.0,
        data_quality_flag="VALID",
    )
    db_session.add(t)
    db_session.commit()

    req = WhyLowDiagnosticRequest(plant_id=plant.id, timestamp=noon_time)
    res = why_low_service.diagnose_why_low(db_session, req)

    assert res.evaluation_step_reached == 3
    assert res.candidate_cause == "WEATHER_RELATED_REDUCTION"
    assert res.is_fault is False
    assert res.severity == "LOW"
    assert "Measured plane-of-array irradiance is low" in res.supporting_evidence[0]


def test_why_low_step4_grid_outage_disconnection(db_session: Session, test_plant_and_inverter):
    """Step 4: Returns GRID_OUTAGE_OR_DISCONNECTION when AC voltage collapses while DC is energized."""
    plant, inverter = test_plant_and_inverter
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    # AC voltage is 0.0V while DC voltage is 380V and POA is 800 W/m²
    t = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time,
        p_ac=0.0,
        v_dc=380.0,
        i_dc=0.0,
        v_ac=0.0,  # Grid loss
        frequency_hz=0.0,
        poa_irradiance_wm2=800.0,
        data_quality_flag="VALID",
    )
    db_session.add(t)
    db_session.commit()

    req = WhyLowDiagnosticRequest(plant_id=plant.id, timestamp=noon_time)
    res = why_low_service.diagnose_why_low(db_session, req)

    assert res.evaluation_step_reached == 4
    assert res.candidate_cause == "GRID_OUTAGE_OR_DISCONNECTION"
    assert res.severity == "CRITICAL"
    assert res.is_fault is True
    assert res.yield_gap_kw > 5.0
    assert "AC grid voltage collapsed to 0.0 V" in res.supporting_evidence[0]


def test_why_low_step5_inverter_hardware_alert(db_session: Session, test_plant_and_inverter):
    """Step 5: Returns INVERTER_HARDWARE_ALERT when an active protection alert is logged."""
    plant, inverter = test_plant_and_inverter
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    t = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time,
        p_ac=0.0,
        v_dc=360.0,
        i_dc=0.0,
        v_ac=230.0,
        poa_irradiance_wm2=850.0,
        data_quality_flag="VALID",
    )
    alert = Alert(
        id="ALT-TEST-01",
        plant_id=plant.id,
        inverter_id=inverter.id,
        code="GROUND_FAULT",
        source="INVERTER_EVENT",
        message="PV DC insulation resistance dropped below 50 kOhm threshold.",
        severity="CRITICAL",
        status="ACTIVE",
        event_timestamp=noon_time - timedelta(minutes=5),
        acknowledged=False,
    )
    db_session.add(t)
    db_session.add(alert)
    db_session.commit()

    req = WhyLowDiagnosticRequest(plant_id=plant.id, timestamp=noon_time)
    res = why_low_service.diagnose_why_low(db_session, req)

    assert res.evaluation_step_reached == 5
    assert res.candidate_cause == "INVERTER_HARDWARE_ALERT"
    assert res.is_fault is True
    assert "GROUND_FAULT" in res.supporting_evidence[0]


def test_why_low_step6_thermal_derating(db_session: Session, test_plant_and_inverter):
    """Step 6: Returns THERMAL_DERATING_OR_CLIPPING when inverter temperature >= 72°C."""
    plant, inverter = test_plant_and_inverter
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    # Inverter temp is 76°C, power is throttled to 5.0 kW vs expected ~8.0 kW
    t = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time,
        p_ac=5.0,
        v_dc=340.0,
        i_dc=15.0,
        v_ac=230.0,
        poa_irradiance_wm2=850.0,
        temperature_c=76.0,  # Overheating
        data_quality_flag="VALID",
    )
    db_session.add(t)
    db_session.commit()

    req = WhyLowDiagnosticRequest(plant_id=plant.id, timestamp=noon_time)
    res = why_low_service.diagnose_why_low(db_session, req)

    assert res.evaluation_step_reached == 6
    assert res.candidate_cause == "THERMAL_DERATING_OR_CLIPPING"
    assert res.severity == "HIGH"
    assert res.is_fault is True
    assert "76.0°C" in res.supporting_evidence[0]


def test_why_low_step7_mppt_string_imbalance(db_session: Session, test_plant_and_inverter):
    """Step 7: Returns MPPT_OR_STRING_DISCONNECTION when parallel strings exhibit severe current mismatch."""
    plant, inverter = test_plant_and_inverter
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    # Create PV assets for the strings
    pv1 = PVAsset(
        id="PVA-STR-01",
        inverter_id=inverter.id,
        asset_type="STRING",
        identifier="String 1",
        capacity_kwp=5.0,
    )
    pv2 = PVAsset(
        id="PVA-STR-02",
        inverter_id=inverter.id,
        asset_type="STRING",
        identifier="String 2",
        capacity_kwp=5.0,
    )
    db_session.add_all([pv1, pv2])
    db_session.commit()

    # Main inverter telemetry
    t_main = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time,
        p_ac=3.5,
        v_dc=360.0,
        i_dc=9.8,
        v_ac=230.0,
        poa_irradiance_wm2=800.0,
        temperature_c=45.0,
        data_quality_flag="VALID",
    )
    # String 1: Healthy current
    t_str1 = Telemetry(
        inverter_id=inverter.id,
        pv_asset_id="PVA-STR-01",
        timestamp=noon_time,
        v_dc=360.0,
        i_dc=9.6,
        p_ac=3.4,
        data_quality_flag="VALID",
    )
    # String 2: Disconnected (0.05 A with 360 V open circuit)
    t_str2 = Telemetry(
        inverter_id=inverter.id,
        pv_asset_id="PVA-STR-02",
        timestamp=noon_time,
        v_dc=360.0,
        i_dc=0.05,
        p_ac=0.0,
        data_quality_flag="VALID",
    )
    db_session.add_all([t_main, t_str1, t_str2])
    db_session.commit()

    req = WhyLowDiagnosticRequest(plant_id=plant.id, timestamp=noon_time)
    res = why_low_service.diagnose_why_low(db_session, req)

    assert res.evaluation_step_reached == 7
    assert res.candidate_cause == "MPPT_OR_STRING_DISCONNECTION"
    assert res.is_fault is True
    assert "PVA-STR-02" in res.supporting_evidence[1]


def test_why_low_step9_historical_benchmark_divergence(db_session: Session, test_plant_and_inverter):
    """Step 9: Returns HISTORICAL_PERFORMANCE_DIVERGENCE when yield is >30% below calibrated historical benchmark."""
    plant, inverter = test_plant_and_inverter
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    # Add 6 historical healthy telemetry samples around solar noon
    historical_samples = []
    for days_ago in range(1, 7):
        hist_ts = noon_time - timedelta(days=days_ago)
        historical_samples.append(
            Telemetry(
                inverter_id=inverter.id,
                timestamp=hist_ts,
                p_ac=8.5,  # Consistently healthy 8.5 kW
                v_dc=380.0,
                i_dc=23.0,
                v_ac=230.0,
                poa_irradiance_wm2=None,
                data_quality_flag="VALID",
            )
        )
    db_session.add_all(historical_samples)
    db_session.commit()

    # Current telemetry shows only 4.0 kW (more than 30% below 8.5 kW benchmark)
    t_current = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time,
        p_ac=4.0,
        v_dc=370.0,
        i_dc=11.0,
        v_ac=230.0,
        poa_irradiance_wm2=None,
        data_quality_flag="VALID",
    )
    db_session.add(t_current)
    db_session.commit()

    req = WhyLowDiagnosticRequest(plant_id=plant.id, timestamp=noon_time, lookback_hours=168)
    res = why_low_service.diagnose_why_low(db_session, req)

    assert res.evaluation_step_reached == 9
    assert res.candidate_cause == "HISTORICAL_PERFORMANCE_DIVERGENCE"
    assert res.baseline_method == "HISTORICAL_CALIBRATED_BENCHMARK"
    assert res.is_fault is True



def test_why_low_step8_shading_vs_soiling(db_session: Session, test_plant_and_inverter):
    """Step 8: Distinguishes between PARTIAL_SHADING (depressed voltage) and SURFACE_SOILING (normal voltage)."""
    plant, inverter = test_plant_and_inverter
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    # 1. Partial Shading: Depressed DC voltage (180 V)
    t_shade = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time,
        p_ac=4.5,
        v_dc=180.0,  # Depressed voltage from bypass diodes
        i_dc=25.0,
        v_ac=230.0,
        poa_irradiance_wm2=800.0,
        temperature_c=42.0,
        data_quality_flag="VALID",
    )
    db_session.add(t_shade)
    db_session.commit()

    req = WhyLowDiagnosticRequest(plant_id=plant.id, timestamp=noon_time)
    res_shade = why_low_service.diagnose_why_low(db_session, req)
    assert res_shade.evaluation_step_reached == 8
    assert res_shade.candidate_cause == "PARTIAL_SHADING"

    # 2. Surface Soiling: Normal DC voltage (360 V) with uniform current deficit
    t_soil = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time + timedelta(minutes=5),
        p_ac=5.0,
        v_dc=360.0,  # Normal voltage
        i_dc=14.0,
        v_ac=230.0,
        poa_irradiance_wm2=800.0,
        temperature_c=42.0,
        data_quality_flag="VALID",
    )
    db_session.add(t_soil)
    db_session.commit()

    req2 = WhyLowDiagnosticRequest(plant_id=plant.id, timestamp=noon_time + timedelta(minutes=5))
    res_soil = why_low_service.diagnose_why_low(db_session, req2)
    assert res_soil.evaluation_step_reached == 8
    assert res_soil.candidate_cause == "SURFACE_SOILING"


def test_why_low_step10_normal_operation(db_session: Session, test_plant_and_inverter):
    """Step 10: Returns NORMAL_OPERATION when generation matches expected power within 15%."""
    plant, inverter = test_plant_and_inverter
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    # 9.0 kW on a 10 kWp plant at 950 W/m² (expected is ~8.8-9.0 kW)
    t = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time,
        p_ac=9.0,
        v_dc=370.0,
        i_dc=24.5,
        v_ac=230.0,
        poa_irradiance_wm2=950.0,
        temperature_c=40.0,
        data_quality_flag="VALID",
    )
    db_session.add(t)
    db_session.commit()

    req = WhyLowDiagnosticRequest(plant_id=plant.id, timestamp=noon_time)
    res = why_low_service.diagnose_why_low(db_session, req)

    assert res.evaluation_step_reached == 10
    assert res.candidate_cause == "NORMAL_OPERATION"
    assert res.severity == "NORMAL"
    assert res.is_fault is False
    assert res.yield_gap_pct < 15.0


def test_why_low_step10_insufficient_evidence_conflicting_signals(db_session: Session, test_plant_and_inverter):
    """Step 10: Returns INSUFFICIENT_EVIDENCE_OR_UNKNOWN when yield gap exists but environmental sensors are missing."""
    plant, inverter = test_plant_and_inverter
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    # Power is 3.0 kW (expected clear sky is ~6.5 kW), but NO irradiance sensor, NO temp sensor, NO alerts
    t = Telemetry(
        inverter_id=inverter.id,
        timestamp=noon_time,
        p_ac=3.0,
        v_dc=340.0,
        i_dc=8.8,
        v_ac=230.0,
        poa_irradiance_wm2=None,  # Missing pyranometer
        temperature_c=None,  # Missing temperature sensor
        ambient_temp_c=None,
        data_quality_flag="VALID",
    )
    db_session.add(t)
    db_session.commit()

    req = WhyLowDiagnosticRequest(plant_id=plant.id, timestamp=noon_time)
    res = why_low_service.diagnose_why_low(db_session, req)

    assert res.evaluation_step_reached == 10
    assert res.candidate_cause == "INSUFFICIENT_EVIDENCE_OR_UNKNOWN"
    assert res.is_fault is False
    assert res.confidence_score <= 0.50
    assert len(res.contradictory_evidence) > 0
    assert "Plane-of-array (POA) solar irradiance sensor is unavailable" in res.contradictory_evidence[0]


# =============================================================================
# 3. REST API ENDPOINT INTEGRATION TESTS
# =============================================================================

def test_api_post_why_low_endpoint(client: TestClient, db_session: Session, test_plant_and_inverter):
    """Test POST /api/v1/diagnoses/why-low endpoint integration."""
    plant, inverter = test_plant_and_inverter
    midnight_time = datetime(2026, 3, 21, 18, 30, 0, tzinfo=timezone.utc)

    t = Telemetry(
        inverter_id=inverter.id,
        timestamp=midnight_time,
        p_ac=0.0,
        v_dc=0.0,
        i_dc=0.0,
        v_ac=230.0,
        poa_irradiance_wm2=0.0,
        data_quality_flag="VALID",
    )
    db_session.add(t)
    db_session.commit()

    payload = {
        "plant_id": plant.id,
        "inverter_id": inverter.id,
        "timestamp": midnight_time.isoformat(),
        "lookback_hours": 24,
    }
    response = client.post("/api/v1/diagnoses/why-low", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["plant_id"] == plant.id
    assert data["inverter_id"] == inverter.id
    assert data["candidate_cause"] == "NIGHT_TIME_OR_LOW_SUN"
    assert data["is_fault"] is False
    assert data["observed_power_kw"] == 0.0
    assert data["expected_power_kw"] == 0.0
    assert data["confidence_score"] == 0.99
    assert data["evaluation_step_reached"] == 2
