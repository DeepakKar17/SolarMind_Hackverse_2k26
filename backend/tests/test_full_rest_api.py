"""Comprehensive REST API Endpoints & Role Authorization Test Suite.

Tests:
1. Authentication Endpoints (/api/v1/auth/*)
2. Admin Endpoints (/api/v1/admin/* - overview, users, audit-logs, integrations, system-health)
3. Homeowner Endpoints (/api/v1/home/* - dashboard, plants, alerts, diagnoses, work-orders)
4. Technician Endpoints (/api/v1/technician/* - dashboard, work-orders, inspection, completion)
5. Shared Resource Endpoints (/api/v1/alerts/*, /api/v1/photos/*)
6. Negative Cross-Account Access & Role Restrictions
"""

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import sanitize_filename
from app.main import app
from app.models.alert import Alert
from app.models.diagnosis import Diagnosis
from app.models.inverter import Inverter
from app.models.photo_inspection import PhotoInspection
from app.models.plant import Plant
from app.models.plant_user_assignment import PlantUserAssignment
from app.models.user import User
from app.models.work_order import WorkOrder
from app.services.auth_service import auth_service
from app.services.security import hash_password


# ===========================================================================
# Fixtures
# ===========================================================================


@pytest.fixture
def seeded_users(db_session: Session) -> dict[str, dict]:
    """Create test users and generate session tokens for API authentication."""
    pw_hash = hash_password("Password123!")

    admin_user = User(
        email="api_admin@solarmind.com",
        username="api_admin",
        hashed_password=pw_hash,
        full_name="API Admin",
        role="admin",
        is_active=True,
        is_verified=True,
    )
    homeowner_1 = User(
        email="api_home1@solarmind.com",
        username="api_home1",
        hashed_password=pw_hash,
        full_name="API Homeowner 1",
        role="homeowner",
        is_active=True,
        is_verified=True,
    )
    homeowner_2 = User(
        email="api_home2@solarmind.com",
        username="api_home2",
        hashed_password=pw_hash,
        full_name="API Homeowner 2",
        role="homeowner",
        is_active=True,
        is_verified=True,
    )
    technician_1 = User(
        email="api_tech1@solarmind.com",
        username="api_tech1",
        hashed_password=pw_hash,
        full_name="API Tech 1",
        role="technician",
        is_active=True,
        is_verified=True,
    )
    technician_2 = User(
        email="api_tech2@solarmind.com",
        username="api_tech2",
        hashed_password=pw_hash,
        full_name="API Tech 2",
        role="technician",
        is_active=True,
        is_verified=True,
    )

    users = [admin_user, homeowner_1, homeowner_2, technician_1, technician_2]
    db_session.add_all(users)
    db_session.commit()
    for u in users:
        db_session.refresh(u)

    from app.schemas.auth import UserLoginRequest
    # Create tokens for each
    _, admin_token, _ = auth_service.authenticate_user(db_session, UserLoginRequest(email_or_username="api_admin@solarmind.com", password="Password123!"))
    _, home1_token, _ = auth_service.authenticate_user(db_session, UserLoginRequest(email_or_username="api_home1@solarmind.com", password="Password123!"))
    _, home2_token, _ = auth_service.authenticate_user(db_session, UserLoginRequest(email_or_username="api_home2@solarmind.com", password="Password123!"))
    _, tech1_token, _ = auth_service.authenticate_user(db_session, UserLoginRequest(email_or_username="api_tech1@solarmind.com", password="Password123!"))
    _, tech2_token, _ = auth_service.authenticate_user(db_session, UserLoginRequest(email_or_username="api_tech2@solarmind.com", password="Password123!"))

    return {
        "admin": {"user": admin_user, "token": admin_token, "headers": {"Authorization": f"Bearer {admin_token}"}},
        "home1": {"user": homeowner_1, "token": home1_token, "headers": {"Authorization": f"Bearer {home1_token}"}},
        "home2": {"user": homeowner_2, "token": home2_token, "headers": {"Authorization": f"Bearer {home2_token}"}},
        "tech1": {"user": technician_1, "token": tech1_token, "headers": {"Authorization": f"Bearer {tech1_token}"}},
        "tech2": {"user": technician_2, "token": tech2_token, "headers": {"Authorization": f"Bearer {tech2_token}"}},
    }


