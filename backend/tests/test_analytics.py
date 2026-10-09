"""Unit and integration tests for SolarMind Analytics calculations and API endpoints."""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.diagnosis import Diagnosis
from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.telemetry import Telemetry
from app.models.work_order import WorkOrder
from app.services.analytics_service import AnalyticsService, analytics_service


# ---------------------------------------------------------------------------
# 1. Pure Calculation Unit Tests with Known Mathematical Datasets
# ---------------------------------------------------------------------------

def test_integrate_power_trapezoidal_exact_math():
    """Verify numerical trapezoidal integration on a manually calculated 3-point dataset:
    t0 = 00:00, P = 0 kW, Irradiance = 0 W/m²
    t1 = 00:30 (dt=1800s), P = 10 kW, Irradiance = 600 W/m²
         Segment 1 Energy = ((0 + 10)/2) * (1800/3600) = 5 * 0.5 = 2.5 kWh
    t2 = 01:00 (dt=1800s), P = 20 kW, Irradiance = 1000 W/m²
         Segment 2 Energy = ((10 + 20)/2) * (1800/3600) = 15 * 0.5 = 7.5 kWh
    Total Energy = 2.5 + 7.5 = 10.0 kWh
    Peak Power = 20.0 kW
    Avg Irradiance = (0 + 600 + 1000) / 3 = 533.33 W/m²
    """
    base_time = datetime(2026, 10, 1, 10, 0, 0)
    records = [
        Telemetry(
            inverter_id="INV-001",
            timestamp=base_time,
            p_ac=0.0,
            poa_irradiance_wm2=0.0,
        ),
        Telemetry(
            inverter_id="INV-001",
            timestamp=base_time + timedelta(minutes=30),
            p_ac=10.0,
            poa_irradiance_wm2=600.0,
        ),
        Telemetry(
            inverter_id="INV-001",
            timestamp=base_time + timedelta(minutes=60),
            p_ac=20.0,
            poa_irradiance_wm2=1000.0,
        ),
    ]

    total_kwh, peak_kw, avg_irr, count = AnalyticsService.integrate_power_trapezoidal(records)

    assert total_kwh == pytest.approx(10.0, rel=1e-3)
    assert peak_kw == 20.0
    assert avg_irr == pytest.approx(533.333, rel=1e-2)
    assert count == 3


def test_integrate_power_trapezoidal_empty_or_single_sample():
    """Verify edge cases: 0 records and 1 record do not cause errors and yield 0 energy."""
    # 0 records
    kwh, peak, irr, cnt = AnalyticsService.integrate_power_trapezoidal([])
    assert kwh == 0.0
    assert peak == 0.0
    assert irr is None
    assert cnt == 0

    # 1 record (cannot integrate interval with single point)
    single = [
        Telemetry(
            inverter_id="INV-001",
            timestamp=datetime(2026, 10, 1, 12, 0, 0),
            p_ac=15.0,
            poa_irradiance_wm2=750.0,
        )
    ]
    kwh, peak, irr, cnt = AnalyticsService.integrate_power_trapezoidal(single)
    assert kwh == 0.0
    assert peak == 15.0
    assert irr == 750.0
    assert cnt == 1


def test_integrate_power_trapezoidal_gap_clamping():
    """Verify telemetry gaps exceeding 3600 seconds are clamped and not integrated."""
    base_time = datetime(2026, 10, 1, 8, 0, 0)
    records = [
        Telemetry(
            inverter_id="INV-001",
            timestamp=base_time,
            p_ac=10.0,
        ),
        Telemetry(
            inverter_id="INV-001",
            timestamp=base_time + timedelta(minutes=30),  # dt=1800s (valid) -> 10kW * 0.5h = 5.0 kWh
            p_ac=10.0,
        ),
        Telemetry(
            inverter_id="INV-001",
            timestamp=base_time + timedelta(hours=4),  # dt=3.5h (>1h max gap -> excluded)
            p_ac=10.0,
        ),
        Telemetry(
            inverter_id="INV-001",
            timestamp=base_time + timedelta(hours=4, minutes=30),  # dt=1800s (valid) -> 10kW * 0.5h = 5.0 kWh
            p_ac=10.0,
        ),
    ]

    total_kwh, peak_kw, _, cnt = AnalyticsService.integrate_power_trapezoidal(records, max_gap_seconds=3600.0)

    # Expected: only segment 1 (5.0 kWh) and segment 3 (5.0 kWh) -> total 10.0 kWh (not 40+ kWh)
    assert total_kwh == pytest.approx(10.0, rel=1e-3)
    assert peak_kw == 10.0
    assert cnt == 4


def test_calculate_performance_ratio_iec61724_standard():
    """Verify IEC 61724 PR Calculation against manual theoretical benchmark:
    Installed capacity = 10.0 kWp
    Actual energy = 7.5 kWh
    Avg irradiance = 800 W/m²
    Period = 1.0 hour
    Reference Yield Y_r = (800 * 1.0) / 1000 = 0.80 h
    Final Yield Y_f = 7.5 / 10.0 = 0.75 h
    PR = (0.75 / 0.80) * 100% = 93.75%
    """
    pr = AnalyticsService.calculate_performance_ratio(
        actual_energy_kwh=7.5,
        installed_capacity_kwp=10.0,
        avg_irradiance_wm2=800.0,
        period_hours=1.0,
    )
    assert pr == 93.75


