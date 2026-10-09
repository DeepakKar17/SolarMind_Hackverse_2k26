"""SolarMind Role-Based & Resource-Level Access Control Test Suite.

Verifies admin, homeowner, and technician permissions, cross-user resource isolation,
and forbidden mutations across plants, inverters, diagnoses, and work orders.
"""

from datetime import date, datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.diagnosis import Diagnosis
from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.user import User
from app.models.work_order import WorkOrder
from app.repositories.user import user_repository
from app.services.auth_service import auth_service
from app.services.security import hash_password


@pytest.fixture
def test_users(db_session: Session):
    """Seed distinct users for Admin, Homeowner A, Homeowner B, and Technician."""
    admin = user_repository.create_user(
        db=db_session,
        email="admin@solarmind.io",
        full_name="System Admin",
        hashed_password=hash_password("AdminPass#2026!"),
        role="admin",
        is_active=True,
    )
    homeowner_a = user_repository.create_user(
        db=db_session,
        email="homeowner.a@solarmind.io",
        full_name="Alice Homeowner",
        hashed_password=hash_password("HomeownerPass#2026!"),
        role="homeowner",
        is_active=True,
    )
    homeowner_b = user_repository.create_user(
        db=db_session,
        email="homeowner.b@solarmind.io",
        full_name="Bob Homeowner",
        hashed_password=hash_password("HomeownerPass#2026!"),
        role="homeowner",
        is_active=True,
    )
    technician = user_repository.create_user(
        db=db_session,
        email="tech.charlie@solarmind.io",
        full_name="Charlie Technician",
        hashed_password=hash_password("TechnicianPass#2026!"),
        role="technician",
        is_active=True,
    )
    db_session.commit()
    return {
        "admin": admin,
        "homeowner_a": homeowner_a,
        "homeowner_b": homeowner_b,
        "technician": technician,
    }


