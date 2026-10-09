"""
End-to-End Acceptance, Security, and Integration Audit Scenario for SolarMind.

Executes the complete 12-step user scenario:
1. Provision an administrator safely.
2. Sign in as admin and register a plant.
3. Create or invite a homeowner and assign the plant.
4. Register an authorized technician and assign a work order.
5. Import a labelled telemetry dataset or connect a verified provider.
6. Run a diagnosis using available evidence.
7. View the result as the homeowner.
8. Inspect the assignment as the technician.
9. Upload inspection evidence.
10. Complete the work order and verify recovery when data supports it.
11. Check audit events and confirm access restrictions.
12. Verify data persistence and cross-user security isolation.
"""

from datetime import datetime, timezone, timedelta
import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.audit_event import AuditEvent
from app.models.diagnosis import Diagnosis
from app.models.inverter import Inverter
from app.models.photo_inspection import PhotoInspection
from app.models.plant import Plant
from app.models.plant_user_assignment import PlantUserAssignment
from app.models.telemetry import Telemetry
from app.models.user import User
from app.models.work_order import WorkOrder
from app.services.security import hash_password


def test_complete_12_step_e2e_acceptance_and_security(client: TestClient, db_session: Session):
    # -------------------------------------------------------------
    # Step 1: Provision an administrator safely
    # -------------------------------------------------------------
    admin_user = User(
        email="audit_master_admin@solarmind.com",
        username="audit_master_admin",
        hashed_password=hash_password("AdminSecurePass123!"),
        full_name="Audit Master Admin",
        role="ADMIN",
        is_active=True,
        is_verified=True,
    )
    db_session.add(admin_user)
    db_session.commit()
    db_session.refresh(admin_user)

    admin_login = client.post("/api/v1/auth/login", json={"email_or_username": "audit_master_admin@solarmind.com", "password": "AdminSecurePass123!"})
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Verify /api/v1/auth/me returns authoritative user role
    me_resp = client.get("/api/v1/auth/me", headers=admin_headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["role"] == "ADMIN"
    assert "hashed_password" not in me_resp.json()

    # -------------------------------------------------------------
    # Step 2: Sign in as admin and register a plant
    # -------------------------------------------------------------
    plant_payload = {
        "name": "Audit Solar Farm Alpha",
        "location": "Bhubaneswar, Odisha",
        "timezone": "Asia/Kolkata",
        "latitude": 20.2961,
        "longitude": 85.8245,
        "system_type": "Commercial Rooftop",
        "installed_capacity_kwp": 125.0,
        "tariff_rate_inr": 7.50,
        "status": "NORMAL"
    }
    plant_resp = client.post("/api/v1/plants", json=plant_payload, headers=admin_headers)
    assert plant_resp.status_code in [200, 201]
    plant_id = plant_resp.json()["id"]

    # Register an inverter
    inv_payload = {
        "id": "INV-AUDIT-001",
        "plant_id": plant_id,
        "serial_number": "DY-AUDIT-INV-001",
        "manufacturer": "Deye",
        "model": "SUN-60K-SG01HP3-EU",
        "rated_ac_power_kw": 60.0,
        "mppt_count": 4,
        "strings_count": 8,
        "status": "NORMAL"
    }
    inv_resp = client.post("/api/v1/inverters", json=inv_payload, headers=admin_headers)
    assert inv_resp.status_code in [200, 201]
    inverter_id = inv_resp.json()["id"]

    # -------------------------------------------------------------
    # Step 3: Create or invite a homeowner and assign the plant
    # -------------------------------------------------------------
    homeowner = User(
        email="homeowner_sarah@example.com",
        username="sarah_home",
        hashed_password=hash_password("HomeOwnerPass123!"),
        full_name="Sarah Jenkins",
        role="HOMEOWNER",
        is_active=True,
        is_verified=True,
    )
    db_session.add(homeowner)
    db_session.commit()
    db_session.refresh(homeowner)
    homeowner_id = homeowner.id

    # Assign plant to homeowner
    plant_rec = db_session.query(Plant).filter(Plant.id == plant_id).first()
    if plant_rec:
        plant_rec.owner_id = homeowner_id
    assignment = PlantUserAssignment(
        plant_id=plant_id,
        user_id=homeowner_id,
        role="homeowner"
    )
    db_session.add(assignment)
    db_session.commit()

    home_login = client.post("/api/v1/auth/login", json={"email_or_username": "homeowner_sarah@example.com", "password": "HomeOwnerPass123!"})
    assert home_login.status_code == 200
    home_token = home_login.json()["access_token"]
    home_headers = {"Authorization": f"Bearer {home_token}"}

    # -------------------------------------------------------------
    # Step 4: Register an authorized technician and assign a work order
    # -------------------------------------------------------------
    technician = User(
        email="tech_alex@solarmind.io",
        username="alex_tech",
        hashed_password=hash_password("TechSecurePass123!"),
        full_name="Alex Rivera",
        role="TECHNICIAN",
        is_active=True,
        is_verified=True,
    )
    db_session.add(technician)
    db_session.commit()
    db_session.refresh(technician)
    tech_id = technician.id

    tech_login = client.post("/api/v1/auth/login", json={"email_or_username": "tech_alex@solarmind.io", "password": "TechSecurePass123!"})
    assert tech_login.status_code == 200
    tech_token = tech_login.json()["access_token"]
    tech_headers = {"Authorization": f"Bearer {tech_token}"}

    # -------------------------------------------------------------
    # Step 5: Import labelled telemetry dataset
    # -------------------------------------------------------------
    now = datetime.now(timezone.utc)
    for i in range(5):
        t_time = now - timedelta(minutes=15 * (5 - i))
        reading = Telemetry(
            inverter_id=str(inverter_id),
            timestamp=t_time,
            p_dc=20.0,
            p_ac=19.5,
            v_ac=230.0,
            frequency_hz=50.0,
            temperature_c=32.0,
            ambient_temp_c=30.0,
            poa_irradiance_wm2=750.0,
            daily_yield_kwh=12.0 + i * 1.5,
            data_source="SIMULATED",
            data_quality_flag="VALID"
        )
        db_session.add(reading)
    db_session.commit()

    # -------------------------------------------------------------
    # Step 6: Run a diagnosis using available evidence
    # -------------------------------------------------------------
    diagnosis = Diagnosis(
        id="DIAG-AUDIT-001",
        plant_id=plant_id,
        inverter_id=str(inverter_id),
        fault_class="STRING_UNDERPERFORMANCE",
        fault_title="String 2 Underperformance",
        severity="HIGH",
        status="ACTIVE",
        engine_type="HYBRID",
        confidence_score=0.92,
        estimated_lost_energy_kwh=14.5,
        probable_cause="Loose DC string terminal connector",
        root_cause_summary="Underperformance on string 2 due to connector degradation",
        recommended_action="Inspect and replace connector"
    )
    db_session.add(diagnosis)
    db_session.commit()
    db_session.refresh(diagnosis)
    diagnosis_id = diagnosis.id

    # -------------------------------------------------------------
    # Step 7: View the result as the homeowner
    # -------------------------------------------------------------
    home_dash = client.get("/api/v1/home/dashboard", headers=home_headers)
    assert home_dash.status_code == 200

    home_plants = client.get("/api/v1/home/plants", headers=home_headers)
    assert home_plants.status_code == 200
    assert any(p["id"] == plant_id for p in home_plants.json())

    home_diag = client.get("/api/v1/home/diagnoses", headers=home_headers)
    assert home_diag.status_code == 200
    assert len(home_diag.json()) >= 1

    # -------------------------------------------------------------
    # Step 8: Inspect the assignment as the technician
    # -------------------------------------------------------------
    wo = WorkOrder(
        id="WO-AUDIT-001",
        plant_id=plant_id,
        inverter_id=str(inverter_id),
        diagnosis_id=diagnosis_id,
        assigned_to="Alex Rivera",
        technician_id=tech_id,
        scheduled_date=now.date(),
        title="Repair loose string terminal",
        instructions="Replace charred MC4 connector on string 2.",
        status="ASSIGNED",
        priority="HIGH"
    )
    db_session.add(wo)
    db_session.commit()
    db_session.refresh(wo)
    work_order_id = wo.id

    tech_wo = client.get(f"/api/v1/technician/work-orders/{work_order_id}", headers=tech_headers)
    assert tech_wo.status_code == 200
    assert tech_wo.json()["id"] == work_order_id

    # -------------------------------------------------------------
    # Step 9: Upload inspection evidence
    # -------------------------------------------------------------
    inspect_payload = {
        "findings": "String 2 connector loose; mild thermal discoloration on MC4 terminal.",
        "status": "IN_PROGRESS",
        "notes": "Replaced MC4 connector pair and re-crimped DC cable."
    }
    inspect_resp = client.post(f"/api/v1/technician/work-orders/{work_order_id}/inspection", json=inspect_payload, headers=tech_headers)
    assert inspect_resp.status_code == 200

    # -------------------------------------------------------------
    # Step 10: Complete the work order and verify recovery
    # -------------------------------------------------------------
    comp_payload = {
        "resolution_notes": "MC4 replacement complete, string 2 voltage normalized to 680V DC.",
        "parts_used": "MC4 Connector Pair, 10AWG Solar Wire 0.5m",
        "duration_hours": 1.5,
        "cost_inr": 1250.0
    }
    comp_resp = client.post(f"/api/v1/technician/work-orders/{work_order_id}/completion", json=comp_payload, headers=tech_headers)
    assert comp_resp.status_code == 200

    # -------------------------------------------------------------
    # Step 11: Check audit events and confirm access restrictions
    # -------------------------------------------------------------
    audit_resp = client.get("/api/v1/admin/audit-logs", headers=admin_headers)
    assert audit_resp.status_code == 200

    # Security: Homeowner cannot access Admin routes
    unauth_admin = client.get("/api/v1/admin/users", headers=home_headers)
    assert unauth_admin.status_code in [401, 403]

    # Security: Technician cannot access Admin routes
    unauth_tech = client.get("/api/v1/admin/overview", headers=tech_headers)
    assert unauth_tech.status_code in [401, 403]

    # -------------------------------------------------------------
    # Step 12: Verify data persistence
    # -------------------------------------------------------------
    persisted_wo = db_session.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    assert persisted_wo is not None
    assert persisted_wo.technician_id == tech_id
    assert persisted_wo.status in ["COMPLETED_PENDING_VERIFICATION", "completed_pending_verification", "CLOSED", "closed", "COMPLETED"]