def test_calculate_performance_ratio_missing_reference_no_silent_zeros():
    """Verify PR returns None when irradiance or reference inputs are missing (no silent zero substitution)."""
    # Missing irradiance
    assert (
        AnalyticsService.calculate_performance_ratio(
            actual_energy_kwh=100.0,
            installed_capacity_kwp=50.0,
            avg_irradiance_wm2=None,
            period_hours=10.0,
        )
        is None
    )

    # Zero irradiance
    assert (
        AnalyticsService.calculate_performance_ratio(
            actual_energy_kwh=0.0,
            installed_capacity_kwp=50.0,
            avg_irradiance_wm2=0.0,
            period_hours=10.0,
        )
        is None
    )

    # Zero installed capacity
    assert (
        AnalyticsService.calculate_performance_ratio(
            actual_energy_kwh=10.0,
            installed_capacity_kwp=0.0,
            avg_irradiance_wm2=800.0,
            period_hours=2.0,
        )
        is None
    )


# ---------------------------------------------------------------------------
# 2. Database & API Endpoints Integration Tests
# ---------------------------------------------------------------------------

@pytest.fixture
def populated_analytics_db(db_session: Session):
    """Seed test database with plant, inverters, telemetry, diagnosis, alert, and work order."""
    # 1. Plant
    plant = Plant(
        id=101,
        name="Apex Solar Park Phase 1",
        system_type="ROOFTOP_COMMERCIAL",
        installed_capacity_kwp=50.0,
        tariff_rate_inr=8.50,
        location="Jaipur, Rajasthan",
        timezone="Asia/Kolkata",
    )
    db_session.add(plant)
    db_session.flush()

    # 2. Inverters
    inv1 = Inverter(
        id="INV-101-A",
        plant_id=101,
        serial_number="SN-INV-101-A",
        manufacturer="Huawei",
        model="SUN2000-50KTL",
        rated_ac_power_kw=50.0,
        status="NORMAL",
    )
    db_session.add(inv1)
    db_session.flush()

    # 3. Telemetry records (3 hours: 10:00, 11:00, 12:00)
    # 10:00 -> 20 kW, 500 W/m²
    # 11:00 -> 40 kW, 800 W/m²  (dt=1h -> ((20+40)/2)*1 = 30 kWh)
    # 12:00 -> 30 kW, 700 W/m²  (dt=1h -> ((40+30)/2)*1 = 35 kWh)
    # Total kWh = 65.0 kWh, Peak = 40 kW, Avg irr = 666.67 W/m²
    t0 = datetime(2026, 10, 5, 10, 0, 0)
    t1 = datetime(2026, 10, 5, 11, 0, 0)
    t2 = datetime(2026, 10, 5, 12, 0, 0)

    db_session.add_all([
        Telemetry(inverter_id="INV-101-A", timestamp=t0, p_ac=20.0, poa_irradiance_wm2=500.0),
        Telemetry(inverter_id="INV-101-A", timestamp=t1, p_ac=40.0, poa_irradiance_wm2=800.0),
        Telemetry(inverter_id="INV-101-A", timestamp=t2, p_ac=30.0, poa_irradiance_wm2=700.0),
    ])

    # 4. Diagnoses
    diag1 = Diagnosis(
        id="DIAG-101",
        plant_id=101,
        inverter_id="INV-101-A",
        fault_class="STRING_DISCONNECTION",
        fault_title="String #3 Disconnected",
        severity="HIGH",
        status="RESOLVED",
        probable_cause="Blown DC fuse or MC4 disconnect",
        root_cause_summary="Fuse tripped due to transient surge.",
        detected_at=datetime(2026, 10, 5, 9, 30, 0),
        resolved_at=datetime(2026, 10, 5, 11, 30, 0),  # 2.0 hours MTTR
        estimated_lost_energy_kwh=12.5,
        financial_deficit_inr=106.25,  # 12.5 * 8.50
    )
    diag2 = Diagnosis(
        id="DIAG-102",
        plant_id=101,
        inverter_id="INV-101-A",
        fault_class="SOILING",
        fault_title="Heavy Soiling Detected",
        severity="MEDIUM",
        status="OPEN",
        probable_cause="Accumulated dust and bird droppings",
        root_cause_summary="Surface layer blocking 15% irradiance.",
        detected_at=datetime(2026, 10, 5, 10, 15, 0),
        estimated_lost_energy_kwh=5.0,
        financial_deficit_inr=42.50,
    )
    db_session.add_all([diag1, diag2])

    # 5. Alert
    alert = Alert(
        id="ALT-101",
        plant_id=101,
        inverter_id="INV-101-A",
        code="ERR_STR_01",
        event_timestamp=datetime(2026, 10, 5, 9, 30, 0),
        acknowledged=True,
        acknowledged_at=datetime(2026, 10, 5, 9, 45, 0),  # 0.25 hours MTTA
        severity="HIGH",
        message="String current dropped to 0A",
    )
    db_session.add(alert)

    # 6. Work Order
    wo = WorkOrder(
        id="WO-101",
        plant_id=101,
        inverter_id="INV-101-A",
        title="Replace blown fuse on string 3",
        priority="HIGH",
        assigned_to="Tech Raj",
        scheduled_date=datetime(2026, 10, 5).date(),
        status="COMPLETED",
        cost_inr=1500.0,
    )
    db_session.add(wo)

    db_session.commit()
    return plant


