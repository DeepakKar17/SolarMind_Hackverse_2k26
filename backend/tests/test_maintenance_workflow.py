"""Unit & Integration Tests for SolarMind Full Maintenance Workflow & Recovery Verification."""

from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import engine
from app.main import app
from app.models.diagnosis import Diagnosis
from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.plant_user_assignment import PlantUserAssignment
from app.models.telemetry import Telemetry
from app.models.user import User
from app.models.work_order import WorkOrder
from app.models.work_order_status_history import WorkOrderStatusHistory
from app.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderInspectionSubmit,
    WorkOrderUpdate,
    WorkOrderVerificationRequest,
)
from app.services.security import hash_password
from app.services.work_order_service import work_order_service



@pytest.fixture(autouse=True)
def setup_database():
    """Ensure clean database schema for each test."""
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
def maintenance_setup(db_session: Session):
    """Seed test plant, inverter, diagnosis, admin, technician, and homeowner."""
    plant = Plant(
        id=1,
        name="Maintenance Test Plant",
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
        id="INV-MAINT-01",
        plant_id=1,
        serial_number="SN-MAINT-01",
        manufacturer="Deye",
        model="SUN-10K-G05",
        rated_ac_power_kw=10.0,
        status="WARNING",
    )
    diagnosis = Diagnosis(
        id="DIAG-MAINT-01",
        plant_id=1,
        inverter_id="INV-MAINT-01",
        fault_class="STRING_DISCONNECTION",
        fault_title="DC String Fuse Open Circuit",
        severity="HIGH",
        status="ACTIVE",
        probable_cause="Blown DC string fuse in combiner box.",
        root_cause_summary="String 1 current is zero while open-circuit voltage is present.",
    )

    # Users
    admin_user = User(
        id=1,
        email="admin@solarmind.ai",
        full_name="System Administrator",
        hashed_password=hash_password("AdminSecurePass123!"),
        role="ADMIN",
        is_active=True,
    )
    tech_user = User(
        id=2,
        email="tech.ramesh@solarmind.ai",
        full_name="Ramesh Kumar",
        hashed_password=hash_password("TechSecurePass123!"),
        role="TECHNICIAN",
        is_active=True,
    )
    home_user = User(
        id=3,
        email="homeowner.debashis@gmail.com",
        full_name="Debashis Mohanty",
        hashed_password=hash_password("HomeSecurePass123!"),
        role="HOMEOWNER",
        is_active=True,
    )


    db_session.add_all([plant, inverter, diagnosis, admin_user, tech_user, home_user])
    db_session.commit()

    # Assign plant to homeowner
    assignment = PlantUserAssignment(
        plant_id=1,
        user_id=3,
        role="homeowner",
    )
    db_session.add(assignment)
    db_session.commit()

    return plant, inverter, diagnosis, admin_user, tech_user, home_user


# =============================================================================
# 1. WORK ORDER CREATION & VALIDATION TESTS
# =============================================================================

def test_create_work_order_from_diagnosis(db_session: Session, maintenance_setup):
    """Test creating a work order from an active fault diagnosis."""
    plant, inverter, diagnosis, admin_user, tech_user, _ = maintenance_setup

    create_in = WorkOrderCreate(
        id="WO-TEST-101",
        plant_id=plant.id,
        inverter_id=inverter.id,
        diagnosis_id=diagnosis.id,
        title="Repair DC String 1 Open Circuit",
        priority="HIGH",
        assigned_to="tech.ramesh@solarmind.ai",
        scheduled_date=date.today(),
        due_date=date.today() + timedelta(days=2),
        instructions="Inspect combiner box fuse, replace blown fuse, and verify Voc/Isc.",
    )
    wo = work_order_service.create_work_order(db_session, create_in, current_user=admin_user)

    assert wo.id == "WO-TEST-101"
    assert wo.status == "OPEN"
    assert wo.verification_status == "PENDING"
    assert wo.checklist is not None and len(wo.checklist) >= 4

    # Diagnosis should have transitioned to INVESTIGATING
    db_session.refresh(diagnosis)
    assert diagnosis.status == "INVESTIGATING"

    # Status history audit entry
    history = work_order_service.get_status_history(db_session, wo.id)
    assert len(history) == 1
    assert history[0].to_status == "OPEN"
    assert history[0].changed_by_email == admin_user.email


