"""Unit and integration tests for SolarMind Diagnosis and Work Order API endpoints and services."""

from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.diagnosis import Diagnosis
from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.telemetry import Telemetry
from app.models.work_order import WorkOrder
from app.repositories.diagnosis import diagnosis_repository
from app.repositories.work_order import work_order_repository


@pytest.fixture
def setup_diagnostics_db(db_session: Session):
    """Seed test database with plant, inverters, telemetry, diagnosis, and work order."""
    plant = Plant(
        id=201,
        name="SunGrid Solar Plant",
        system_type="GROUND_MOUNT",
        installed_capacity_kwp=100.0,
        tariff_rate_inr=6.50,
        location="Pune, Maharashtra",
        timezone="Asia/Kolkata",
    )
    db_session.add(plant)
    db_session.flush()

    inv1 = Inverter(
        id="INV-201-1",
        plant_id=201,
        serial_number="SN-INV-201-1",
        manufacturer="Sungrow",
        model="SG110CX",
        rated_ac_power_kw=100.0,
        status="NORMAL",
    )
    inv2 = Inverter(
        id="INV-201-2",
        plant_id=201,
        serial_number="SN-INV-201-2",
        manufacturer="Sungrow",
        model="SG110CX",
        rated_ac_power_kw=100.0,
        status="NORMAL",
    )
    db_session.add_all([inv1, inv2])
    db_session.flush()

    # Telemetry: INV-201-1 has high irradiance (800 W/m²) but 0 kW power (INVERTER_TRIP)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db_session.add(
        Telemetry(
            inverter_id="INV-201-1",
            timestamp=now - timedelta(minutes=10),
            p_ac=0.0,
            v_dc=650.0,
            i_dc=0.0,
            poa_irradiance_wm2=820.0,
            temperature_c=45.0,
            data_source="API",
            data_quality_flag="VALID",
        )
    )

    # Telemetry: INV-201-2 has high temp (76°C) and derating
    db_session.add(
        Telemetry(
            inverter_id="INV-201-2",
            timestamp=now - timedelta(minutes=10),
            p_ac=60.0,
            v_dc=620.0,
            i_dc=98.0,
            poa_irradiance_wm2=750.0,
            temperature_c=76.5,
            data_source="API",
            data_quality_flag="VALID",
        )
    )

    # Existing active diagnosis
    diag = Diagnosis(
        id="DIAG-EXISTING-01",
        plant_id=201,
        inverter_id="INV-201-1",
        fault_class="STRING_DISCONNECTION",
        fault_title="String #2 Open Circuit",
        severity="HIGH",
        status="ACTIVE",
        probable_cause="Fuse blown in string 2",
        root_cause_summary="Zero current recorded on string 2 under full sun.",
        estimated_lost_energy_kwh=10.0,
        financial_deficit_inr=65.0,
        detected_at=now - timedelta(days=1),
    )
    db_session.add(diag)
    db_session.flush()

    # Existing work order
    wo = WorkOrder(
        id="WO-EXISTING-01",
        plant_id=201,
        inverter_id="INV-201-1",
        diagnosis_id="DIAG-EXISTING-01",
        title="Check string 2 fuse",
        priority="HIGH",
        assigned_to="Engineer Amit",
        scheduled_date=date.today(),
        status="PENDING",
        cost_inr=500.0,
    )
    db_session.add(wo)
    db_session.commit()

    return plant


# ---------------------------------------------------------------------------
# 1. Diagnosis API Tests
# ---------------------------------------------------------------------------

def test_list_diagnoses_with_filters(client: TestClient, setup_diagnostics_db):
    """Test GET /api/v1/diagnoses with filtering and pagination."""
    resp = client.get("/api/v1/diagnoses?plant_id=201&status=ACTIVE&page=1&page_size=10")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total"] >= 1
    assert data["page"] == 1
    assert len(data["items"]) >= 1
    assert data["items"][0]["plant_id"] == 201
    assert data["items"][0]["status"] == "ACTIVE"