@pytest.fixture
def seeded_ecosystem(db_session: Session, seeded_users: dict[str, dict]) -> dict[str, any]:
    """Seed plants, inverters, alerts, diagnoses, and work orders."""
    h1 = seeded_users["home1"]["user"]
    h2 = seeded_users["home2"]["user"]
    t1 = seeded_users["tech1"]["user"]

    # Plant 1 (Homeowner 1)
    p1 = Plant(
        name="Villa SunPower API P1",
        location="101 Rooftop Way, Bhubaneswar",
        installed_capacity_kwp=5.5,
        owner_id=h1.id,
        status="NORMAL",
        is_active=True,
    )
    # Plant 2 (Homeowner 2)
    p2 = Plant(
        name="Eco Green API P2",
        location="202 Solar Circle, Cuttack",
        installed_capacity_kwp=4.2,
        owner_id=h2.id,
        status="NORMAL",
        is_active=True,
    )
    db_session.add_all([p1, p2])
    db_session.commit()
    db_session.refresh(p1)
    db_session.refresh(p2)

    # Inverters
    inv1 = Inverter(
        id="INV-API-P1-001",
        plant_id=p1.id,
        serial_number="SN-API-INV1",
        manufacturer="Growatt",
        model="5000TL",
        rated_ac_power_kw=5.0,
        status="NORMAL",
    )
    inv2 = Inverter(
        id="INV-API-P2-001",
        plant_id=p2.id,
        serial_number="SN-API-INV2",
        manufacturer="Solis",
        model="4G",
        rated_ac_power_kw=4.0,
        status="NORMAL",
    )
    db_session.add_all([inv1, inv2])
    db_session.commit()

    # Diagnosis on Plant 1
    diag1 = Diagnosis(
        id="DIAG-API-P1-001",
        plant_id=p1.id,
        inverter_id=inv1.id,
        fault_class="SHADING",
        fault_title="Tree Shade Anomaly",
        severity="WARNING",
        confidence_score=0.91,
        probable_cause="Tree branches obstructing array",
        root_cause_summary="Obstruction on String 1",
        recommended_action="Trim tree branches",
    )
    db_session.add(diag1)
    db_session.commit()
    db_session.refresh(diag1)

    # Work Order on Plant 1 assigned to Technician 1
    wo1 = WorkOrder(
        id="WO-API-P1-001",
        plant_id=p1.id,
        technician_id=t1.id,
        assigned_to=t1.full_name,
        diagnosis_id=diag1.id,
        title="Trim branches near String 1",
        scheduled_date=datetime.now(timezone.utc).date(),
        status="ASSIGNED",
        priority="MEDIUM",
    )
    db_session.add(wo1)

    # Alert on Plant 1
    alt1 = Alert(
        id="ALT-API-P1-001",
        plant_id=p1.id,
        code="VOLTAGE_ANOMALY",
        severity="WARNING",
        message="Voltage drop detected on string 1",
        status="ACTIVE",
    )
    db_session.add(alt1)
    db_session.commit()

    return {
        "plant_1": p1,
        "plant_2": p2,
        "inv_1": inv1,
        "inv_2": inv2,
        "diag_1": diag1,
        "wo_1": wo1,
        "alert_1": alt1,
    }


# ===========================================================================
# 1. Authentication Endpoints
# ===========================================================================

def test_auth_me_endpoint(client: TestClient, seeded_users: dict[str, dict]):
    """GET /api/v1/auth/me returns current user profile."""
    headers = seeded_users["home1"]["headers"]
    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "api_home1@solarmind.com"
    assert data["role"] == "homeowner"


def test_auth_me_unauthorized(client: TestClient):
    """GET /api/v1/auth/me without token returns 401."""
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401


