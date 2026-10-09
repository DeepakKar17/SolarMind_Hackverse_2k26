"""API endpoint tests for Solar Plants (/api/v1/plants)."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.plant import Plant


def test_list_plants_endpoint(client: TestClient, db_session: Session):
    """Test listing solar plants with pagination and summary metrics."""
    # Seed a plant
    plant = Plant(
        name="Sonoma Ridge Solar",
        location="Sonoma, CA",
        timezone="America/Los_Angeles",
        installed_capacity_kwp=18.0,
        status="NORMAL",
    )
    db_session.add(plant)
    db_session.flush()

    response = client.get("/api/v1/plants?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1
    assert any(p["name"] == "Sonoma Ridge Solar" for p in data["items"])


def test_list_plants_with_search_and_status_filter(client: TestClient, db_session: Session):
    """Test filtering plants by search term and status."""
    plant1 = Plant(name="Alpha Sunny Array", location="Bakersfield, CA", installed_capacity_kwp=12.0, status="NORMAL")
    plant2 = Plant(name="Beta Cloudy Array", location="Seattle, WA", installed_capacity_kwp=8.0, status="FAULT")
    db_session.add_all([plant1, plant2])
    db_session.flush()

    # Search filter
    resp = client.get("/api/v1/plants?search=Alpha")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["name"] == "Alpha Sunny Array"

    # Status filter
    resp_status = client.get("/api/v1/plants?status=FAULT")
    assert resp_status.status_code == 200
    items_fault = resp_status.json()["items"]
    assert any(p["name"] == "Beta Cloudy Array" for p in items_fault)
    assert not any(p["name"] == "Alpha Sunny Array" for p in items_fault)


def test_create_plant_valid_payload(client: TestClient):
    """Test creating a new plant with valid payload returns 201 Created."""
    payload = {
        "name": "Silverado Valley Array",
        "location": "Napa, CA",
        "timezone": "America/Los_Angeles",
        "latitude": 38.2975,
        "longitude": -122.2869,
        "system_type": "Single-String Commercial Rooftop",
        "installed_capacity_kwp": 22.5,
        "tariff_rate_inr": 8.00,
        "status": "NORMAL",
        "is_active": True,
    }
    response = client.post("/api/v1/plants", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Silverado Valley Array"
    assert data["installed_capacity_kwp"] == 22.5
    assert data["id"] is not None


def test_create_plant_invalid_numeric_ranges(client: TestClient):
    """Test creating a plant with negative capacity or invalid latitude returns 422."""
    # Negative capacity
    payload_bad_cap = {
        "name": "Bad Capacity Site",
        "location": "City",
        "installed_capacity_kwp": -10.0,
    }
    response = client.post("/api/v1/plants", json=payload_bad_cap)
    assert response.status_code == 422

    # Out-of-bounds latitude
    payload_bad_lat = {
        "name": "Bad Latitude Site",
        "location": "City",
        "installed_capacity_kwp": 10.0,
        "latitude": 99.0,
    }
    response_lat = client.post("/api/v1/plants", json=payload_bad_lat)
    assert response_lat.status_code == 422


def test_get_plant_by_id_and_not_found(client: TestClient, db_session: Session):
    """Test GET /api/v1/plants/{plant_id} returns 200 on existing and 404 on missing."""
    plant = Plant(name="Site Lookup", location="NV", installed_capacity_kwp=5.0)
    db_session.add(plant)
    db_session.flush()

    # Success case
    resp = client.get(f"/api/v1/plants/{plant.id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Site Lookup"

    # Not found case
    resp_404 = client.get("/api/v1/plants/999999")
    assert resp_404.status_code == 404
    assert resp_404.json()["error"]["code"] == "ENTITY_NOT_FOUND"


def test_update_plant_endpoint(client: TestClient, db_session: Session):
    """Test PUT /api/v1/plants/{plant_id} updates fields properly."""
    plant = Plant(name="Old Name Site", location="NV", installed_capacity_kwp=5.0)
    db_session.add(plant)
    db_session.flush()

    update_payload = {"name": "New Name Site", "installed_capacity_kwp": 7.5}
    resp = client.put(f"/api/v1/plants/{plant.id}", json=update_payload)
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name Site"
    assert resp.json()["installed_capacity_kwp"] == 7.5