def test_get_diagnosis_by_id_and_not_found(client: TestClient, setup_diagnostics_db):
    """Test GET /api/v1/diagnoses/{diagnosis_id}."""
    resp = client.get("/api/v1/diagnoses/DIAG-EXISTING-01")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "DIAG-EXISTING-01"
    assert data["fault_class"] == "STRING_DISCONNECTION"

    # Non-existent diagnosis
    resp404 = client.get("/api/v1/diagnoses/DIAG-DOES-NOT-EXIST")
    assert resp404.status_code == 404
    assert "not found" in str(resp404.json()).lower()


def test_analyze_telemetry_endpoint(client: TestClient, setup_diagnostics_db):
    """Test POST /api/v1/diagnoses/analyze triggers rules on recent telemetry."""
    payload = {
        "plant_id": 201,
        "lookback_hours": 24,
        "dry_run": False,
    }
    resp = client.post("/api/v1/diagnoses/analyze", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["plant_id"] == 201
    assert data["inverters_analyzed"] == 2
    assert data["telemetry_samples_evaluated"] >= 2
    assert data["anomalies_detected"] >= 1
    assert data["new_diagnoses_created"] >= 1
    assert len(data["diagnoses"]) >= 1

    # Verify detected classes include INVERTER_TRIP or THERMAL_DERATING
    classes = [d["fault_class"] for d in data["diagnoses"]]
    assert "INVERTER_TRIP" in classes or "THERMAL_DERATING" in classes


def test_patch_diagnosis_status_and_validation(client: TestClient, setup_diagnostics_db):
    """Test PATCH /api/v1/diagnoses/{diagnosis_id} valid and invalid transitions."""
    # 1. Valid transition: ACTIVE -> INVESTIGATING
    resp1 = client.patch(
        "/api/v1/diagnoses/DIAG-EXISTING-01",
        json={"status": "INVESTIGATING", "root_cause_summary": "Technician dispatched to inspect combiner."},
    )
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["status"] == "INVESTIGATING"

    # 2. Valid transition: INVESTIGATING -> RESOLVED (sets resolved_at)
    resp2 = client.patch(
        "/api/v1/diagnoses/DIAG-EXISTING-01",
        json={"status": "RESOLVED"},
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["status"] == "RESOLVED"
    assert data2["resolved_at"] is not None

    # 3. Invalid status transition: RESOLVED -> CONFIRMED is rejected
    resp_invalid = client.patch(
        "/api/v1/diagnoses/DIAG-EXISTING-01",
        json={"status": "CONFIRMED"},
    )
    assert resp_invalid.status_code == 400
    assert "cannot transition" in resp_invalid.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 2. Work Order API Tests
# ---------------------------------------------------------------------------

def test_create_work_order_valid_and_relationships(client: TestClient, setup_diagnostics_db):
    """Test POST /api/v1/work-orders with relational validation."""
    today = date.today()
    due = today + timedelta(days=3)

    payload = {
        "id": "WO-NEW-101",
        "plant_id": 201,
        "inverter_id": "INV-201-1",
        "diagnosis_id": "DIAG-EXISTING-01",
        "title": "Replace DC fuse and check string connector",
        "priority": "HIGH",
        "assigned_to": "Technician Suresh",
        "service_provider": "SolarCare Services Ltd",
        "instructions": "De-energize DC isolator before replacing 15A gPV fuse.",
        "scheduled_date": today.isoformat(),
        "due_date": due.isoformat(),
        "cost_inr": 750.0,
        "status": "PENDING",
        "notes": "Bring spare 15A fuses and multimeter.",
    }

    resp = client.post("/api/v1/work-orders", json=payload)
    assert resp.status_code == 201
    data = resp.json()

    assert data["id"] == "WO-NEW-101"
    assert data["plant_id"] == 201
    assert data["assigned_to"] == "Technician Suresh"
    assert data["status"] == "PENDING"
    assert data["diagnosis_id"] == "DIAG-EXISTING-01"


def test_create_work_order_invalid_plant_or_dates(client: TestClient, setup_diagnostics_db):
    """Test POST /api/v1/work-orders validation failures."""
    today = date.today()
    past = today - timedelta(days=2)

    # 1. Plant not found (404)
    resp_plant_404 = client.post(
        "/api/v1/work-orders",
        json={
            "id": "WO-BAD-PLANT",
            "plant_id": 99999,
            "title": "Routine Maintenance",
            "priority": "LOW",
            "assigned_to": "Tech",
            "scheduled_date": today.isoformat(),
        },
    )
    assert resp_plant_404.status_code == 404

    # 2. due_date < scheduled_date (400)
    resp_bad_date = client.post(
        "/api/v1/work-orders",
        json={
            "id": "WO-BAD-DATES",
            "plant_id": 201,
            "title": "Date check",
            "priority": "LOW",
            "assigned_to": "Tech",
            "scheduled_date": today.isoformat(),
            "due_date": past.isoformat(),
        },
    )
    assert resp_bad_date.status_code == 400
    assert "cannot be earlier than scheduled_date" in resp_bad_date.json()["detail"]


def test_create_work_order_duplicate_conflict(client: TestClient, setup_diagnostics_db):
    """Test POST /api/v1/work-orders with duplicate ID returns 409 Conflict."""
    today = date.today()
    payload = {
        "id": "WO-EXISTING-01",  # Already exists in DB
        "plant_id": 201,
        "title": "Duplicate ID Test",
        "priority": "LOW",
        "assigned_to": "Tech",
        "scheduled_date": today.isoformat(),
    }
    resp = client.post("/api/v1/work-orders", json=payload)
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"].lower()


def test_list_and_get_work_orders(client: TestClient, setup_diagnostics_db):
    """Test GET /api/v1/work-orders and GET /api/v1/work-orders/{id}."""
    # List
    resp_list = client.get("/api/v1/work-orders?plant_id=201&assigned_to=Engineer Amit")
    assert resp_list.status_code == 200
    list_data = resp_list.json()
    assert list_data["total"] >= 1
    assert list_data["items"][0]["id"] == "WO-EXISTING-01"

    # Detail
    resp_get = client.get("/api/v1/work-orders/WO-EXISTING-01")
    assert resp_get.status_code == 200
    assert resp_get.json()["id"] == "WO-EXISTING-01"

    # Not found
    assert client.get("/api/v1/work-orders/WO-DOES-NOT-EXIST").status_code == 404


def test_patch_work_order_workflow_and_diagnosis_sync(client: TestClient, setup_diagnostics_db):
    """Test PATCH /api/v1/work-orders/{id} workflow lifecycle: PENDING -> ASSIGNED -> IN_PROGRESS -> COMPLETED."""
    # 1. PENDING -> ASSIGNED
    r1 = client.patch("/api/v1/work-orders/WO-EXISTING-01", json={"status": "ASSIGNED"})
    assert r1.status_code == 200
    assert r1.json()["status"] == "ASSIGNED"

    # 2. ASSIGNED -> IN_PROGRESS
    r2 = client.patch("/api/v1/work-orders/WO-EXISTING-01", json={"status": "IN_PROGRESS"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "IN_PROGRESS"

    # 3. IN_PROGRESS -> COMPLETED (verifies resolution notes and diagnosis synchronization)
    r3 = client.patch(
        "/api/v1/work-orders/WO-EXISTING-01",
        json={
            "status": "COMPLETED",
            "resolution_notes": "Replaced blown 15A string fuse. String 2 current restored to 8.4A.",
            "duration_hours": 1.5,
            "cost_inr": 620.0,
        },
    )
    assert r3.status_code == 200
    data3 = r3.json()
    assert data3["status"] == "COMPLETED"
    assert data3["completed_date"] is not None
    assert data3["duration_hours"] == 1.5

    # 4. Verify linked diagnosis was automatically marked RESOLVED
    r_diag = client.get("/api/v1/diagnoses/DIAG-EXISTING-01")
    assert r_diag.status_code == 200
    assert r_diag.json()["status"] == "RESOLVED"
    assert r_diag.json()["resolved_at"] is not None