def test_auth_logout_endpoint(client: TestClient, seeded_users: dict[str, dict]):
    """POST /api/v1/auth/logout revokes session."""
    headers = seeded_users["home2"]["headers"]
    res = client.post("/api/v1/auth/logout", headers=headers)
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_auth_forgot_password_anti_enumeration(client: TestClient):
    """POST /api/v1/auth/forgot-password returns success message regardless of email existence."""
    res = client.post("/api/v1/auth/forgot-password", json={"email": "nonexistent@solarmind.com"})
    assert res.status_code == 200
    assert res.json()["success"] is True


# ===========================================================================
# 2. Admin Endpoints
# ===========================================================================

def test_admin_overview_endpoint(client: TestClient, seeded_users: dict[str, dict], seeded_ecosystem: dict[str, any]):
    """GET /api/v1/admin/overview returns aggregated fleet metrics for admin."""
    headers = seeded_users["admin"]["headers"]
    res = client.get("/api/v1/admin/overview", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_plants"] >= 2
    assert data["system_status"] == "HEALTHY"


def test_admin_overview_forbidden_for_homeowner(client: TestClient, seeded_users: dict[str, dict]):
    """Homeowner cannot access /api/v1/admin/overview (403 Forbidden)."""
    headers = seeded_users["home1"]["headers"]
    res = client.get("/api/v1/admin/overview", headers=headers)
    assert res.status_code == 403


def test_admin_users_list_and_patch(client: TestClient, seeded_users: dict[str, dict]):
    """GET /api/v1/admin/users and PATCH /api/v1/admin/users/{id}."""
    headers = seeded_users["admin"]["headers"]
    target_user = seeded_users["home2"]["user"]

    # 1. List users
    res = client.get("/api/v1/admin/users", headers=headers)
    assert res.status_code == 200
    assert res.json()["total"] >= 5

    # 2. Patch user
    patch_res = client.patch(
        f"/api/v1/admin/users/{target_user.id}",
        json={"full_name": "Updated Homeowner Two Name"},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["full_name"] == "Updated Homeowner Two Name"


def test_admin_system_health(client: TestClient, seeded_users: dict[str, dict]):
    """GET /api/v1/admin/system-health."""
    headers = seeded_users["admin"]["headers"]
    res = client.get("/api/v1/admin/system-health", headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "HEALTHY"


def test_admin_audit_logs(client: TestClient, seeded_users: dict[str, dict]):
    """GET /api/v1/admin/audit-logs."""
    headers = seeded_users["admin"]["headers"]
    res = client.get("/api/v1/admin/audit-logs", headers=headers)
    assert res.status_code == 200
    assert "items" in res.json()


# ===========================================================================
# 3. Homeowner Endpoints
# ===========================================================================

def test_homeowner_dashboard(client: TestClient, seeded_users: dict[str, dict], seeded_ecosystem: dict[str, any]):
    """GET /api/v1/home/dashboard returns homeowner's solar metrics."""
    headers = seeded_users["home1"]["headers"]
    res = client.get("/api/v1/home/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_plants"] == 1
    assert data["total_capacity_kwp"] == 5.5
    assert data["health_score"] > 0


def test_homeowner_plants_isolation(client: TestClient, seeded_users: dict[str, dict], seeded_ecosystem: dict[str, any]):
    """GET /api/v1/home/plants returns only owned plants, preventing cross-account leakage."""
    headers1 = seeded_users["home1"]["headers"]
    res1 = client.get("/api/v1/home/plants", headers=headers1)
    assert res1.status_code == 200
    plants1 = res1.json()
    assert len(plants1) == 1
    assert plants1[0]["name"] == "Villa SunPower API P1"

    headers2 = seeded_users["home2"]["headers"]
    res2 = client.get("/api/v1/home/plants", headers=headers2)
    assert res2.status_code == 200
    plants2 = res2.json()
    assert len(plants2) == 1
    assert plants2[0]["name"] == "Eco Green API P2"


def test_homeowner_alerts_and_diagnoses(client: TestClient, seeded_users: dict[str, dict], seeded_ecosystem: dict[str, any]):
    """GET /api/v1/home/alerts and GET /api/v1/home/diagnoses."""
    headers = seeded_users["home1"]["headers"]
    res_alerts = client.get("/api/v1/home/alerts", headers=headers)
    assert res_alerts.status_code == 200
    assert res_alerts.json()["total"] >= 1

    res_diag = client.get("/api/v1/home/diagnoses", headers=headers)
    assert res_diag.status_code == 200
    assert res_diag.json()["total"] >= 1


# ===========================================================================
# 4. Technician Endpoints
# ===========================================================================

def test_technician_dashboard(client: TestClient, seeded_users: dict[str, dict], seeded_ecosystem: dict[str, any]):
    """GET /api/v1/technician/dashboard returns assigned job queue."""
    headers = seeded_users["tech1"]["headers"]
    res = client.get("/api/v1/technician/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["assigned_work_orders_count"] >= 1


def test_technician_work_order_inspection_and_completion(
    client: TestClient, seeded_users: dict[str, dict], seeded_ecosystem: dict[str, any]
):
    """POST inspection and completion for assigned work order."""
    headers1 = seeded_users["tech1"]["headers"]
    wo = seeded_ecosystem["wo_1"]

    # 1. Submit Inspection
    insp_res = client.post(
        f"/api/v1/technician/work-orders/{wo.id}/inspection",
        json={"findings": "Array inspected. 2 branches causing heavy partial shading.", "status": "IN_PROGRESS"},
        headers=headers1,
    )
    assert insp_res.status_code == 200
    assert insp_res.json()["status"] == "IN_PROGRESS"

    # 2. Complete Work Order
    comp_res = client.post(
        f"/api/v1/technician/work-orders/{wo.id}/completion",
        json={
            "resolution_notes": "Branches pruned safely. Irradiance and voltage restored to 100%.",
            "duration_hours": 1.5,
            "cost_inr": 850.0,
        },
        headers=headers1,
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "COMPLETED"


def test_technician_cannot_modify_unassigned_work_order(
    client: TestClient, seeded_users: dict[str, dict], seeded_ecosystem: dict[str, any]
):
    """Technician 2 cannot modify Technician 1's work order (403 Forbidden)."""
    headers2 = seeded_users["tech2"]["headers"]
    wo = seeded_ecosystem["wo_1"]

    res = client.post(
        f"/api/v1/technician/work-orders/{wo.id}/inspection",
        json={"findings": "Unauthorized attempt."},
        headers=headers2,
    )
    assert res.status_code == 403


# ===========================================================================
# 5. Shared Alerts & Photo Inspection Endpoints
# ===========================================================================

def test_alerts_acknowledge_and_resolve(
    client: TestClient, seeded_users: dict[str, dict], seeded_ecosystem: dict[str, any]
):
    """POST /api/v1/alerts/{id}/acknowledge and /resolve."""
    headers_tech = seeded_users["tech1"]["headers"]
    alt = seeded_ecosystem["alert_1"]

    # Acknowledge
    ack_res = client.post(
        f"/api/v1/alerts/{alt.id}/acknowledge",
        json={"acknowledged_by": "API Tech 1"},
        headers=headers_tech,
    )
    assert ack_res.status_code == 200
    assert ack_res.json()["acknowledged"] is True

    # Resolve
    res_res = client.post(
        f"/api/v1/alerts/{alt.id}/resolve",
        headers=headers_tech,
    )
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "RESOLVED"


def test_photos_endpoints(
    client: TestClient, seeded_users: dict[str, dict], seeded_ecosystem: dict[str, any]
):
    """POST /api/v1/photos/upload and GET /api/v1/photos."""
    headers = seeded_users["home1"]["headers"]
    plant = seeded_ecosystem["plant_1"]

    # Upload/register photo inspection
    upload_res = client.post(
        "/api/v1/photos/upload",
        json={
            "id": "PHOTO-REST-001",
            "plant_id": plant.id,
            "image_path": "/uploads/test_photo.jpg",
            "original_filename": "test_photo.jpg",
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        },
        headers=headers,
    )
    assert upload_res.status_code == 201

    # List photos
    list_res = client.get("/api/v1/photos", headers=headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1