def test_work_order_invalid_due_date_validation(db_session: Session, maintenance_setup):
    """Verify that due_date earlier than scheduled_date raises HTTP 400."""
    plant, inverter, _, _, _, _ = maintenance_setup

    create_in = WorkOrderCreate(
        id="WO-BAD-DATE",
        plant_id=plant.id,
        inverter_id=inverter.id,
        title="Invalid Date Work Order",
        priority="MEDIUM",
        assigned_to="tech.ramesh@solarmind.ai",
        scheduled_date=date.today() + timedelta(days=5),
        due_date=date.today() + timedelta(days=1),  # Invalid: due before scheduled
    )
    with pytest.raises(Exception) as exc_info:
        work_order_service.create_work_order(db_session, create_in)
    assert "cannot be earlier than scheduled_date" in str(exc_info.value)


# =============================================================================
# 2. STATE MACHINE & INVALID TRANSITIONS
# =============================================================================

def test_state_machine_valid_and_invalid_transitions(db_session: Session, maintenance_setup):
    """Test state machine progression and enforcement of illegal transition rules."""
    plant, inverter, _, admin_user, _, _ = maintenance_setup

    create_in = WorkOrderCreate(
        id="WO-STATE-01",
        plant_id=plant.id,
        inverter_id=inverter.id,
        title="State Machine Test Order",
        priority="HIGH",
        assigned_to="tech.ramesh@solarmind.ai",
        scheduled_date=date.today(),
    )
    wo = work_order_service.create_work_order(db_session, create_in, current_user=admin_user)
    assert wo.status == "OPEN"

    # Valid: OPEN -> ASSIGNED
    wo = work_order_service.update_work_order(
        db_session,
        wo.id,
        WorkOrderUpdate(status="ASSIGNED"),
        current_user=admin_user,
    )
    assert wo.status == "ASSIGNED"

    # Valid: ASSIGNED -> IN_PROGRESS
    wo = work_order_service.update_work_order(
        db_session,
        wo.id,
        WorkOrderUpdate(status="IN_PROGRESS"),
        current_user=admin_user,
    )
    assert wo.status == "IN_PROGRESS"

    # Illegal: IN_PROGRESS -> CLOSED directly without verification
    with pytest.raises(Exception) as exc_info:
        work_order_service.update_work_order(
            db_session,
            wo.id,
            WorkOrderUpdate(status="CLOSED"),
            current_user=admin_user,
        )
    assert "Cannot transition work order" in str(exc_info.value)


# =============================================================================
# 3. TECHNICIAN WORKFLOW & FIELD SUBMISSION
# =============================================================================

def test_technician_inspection_and_completion_submission(db_session: Session, maintenance_setup):
    """Test technician submitting on-site checklist, photos, and parts replaced."""
    plant, inverter, diagnosis, admin_user, tech_user, _ = maintenance_setup

    create_in = WorkOrderCreate(
        id="WO-TECH-SUBMIT",
        plant_id=plant.id,
        inverter_id=inverter.id,
        diagnosis_id=diagnosis.id,
        title="Inverter Heatsink & Fuse Maintenance",
        priority="HIGH",
        assigned_to="tech.ramesh@solarmind.ai",
        scheduled_date=date.today(),
    )
    wo = work_order_service.create_work_order(db_session, create_in, current_user=admin_user)

    # Technician starts work
    wo = work_order_service.update_work_order(
        db_session,
        wo.id,
        WorkOrderUpdate(status="IN_PROGRESS"),
        current_user=tech_user,
    )
    assert wo.status == "IN_PROGRESS"

    # Technician completes inspection & repair
    checklist = [
        {"item": "Inspect MC4 connectors", "checked": True, "notes": "No corrosion"},
        {"item": "Replace blown 15A gPV DC fuse", "checked": True, "notes": "Replaced with Littelfuse 15A 1000V DC"},
        {"item": "Verify Voc", "checked": True, "notes": "Measured 384.2 V"},
    ]
    submit_in = WorkOrderInspectionSubmit(
        checklist=checklist,
        fault_observations="String 1 fuse in DC combiner was blown due to lightning induced surge.",
        repair_action="Replaced blown gPV fuse, cleaned dust filters on inverter cooling fan.",
        parts_replaced=["15A 1000V DC gPV Fuse (10x38mm)"],
        before_photo_id="PHOTO-BEFORE-001",
        after_photo_id="PHOTO-AFTER-001",
        duration_hours=1.5,
        cost_inr=450.0,
        requires_follow_up=False,
        resolution_notes="System successfully synchronized with grid. Both strings generating normal current.",
        mark_completed=True,
    )
    updated_wo = work_order_service.submit_technician_inspection(
        db_session,
        wo.id,
        submit_in,
        current_user=tech_user,
    )

    assert updated_wo.status == "COMPLETED_PENDING_VERIFICATION"
    assert updated_wo.duration_hours == 1.5
    assert updated_wo.cost_inr == 450.0
    assert updated_wo.parts_replaced == ["15A 1000V DC gPV Fuse (10x38mm)"]
    assert updated_wo.before_photo_id == "PHOTO-BEFORE-001"
    assert updated_wo.after_photo_id == "PHOTO-AFTER-001"


