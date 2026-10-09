"""API endpoint tests for Inverters (/api/v1/inverters)."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.inverter import Inverter
from app.models.plant import Plant


def test_list_inverters_and_filter_by_plant(client: TestClient, db_session: Session):
    """Test listing inverters and filtering by plant."""
    plant1 = Plant(name="Plant Inv 1", location="CA", installed_capacity_kwp=10.0)
    plant2 = Plant(name="Plant Inv 2", location="CA", installed_capacity_kwp=10.0)
    db_session.add_all([plant1, plant2])
    db_session.flush()

    inv1 = Inverter(
        id="INV-API-01",
        plant_id=plant1.id,
        serial_number="SN-API-01",
        manufacturer="SMA",
        model="Tripower",
        rated_ac_power_kw=5.0,
    )
    inv2 = Inverter(
        id="INV-API-02",
        plant_id=plant2.id,
        serial_number="SN-API-02",
        manufacturer="SMA",
        model="Tripower",
        rated_ac_power_kw=5.0,
    )
    db_session.add_all([inv1, inv2])
    db_session.flush()

    # List all
    resp_all = client.get("/api/v1/inverters")
    assert resp_all.status_code == 200
    assert resp_all.json()["total"] >= 2

    # Filter by plant1
    resp_plant1 = client.get(f"/api/v1/inverters?plant_id={plant1.id}")
    assert resp_plant1.status_code == 200
    items = resp_plant1.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == "INV-API-01"


def test_create_inverter_valid_and_duplicate_conflict(client: TestClient, db_session: Session):
    """Test registering a new inverter and handling duplicate serial number conflict (409)."""
    plant = Plant(name="Plant for Inv Register", location="CA", installed_capacity_kwp=10.0)
    db_session.add(plant)
    db_session.flush()

    payload = {
        "id": "INV-NEW-01",
        "plant_id": plant.id,
        "serial_number": "DEYE-SUN-5K-001",
        "manufacturer": "Deye",
        "model": "SUN-5K-SG03LP1",
        "firmware_version": "v1.0.4",
        "rated_ac_power_kw": 5.0,
        "mppt_count": 2,
        "strings_count": 2,
        "status": "NORMAL",
    }
    response = client.post("/api/v1/inverters", json=payload)
    assert response.status_code == 201
    assert response.json()["serial_number"] == "DEYE-SUN-5K-001"

    # Duplicate create must fail with 409 Conflict
    dup_payload = {
        "id": "INV-NEW-02",
        "plant_id": plant.id,
        "serial_number": "DEYE-SUN-5K-001",  # Same serial number
        "manufacturer": "Deye",
        "model": "SUN-5K",
        "rated_ac_power_kw": 5.0,
    }
    dup_response = client.post("/api/v1/inverters", json=dup_payload)
    assert dup_response.status_code == 409
    assert dup_response.json()["error"]["code"] == "ENTITY_CONFLICT"


def test_create_inverter_missing_plant_404(client: TestClient):
    """Test registering an inverter under non-existent plant returns 404."""
    payload = {
        "id": "INV-ORPHAN-01",
        "plant_id": 999999,  # Non-existent
        "serial_number": "ORPHAN-SN-1",
        "manufacturer": "SMA",
        "model": "STP",
        "rated_ac_power_kw": 5.0,
    }
    response = client.post("/api/v1/inverters", json=payload)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ENTITY_NOT_FOUND"


def test_get_and_update_inverter(client: TestClient, db_session: Session):
    """Test GET and PUT /api/v1/inverters/{inverter_id}."""
    plant = Plant(name="Plant Inv Update", location="CA", installed_capacity_kwp=10.0)
    db_session.add(plant)
    db_session.flush()

    inv = Inverter(
        id="INV-TO-UPDATE",
        plant_id=plant.id,
        serial_number="SN-UPDATE-01",
        manufacturer="Fronius",
        model="Primo 5k",
        rated_ac_power_kw=5.0,
    )
    db_session.add(inv)
    db_session.flush()

    # Get
    resp_get = client.get("/api/v1/inverters/INV-TO-UPDATE")
    assert resp_get.status_code == 200
    assert resp_get.json()["serial_number"] == "SN-UPDATE-01"

    # Update
    resp_put = client.put(
        "/api/v1/inverters/INV-TO-UPDATE",
        json={"model": "Primo 6.0-1", "rated_ac_power_kw": 6.0, "status": "WARNING"},
    )
    assert resp_put.status_code == 200
    assert resp_put.json()["model"] == "Primo 6.0-1"
    assert resp_put.json()["status"] == "WARNING"
