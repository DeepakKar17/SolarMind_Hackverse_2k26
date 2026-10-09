"""Comprehensive Test Suite for SolarMind Administrative Management Module.

Tests user provisioning, role assignments, self-lockout and last-admin safeguards,
plant owner association, duplicate device protection, fault rule thresholds with versioning/rollback,
safe integration tests with masked secrets, audit logging, and RBAC permissions.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent
from app.models.fault_rule import FaultRule
from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.user import User
from app.repositories.user import user_repository
from app.services.security import hash_password


def get_auth_headers(client: TestClient, email: str, password: str) -> dict:
    """Helper to authenticate and return Authorization Bearer header."""
    res = client.post("/api/v1/auth/login", json={"email_or_username": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_admin(db_session: Session):
    admin = user_repository.get_by_email(db_session, "admin@solarmind.io")
    if not admin:
        admin = user_repository.create_user(
            db=db_session,
            email="admin@solarmind.io",
            full_name="Solar Chief Admin",
            hashed_password=hash_password("AdminPass123!"),
            role="admin",
            is_active=True,
        )
        db_session.commit()
    return admin


@pytest.fixture
def test_homeowner(db_session: Session):
    homeowner = user_repository.get_by_email(db_session, "homeowner@test.io")
    if not homeowner:
        homeowner = user_repository.create_user(
            db=db_session,
            email="homeowner@test.io",
            full_name="Joe Homeowner",
            hashed_password=hash_password("HomePass123!"),
            role="homeowner",
            is_active=True,
        )
        db_session.commit()
    return homeowner


def test_admin_list_and_search_users(client: TestClient, test_admin, db_session: Session):
    headers = get_auth_headers(client, "admin@solarmind.io", "AdminPass123!")

    # Add sample users
    u1 = User(email="test.tech@solarmind.io", full_name="Arun Tech", role="technician", is_active=True, hashed_password=hash_password("Pass123!"))
    u2 = User(email="test.owner@gmail.com", full_name="Kavita Owner", role="homeowner", is_active=False, hashed_password=hash_password("Pass123!"))
    db_session.add_all([u1, u2])
    db_session.commit()

    # List all
    res = client.get("/api/v1/admin/users", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 3
    assert any(u["email"] == "test.tech@solarmind.io" for u in data["items"])

    # Filter by role
    res_tech = client.get("/api/v1/admin/users?role=technician", headers=headers)
    assert res_tech.status_code == 200
    assert all(u["role"] == "technician" for u in res_tech.json()["items"])

    # Search by name
    res_search = client.get("/api/v1/admin/users?search=Kavita", headers=headers)
    assert res_search.status_code == 200
    assert len(res_search.json()["items"]) == 1
    assert res_search.json()["items"][0]["email"] == "test.owner@gmail.com"


def test_admin_user_provisioning_and_safeguards(client: TestClient, test_admin, db_session: Session):
    headers = get_auth_headers(client, "admin@solarmind.io", "AdminPass123!")

    # 1. Invite new user
    invite_payload = {
        "email": "new.member@solarmind.io",
        "full_name": "New Team Member",
        "role": "technician",
        "password": "SecurePassword123!",
    }
    res = client.post("/api/v1/admin/users", json=invite_payload, headers=headers)
    assert res.status_code == 201
    new_user_id = res.json()["id"]
    assert res.json()["role"] == "technician"

    # 2. Update role to homeowner
    res_role = client.patch(f"/api/v1/admin/users/{new_user_id}/role", json={"role": "homeowner"}, headers=headers)
    assert res_role.status_code == 200
    assert res_role.json()["role"] == "homeowner"

    # 3. Deactivate account
    res_status = client.patch(f"/api/v1/admin/users/{new_user_id}/status", json={"is_active": False}, headers=headers)
    assert res_status.status_code == 200
    assert res_status.json()["is_active"] is False

    # 4. Safeguard: Admin cannot self-deactivate
    res_self = client.patch(f"/api/v1/admin/users/{test_admin.id}/status", json={"is_active": False}, headers=headers)
    assert res_self.status_code == 400
    assert "cannot deactivate your own" in res_self.json()["detail"].lower()

    # 5. Safeguard: Cannot demote the last remaining active administrator
    res_demote = client.patch(f"/api/v1/admin/users/{test_admin.id}/role", json={"role": "technician"}, headers=headers)
    assert res_demote.status_code == 400
    assert "last remaining active administrator" in res_demote.json()["detail"].lower()


def test_duplicate_inverter_serial_protection(client: TestClient, test_admin, db_session: Session):
    headers = get_auth_headers(client, "admin@solarmind.io", "AdminPass123!")

    # Create plant first
    plant = Plant(name="Admin Array Site", location="Site A", installed_capacity_kwp=10.0, owner_id=test_admin.id)
    db_session.add(plant)
    db_session.commit()
    db_session.refresh(plant)

    # 1. Register first inverter
    inv1_payload = {
        "id": "INV-ADMIN-101",
        "plant_id": plant.id,
        "serial_number": "SN-DEYE-UNIQUE-999",
        "manufacturer": "Deye",
        "model": "SUN-10K-SG04LP3",
        "rated_ac_power_kw": 10.0,
    }
    res1 = client.post("/api/v1/inverters", json=inv1_payload, headers=headers)
    assert res1.status_code == 201

    # 2. Attempt duplicate serial registration
    inv2_payload = {
        "id": "INV-ADMIN-102",
        "plant_id": plant.id,
        "serial_number": "SN-DEYE-UNIQUE-999",  # Duplicate serial!
        "manufacturer": "Deye",
        "model": "SUN-10K-SG04LP3",
        "rated_ac_power_kw": 10.0,
    }
    res2 = client.post("/api/v1/inverters", json=inv2_payload, headers=headers)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"].lower()


def test_fault_rules_versioning_and_rollback(client: TestClient, test_admin, db_session: Session):
    headers = get_auth_headers(client, "admin@solarmind.io", "AdminPass123!")

    # 1. List rules
    res_list = client.get("/api/v1/admin/rules", headers=headers)
    assert res_list.status_code == 200
    rules = res_list.json()
    assert len(rules) >= 4
    target_rule_id = rules[0]["id"]
    initial_threshold = rules[0]["threshold_value"]

    # 2. Update threshold
    new_threshold = 25.5
    res_update = client.put(
        f"/api/v1/admin/rules/{target_rule_id}",
        json={"threshold_value": new_threshold, "documentation": "Updated baseline"},
        headers=headers,
    )
    assert res_update.status_code == 200
    updated_rule = res_update.json()
    assert updated_rule["threshold_value"] == new_threshold
    assert updated_rule["previous_threshold_value"] == initial_threshold
    assert updated_rule["version"] == 2
    assert updated_rule["updated_by"] == test_admin.email

    # 3. Rollback threshold
    res_rollback = client.post(f"/api/v1/admin/rules/{target_rule_id}/rollback", headers=headers)
    assert res_rollback.status_code == 200
    rolled_back = res_rollback.json()
    assert rolled_back["threshold_value"] == initial_threshold
    assert rolled_back["version"] == 3


def test_integrations_connection_and_masked_secrets(client: TestClient, test_admin, db_session: Session):
    headers = get_auth_headers(client, "admin@solarmind.io", "AdminPass123!")

    # 1. List integrations
    res = client.get("/api/v1/admin/integrations", headers=headers)
    assert res.status_code == 200
    integrations = res.json()
    assert len(integrations) >= 4

    # Ensure no raw secret is exposed
    for integ in integrations:
        assert "encrypted_secret" not in integ
        if integ.get("masked_secret"):
            assert "•" in integ["masked_secret"]

    # 2. Safe test connection
    target_id = integrations[0]["id"]
    res_test = client.post(f"/api/v1/admin/integrations/{target_id}/test", headers=headers)
    assert res_test.status_code == 200
    assert res_test.json()["status"] == "CONNECTED"
    assert res_test.json()["latency_ms"] > 0


def test_audit_logs_recorded_and_filterable(client: TestClient, test_admin, db_session: Session):
    headers = get_auth_headers(client, "admin@solarmind.io", "AdminPass123!")

    # 1. Create a user to trigger audit logging
    client.post(
        "/api/v1/admin/users",
        json={
            "email": "audit.test@solarmind.io",
            "full_name": "Audit Test Subject",
            "role": "technician",
            "password": "Password123!",
        },
        headers=headers,
    )

    # 2. Query audit logs
    res = client.get("/api/v1/admin/audit-logs", headers=headers)
    assert res.status_code == 200
    audit_data = res.json()
    assert audit_data["total"] > 0
    assert any(e["action"] == "INVITE_USER" for e in audit_data["items"])


def test_homeowner_forbidden_from_admin_endpoints(client: TestClient, test_homeowner):
    headers = get_auth_headers(client, "homeowner@test.io", "HomePass123!")

    # Homeowner attempt on /api/v1/admin/users
    res_users = client.get("/api/v1/admin/users", headers=headers)
    assert res_users.status_code == 403

    # Homeowner attempt on /api/v1/admin/rules
    res_rules = client.get("/api/v1/admin/rules", headers=headers)
    assert res_rules.status_code == 403

    # Homeowner attempt on /api/v1/admin/audit-logs
    res_audit = client.get("/api/v1/admin/audit-logs", headers=headers)
    assert res_audit.status_code == 403