def test_get_analytics_summary_endpoint(client: TestClient, populated_analytics_db):
    """Test GET /api/v1/analytics/summary."""
    start = "2026-10-05T00:00:00"
    end = "2026-10-05T23:59:59"

    resp = client.get(f"/api/v1/analytics/summary?plant_id=101&start_time={start}&end_time={end}")
    assert resp.status_code == 200
    data = resp.json()

    assert data["plant_id"] == 101
    assert data["total_actual_generation_kwh"] == pytest.approx(65.0, rel=1e-2)
    assert data["applicable_tariff_inr_kwh"] == 8.50
    assert data["total_lost_energy_kwh"] == pytest.approx(17.5, rel=1e-2)  # 12.5 + 5.0
    assert data["total_financial_loss_inr"] == pytest.approx(148.75, rel=1e-2)  # 106.25 + 42.50

    # Maintenance SLA
    assert data["maintenance_sla"]["mean_time_to_acknowledge_hours"] == 0.25
    assert data["maintenance_sla"]["mean_time_to_resolve_hours"] == 2.0
    assert data["maintenance_sla"]["completed_tickets_count"] == 1
    assert data["maintenance_sla"]["total_maintenance_spend_inr"] == 1500.0


def test_get_generation_trends_endpoint(client: TestClient, populated_analytics_db):
    """Test GET /api/v1/analytics/generation with hourly interval."""
    start = "2026-10-05T09:00:00"
    end = "2026-10-05T14:00:00"

    resp = client.get(
        f"/api/v1/analytics/generation?plant_id=101&interval=hourly&start_time={start}&end_time={end}"
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["plant_id"] == 101
    assert data["interval"] == "hourly"
    assert data["peak_power_kw"] == 40.0
    assert len(data["timeseries"]) > 0

    # Verify timeseries structure
    sample_pt = data["timeseries"][0]
    assert "timestamp" in sample_pt
    assert "actual_power_kw" in sample_pt
    assert "actual_energy_kwh" in sample_pt
    assert "data_coverage_pct" in sample_pt


def test_get_energy_loss_endpoint(client: TestClient, populated_analytics_db):
    """Test GET /api/v1/analytics/energy-loss."""
    start = "2026-10-01T00:00:00"
    end = "2026-10-10T23:59:59"

    resp = client.get(f"/api/v1/analytics/energy-loss?plant_id=101&start_time={start}&end_time={end}")
    assert resp.status_code == 200
    data = resp.json()

    assert data["plant_id"] == 101
    assert data["total_energy_lost_kwh"] == 17.5
    assert data["total_financial_loss_inr"] == 148.75
    assert data["tariff_rate_inr"] == 8.50

    # Verify category breakdown contains STRING_DISCONNECTION and SOILING
    cat_classes = [c["fault_class"] for c in data["category_breakdown"]]
    assert "STRING_DISCONNECTION" in cat_classes
    assert "SOILING" in cat_classes

    # Verify daily breakdown has 2026-10-05
    assert len(data["daily_breakdown"]) == 1
    assert data["daily_breakdown"][0]["date"] == "2026-10-05"


def test_get_fault_distribution_endpoint(client: TestClient, populated_analytics_db):
    """Test GET /api/v1/analytics/fault-distribution."""
    start = "2026-10-01T00:00:00"
    end = "2026-10-10T23:59:59"

    resp = client.get(f"/api/v1/analytics/fault-distribution?plant_id=101&start_time={start}&end_time={end}")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_diagnoses_count"] == 2
    assert data["status_breakdown"].get("RESOLVED") == 1
    assert data["status_breakdown"].get("OPEN") == 1

    # Severities
    sev_map = {s["severity"]: s["incident_count"] for s in data["severities"]}
    assert sev_map.get("HIGH") == 1
    assert sev_map.get("MEDIUM") == 1


def test_analytics_invalid_timerange_error(client: TestClient):
    """Verify endpoints return 400 Bad Request if start_time > end_time."""
    start = "2026-10-10T12:00:00"
    end = "2026-10-01T12:00:00"

    resp = client.get(f"/api/v1/analytics/summary?start_time={start}&end_time={end}")
    assert resp.status_code == 400
    assert "start_time must be less than or equal to end_time" in resp.json()["detail"]