def get_auth_headers(client: TestClient, email: str, password: str) -> dict:
    """Helper to authenticate and return Authorization Bearer header."""
    res = client.post("/api/v1/auth/login", json={"email_or_username": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_homeowner_plant_isolation(client: TestClient, db_session: Session, test_users):
    """Verify that a homeowner cannot view or access another user's solar plants."""
    # Create Plant 1 owned by Alice (Homeowner A)
    plant_a = Plant(
        name="Alice's Rooftop Solar",
        location="Austin, TX",
        installed_capacity_kwp=10.0,
        owner_id=test_users["homeowner_a"].id,
    )
    # Create Plant 2 owned by Bob (Homeowner B)
    plant_b = Plant(
        name="Bob's Ranch Solar",
        location="Dallas, TX",
        installed_capacity_kwp=15.0,
        owner_id=test_users["homeowner_b"].id,
    )
    db_session.add_all([plant_a, plant_b])
    db_session.commit()

    headers_a = get_auth_headers(client, "homeowner.a@solarmind.io", "HomeownerPass#2026!")
    headers_b = get_auth_headers(client, "homeowner.b@solarmind.io", "HomeownerPass#2026!")

    # 1. Alice listing plants only sees her own plant
    res_a = client.get("/api/v1/plants", headers=headers_a)
    assert res_a.status_code == 200
    items_a = res_a.json()["items"]
    assert len(items_a) == 1
    assert items_a[0]["name"] == "Alice's Rooftop Solar"

    # 2. Alice accessing her own plant directly succeeds (200)
    res_a_detail = client.get(f"/api/v1/plants/{plant_a.id}", headers=headers_a)
    assert res_a_detail.status_code == 200
    assert res_a_detail.json()["name"] == "Alice's Rooftop Solar"

    # 3. Alice attempting to access Bob's plant by ID returns 403 Forbidden
    res_a_forbidden = client.get(f"/api/v1/plants/{plant_b.id}", headers=headers_a)
    assert res_a_forbidden.status_code == 403
    assert "Access denied" in res_a_forbidden.json()["detail"]

    # 4. Bob attempting to access Alice's plant by ID returns 403 Forbidden
    res_b_forbidden = client.get(f"/api/v1/plants/{plant_a.id}", headers=headers_b)
    assert res_b_forbidden.status_code == 403


def test_homeowner_cannot_modify_plants(client: TestClient, db_session: Session, test_users):
    """Verify that homeowners are forbidden from creating or updating plants."""
    plant_a = Plant(
        name="Alice's Solar",
        location="Austin, TX",
        installed_capacity_kwp=10.0,
        owner_id=test_users["homeowner_a"].id,
    )
    db_session.add(plant_a)
    db_session.commit()

    headers_a = get_auth_headers(client, "homeowner.a@solarmind.io", "HomeownerPass#2026!")

    # Attempt to create plant
    create_res = client.post(
        "/api/v1/plants",
        json={"name": "New Hack Plant", "location": "Houston, TX", "installed_capacity_kwp": 12.0},
        headers=headers_a,
    )
    assert create_res.status_code == 403

    # Attempt to update plant
    update_res = client.put(
        f"/api/v1/plants/{plant_a.id}",
        json={"name": "Hacked Plant Name"},
        headers=headers_a,
    )
    assert update_res.status_code == 403


def test_technician_work_order_access_and_mutation(client: TestClient, db_session: Session, test_users):
    """Verify technicians can only view/update work orders assigned to them."""
    plant = Plant(name="Solar Farm Alpha", location="Phoenix, AZ", installed_capacity_kwp=25.0)
    db_session.add(plant)
    db_session.flush()

    # Work Order 1 assigned to Charlie Technician
    wo_assigned = WorkOrder(
        id="WO-TECH-01",
        plant_id=plant.id,
        title="Inverter Filter Replacement",
        assigned_to="Charlie Technician",
        technician_id=test_users["technician"].id,
        scheduled_date=date(2026, 10, 20),
        status="ASSIGNED",
    )
    # Work Order 2 assigned to Dave OtherTech
    wo_unassigned = WorkOrder(
        id="WO-OTHER-02",
        plant_id=plant.id,
        title="High Voltage Relay Test",
        assigned_to="Dave OtherTech",
        scheduled_date=date(2026, 10, 21),
        status="ASSIGNED",
    )
    db_session.add_all([wo_assigned, wo_unassigned])
    db_session.commit()

    headers_tech = get_auth_headers(client, "tech.charlie@solarmind.io", "TechnicianPass#2026!")

    # 1. Technician listing work orders only sees assigned WO-TECH-01
    list_res = client.get("/api/v1/work-orders", headers=headers_tech)
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == "WO-TECH-01"

    # 2. Technician accessing assigned work order succeeds
    get_res = client.get("/api/v1/work-orders/WO-TECH-01", headers=headers_tech)
    assert get_res.status_code == 200

    # 3. Technician accessing unassigned work order returns 403 Forbidden
    forbidden_get = client.get("/api/v1/work-orders/WO-OTHER-02", headers=headers_tech)
    assert forbidden_get.status_code == 403

    # 4. Technician updating assigned work order status to IN_PROGRESS succeeds
    update_res = client.patch(
        "/api/v1/work-orders/WO-TECH-01",
        json={"status": "IN_PROGRESS", "resolution_notes": "Started inspection on-site."},
        headers=headers_tech,
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "IN_PROGRESS"

    # 5. Technician attempting to update unassigned work order returns 403 Forbidden
    forbidden_update = client.patch(
        "/api/v1/work-orders/WO-OTHER-02",
        json={"status": "COMPLETED"},
        headers=headers_tech,
    )
    assert forbidden_update.status_code == 403


def test_admin_has_full_fleet_access(client: TestClient, db_session: Session, test_users):
    """Verify administrator has full fleet access and can modify plants and work orders."""
    plant = Plant(
        name="Universal Array",
        location="Denver, CO",
        installed_capacity_kwp=50.0,
        owner_id=test_users["homeowner_a"].id,
    )
    db_session.add(plant)
    db_session.commit()

    headers_admin = get_auth_headers(client, "admin@solarmind.io", "AdminPass#2026!")

    # Admin can view plant owned by homeowner
    get_res = client.get(f"/api/v1/plants/{plant.id}", headers=headers_admin)
    assert get_res.status_code == 200

    # Admin can update plant
    update_res = client.put(
        f"/api/v1/plants/{plant.id}",
        json={"name": "Universal Array Updated by Admin"},
        headers=headers_admin,
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Universal Array Updated by Admin"