# =============================================================================
# 4. POST-REPAIR RECOVERY VERIFICATION ENGINE
# =============================================================================

def test_recovery_verification_full_recovery(db_session: Session, maintenance_setup):
    """Test post-repair verification confirming VERIFIED_FULL_RECOVERY (>90% of expected)."""
    plant, inverter, diagnosis, admin_user, tech_user, _ = maintenance_setup
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    # 1. Create and submit work order
    wo = work_order_service.create_work_order(
        db_session,
        WorkOrderCreate(
            id="WO-VERIFY-FULL",
            plant_id=plant.id,
            inverter_id=inverter.id,
            diagnosis_id=diagnosis.id,
            title="Fuse Replacement Verification Test",
            assigned_to="tech.ramesh@solarmind.ai",
            scheduled_date=date.today(),
        ),
        current_user=admin_user,
    )
    work_order_service.update_work_order(db_session, wo.id, WorkOrderUpdate(status="IN_PROGRESS"))
    work_order_service.submit_technician_inspection(
        db_session,
        wo.id,
        WorkOrderInspectionSubmit(mark_completed=True),
    )

    # 2. Seed Pre-Repair Telemetry (Deficit: only 2.0 kW)
    pre_time = noon_time - timedelta(hours=5)
    for m in range(0, 60, 15):
        t_pre = Telemetry(
            inverter_id=inverter.id,
            timestamp=pre_time + timedelta(minutes=m),
            p_ac=2.0,
            v_dc=370.0,
            i_dc=5.4,
            v_ac=230.0,
            poa_irradiance_wm2=850.0,
            temperature_c=40.0,
            data_quality_flag="VALID",
        )
        db_session.add(t_pre)

    # 3. Seed Post-Repair Telemetry (Restored: 8.8 kW under 850 W/m² irradiance)
    post_time = datetime.now(timezone.utc) - timedelta(hours=2)
    # Ensure post-repair timestamps have solar elevation by using solar noon representation
    for m in range(0, 60, 15):
        t_post = Telemetry(
            inverter_id=inverter.id,
            timestamp=noon_time + timedelta(minutes=m),
            p_ac=9.5,
            v_dc=370.0,
            i_dc=25.6,
            v_ac=230.0,
            poa_irradiance_wm2=850.0,
            temperature_c=40.0,
            data_quality_flag="VALID",
        )
        db_session.add(t_post)
    db_session.commit()

    # Verify recovery using lookback window enclosing the noon timestamps
    req = WorkOrderVerificationRequest(
        verification_window_hours=4,
        reference_time=noon_time + timedelta(hours=1),
        auto_close_on_success=True,
    )
    res = work_order_service.verify_recovery(db_session, wo.id, req, current_user=admin_user)

    assert res.verification_status == "VERIFIED_FULL_RECOVERY"
    assert res.is_verified is True
    assert res.recovery_ratio_pct >= 90.0

    # Linked diagnosis should now be RESOLVED
    db_session.refresh(diagnosis)
    assert diagnosis.status == "RESOLVED"
    assert diagnosis.resolved_at is not None


def test_recovery_verification_insufficient_data(db_session: Session, maintenance_setup):
    """Test post-repair verification reporting INSUFFICIENT_DATA when telemetry is missing or night."""
    plant, inverter, _, admin_user, _, _ = maintenance_setup

    wo = work_order_service.create_work_order(
        db_session,
        WorkOrderCreate(
            id="WO-INSUFFICIENT-DATA",
            plant_id=plant.id,
            inverter_id=inverter.id,
            title="Night Repair Verification Test",
            assigned_to="tech.ramesh@solarmind.ai",
            scheduled_date=date.today(),
        ),
        current_user=admin_user,
    )
    work_order_service.update_work_order(db_session, wo.id, WorkOrderUpdate(status="IN_PROGRESS"))
    work_order_service.submit_technician_inspection(
        db_session,
        wo.id,
        WorkOrderInspectionSubmit(mark_completed=True),
    )

    # No daylight telemetry seeded in post-repair window
    req = WorkOrderVerificationRequest(verification_window_hours=4)
    res = work_order_service.verify_recovery(db_session, wo.id, req, current_user=admin_user)

    assert res.verification_status == "INSUFFICIENT_DATA"
    assert res.is_verified is False
    assert "Insufficient daylight telemetry" in res.summary


def test_recovery_verification_inconclusive_result(db_session: Session, maintenance_setup):
    """Test post-repair verification reporting INCONCLUSIVE when generation remains severely depressed."""
    plant, inverter, _, admin_user, _, _ = maintenance_setup
    noon_time = datetime(2026, 3, 21, 6, 30, 0, tzinfo=timezone.utc)

    wo = work_order_service.create_work_order(
        db_session,
        WorkOrderCreate(
            id="WO-INCONCLUSIVE",
            plant_id=plant.id,
            inverter_id=inverter.id,
            title="Inconclusive Repair Test",
            assigned_to="tech.ramesh@solarmind.ai",
            scheduled_date=date.today(),
        ),
        current_user=admin_user,
    )
    work_order_service.update_work_order(db_session, wo.id, WorkOrderUpdate(status="IN_PROGRESS"))
    work_order_service.submit_technician_inspection(
        db_session,
        wo.id,
        WorkOrderInspectionSubmit(mark_completed=True),
    )

    # Seed post-repair telemetry with continued low power (1.2 kW at 850 W/m²)
    for m in range(0, 60, 15):
        t = Telemetry(
            inverter_id=inverter.id,
            timestamp=noon_time + timedelta(minutes=m),
            p_ac=1.2,
            v_dc=370.0,
            i_dc=3.2,
            v_ac=230.0,
            poa_irradiance_wm2=850.0,
            temperature_c=35.0,
            data_quality_flag="VALID",
        )
        db_session.add(t)
    db_session.commit()

    req = WorkOrderVerificationRequest(
        verification_window_hours=4,
        reference_time=noon_time + timedelta(hours=1),
    )
    res = work_order_service.verify_recovery(db_session, wo.id, req, current_user=admin_user)

    assert res.verification_status == "INCONCLUSIVE"
    assert res.is_verified is False
    assert "Inconclusive recovery" in res.summary


# =============================================================================
# 5. REST API ENDPOINT INTEGRATION TESTS
# =============================================================================

def test_api_work_order_full_lifecycle(client: TestClient, db_session: Session, maintenance_setup):
    """Test REST API endpoints for the complete work order and verification lifecycle."""
    plant, inverter, diagnosis, _, _, _ = maintenance_setup

    # 1. POST /work-orders
    create_payload = {
        "id": "WO-API-FLOW",
        "plant_id": plant.id,
        "inverter_id": inverter.id,
        "diagnosis_id": diagnosis.id,
        "title": "API Lifecycle Flow Work Order",
        "priority": "HIGH",
        "assigned_to": "tech.ramesh@solarmind.ai",
        "scheduled_date": date.today().isoformat(),
        "due_date": (date.today() + timedelta(days=2)).isoformat(),
    }
    res_create = client.post("/api/v1/work-orders", json=create_payload)
    assert res_create.status_code == 201
    assert res_create.json()["status"] == "OPEN"

    # 2. PATCH /work-orders/{id} -> ASSIGNED -> IN_PROGRESS
    res_assign = client.patch("/api/v1/work-orders/WO-API-FLOW", json={"status": "ASSIGNED"})
    assert res_assign.status_code == 200
    assert res_assign.json()["status"] == "ASSIGNED"

    res_progress = client.patch("/api/v1/work-orders/WO-API-FLOW", json={"status": "IN_PROGRESS"})
    assert res_progress.status_code == 200
    assert res_progress.json()["status"] == "IN_PROGRESS"

    # 3. POST /work-orders/{id}/inspection
    insp_payload = {
        "checklist": [{"item": "Inspect Wiring", "checked": True, "notes": "All tight"}],
        "fault_observations": "Loose MC4 connector on string 1.",
        "repair_action": "Crimped new MC4 connector.",
        "parts_replaced": ["MC4 Male/Female Pair"],
        "duration_hours": 1.0,
        "cost_inr": 200.0,
        "mark_completed": True,
    }
    res_insp = client.post("/api/v1/work-orders/WO-API-FLOW/inspection", json=insp_payload)
    assert res_insp.status_code == 200
    assert res_insp.json()["status"] == "COMPLETED_PENDING_VERIFICATION"

    # 4. GET /work-orders/{id}/history
    res_hist = client.get("/api/v1/work-orders/WO-API-FLOW/history")
    assert res_hist.status_code == 200
    history = res_hist.json()
    assert len(history) >= 3
    assert history[-1]["to_status"] == "COMPLETED_PENDING_VERIFICATION"

    # 5. POST /work-orders/{id}/verify
    res_verify = client.post("/api/v1/work-orders/WO-API-FLOW/verify", json={"verification_window_hours": 4})
    assert res_verify.status_code == 200
    assert "verification_status" in res_verify.json()
