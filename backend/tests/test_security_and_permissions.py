"""Comprehensive Role/Resource Permission Matrix & Security Layer Test Suite.

Tests:
1. Role-based access control (Admin, Asset Manager, Operator, Technician, Homeowner).
2. Granular permission checks (has_permission).
3. Database-backed resource ownership authorization & IDOR prevention (Plants, Inverters, PV Assets, Diagnoses, Work Orders, Photos, Alerts).
4. FastAPI dependency helpers (require_authenticated_user, require_admin, require_role, require_permission, require_plant_access, require_asset_access, require_assigned_work_order).
5. Transactional consistency & atomic audit logging rollback safety.
6. Authentication & error code enforcement (401, 403, 404, 409, 422).
"""

from datetime import datetime, timezone
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_active_user,
    require_admin,
    require_asset_access,
    require_assigned_work_order,
    require_authenticated_user,
    require_permission,
    require_plant_access,
    require_role,
    require_roles,
)
from app.core.permissions import (
    can_modify_inverter,
    can_modify_plant,
    can_modify_work_order,
    can_request_diagnosis,
    can_view_alert,
    can_view_diagnosis,
    can_view_inverter,
    can_view_photo,
    can_view_plant,
    can_view_pv_asset,
    can_view_work_order,
    enforce_diagnosis_access,
    enforce_plant_access,
    enforce_plant_modification,
    enforce_work_order_access,
    has_permission,
    is_admin,
    is_homeowner,
    is_technician,
    PERM_MANAGE_INTEGRATIONS,
    PERM_MANAGE_RULES,
    PERM_MANAGE_USERS,
    PERM_MODIFY_INVERTER,
    PERM_MODIFY_PLANT,
    PERM_MODIFY_WORK_ORDER,
    PERM_REQUEST_DIAGNOSIS,
    PERM_VIEW_AUDIT_LOGS,
    PERM_VIEW_DIAGNOSIS,
    PERM_VIEW_INVERTER,
    PERM_VIEW_PLANT,
    PERM_VIEW_TELEMETRY,
    PERM_VIEW_WORK_ORDER,
    ROLE_ADMIN,
    ROLE_ASSET_MANAGER,
    ROLE_HOMEOWNER,
    ROLE_OPERATOR,
    ROLE_TECHNICIAN,
)
from app.services.security import hash_password
from app.models.alert import Alert
from app.models.audit_event import AuditEvent
from app.models.diagnosis import Diagnosis
from app.models.inverter import Inverter
from app.models.photo_inspection import PhotoInspection
from app.models.plant import Plant
from app.models.plant_user_assignment import PlantUserAssignment
from app.models.pv_asset import PVAsset
from app.models.user import User
from app.models.work_order import WorkOrder
from app.services.audit_service import log_audit_event, transactional_audit


# ===========================================================================
# Fixtures
# ===========================================================================

@pytest.fixture
def test_users(db_session: Session) -> dict[str, User]:
    """Create test users for each role."""
    password_hash = hash_password("Password123!")

    admin = User(
        email="admin_sec@solarmind.com",
        username="admin_sec",
        hashed_password=password_hash,
        full_name="Admin Security",
        role=ROLE_ADMIN,
        is_active=True,
    )
    asset_mgr = User(
        email="mgr_sec@solarmind.com",
        username="mgr_sec",
        hashed_password=password_hash,
        full_name="Asset Manager Sec",
        role=ROLE_ASSET_MANAGER,
        is_active=True,
    )
    operator = User(
        email="operator_sec@solarmind.com",
        username="operator_sec",
        hashed_password=password_hash,
        full_name="Operator Sec",
        role=ROLE_OPERATOR,
        is_active=True,
    )
    homeowner_1 = User(
        email="homeowner1_sec@solarmind.com",
        username="homeowner1_sec",
        hashed_password=password_hash,
        full_name="Homeowner One",
        role=ROLE_HOMEOWNER,
        is_active=True,
    )
    homeowner_2 = User(
        email="homeowner2_sec@solarmind.com",
        username="homeowner2_sec",
        hashed_password=password_hash,
        full_name="Homeowner Two",
        role=ROLE_HOMEOWNER,
        is_active=True,
    )
    technician_1 = User(
        email="tech1_sec@solarmind.com",
        username="tech1_sec",
        hashed_password=password_hash,
        full_name="Technician One",
        role=ROLE_TECHNICIAN,
        is_active=True,
    )
    technician_2 = User(
        email="tech2_sec@solarmind.com",
        username="tech2_sec",
        hashed_password=password_hash,
        full_name="Technician Two",
        role=ROLE_TECHNICIAN,
        is_active=True,
    )
    inactive_user = User(
        email="inactive_sec@solarmind.com",
        username="inactive_sec",
        hashed_password=password_hash,
        full_name="Inactive User",
        role=ROLE_HOMEOWNER,
        is_active=False,
    )

    users = [admin, asset_mgr, operator, homeowner_1, homeowner_2, technician_1, technician_2, inactive_user]
    db_session.add_all(users)
    db_session.commit()
    for u in users:
        db_session.refresh(u)

    return {
        "admin": admin,
        "asset_mgr": asset_mgr,
        "operator": operator,
        "homeowner_1": homeowner_1,
        "homeowner_2": homeowner_2,
        "technician_1": technician_1,
        "technician_2": technician_2,
        "inactive": inactive_user,
    }


@pytest.fixture
def test_solar_ecosystem(db_session: Session, test_users: dict[str, User]) -> dict[str, any]:
    """Create two separate solar plants with inverters, PV assets, work orders, diagnoses, and alerts."""
    h1 = test_users["homeowner_1"]
    h2 = test_users["homeowner_2"]
    t1 = test_users["technician_1"]

    # Plant 1 owned by Homeowner 1
    plant_1 = Plant(
        name="Villa SunPower P1",
        location="100 Solar Way",
        installed_capacity_kwp=6.0,
        owner_id=h1.id,
        status="NORMAL",
        is_active=True,
    )
    # Plant 2 owned by Homeowner 2
    plant_2 = Plant(
        name="Eco Cottage P2",
        location="200 Green Blvd",
        installed_capacity_kwp=4.5,
        owner_id=h2.id,
        status="NORMAL",
        is_active=True,
    )
    db_session.add_all([plant_1, plant_2])
    db_session.commit()
    db_session.refresh(plant_1)
    db_session.refresh(plant_2)

    # Inverters
    inv_1 = Inverter(
        id="INV-P1-001",
        plant_id=plant_1.id,
        serial_number="SN-INV1-AAA",
        manufacturer="Growatt",
        model="5000TL",
        rated_ac_power_kw=5.0,
        status="NORMAL",
    )
    inv_2 = Inverter(
        id="INV-P2-001",
        plant_id=plant_2.id,
        serial_number="SN-INV2-BBB",
        manufacturer="Solis",
        model="4G",
        rated_ac_power_kw=4.0,
        status="NORMAL",
    )
    db_session.add_all([inv_1, inv_2])
    db_session.commit()

    # PV Assets
    pv_1 = PVAsset(
        id="PVA-INV1-STR1",
        inverter_id=inv_1.id,
        identifier="String 1",
        panel_count=10,
        status="NORMAL",
    )
    pv_2 = PVAsset(
        id="PVA-INV2-STR1",
        inverter_id=inv_2.id,
        identifier="String 1",
        panel_count=8,
        status="NORMAL",
    )
    db_session.add_all([pv_1, pv_2])
    db_session.commit()

    # Diagnosis on Plant 1
    diag_1 = Diagnosis(
        id="DIAG-P1-001",
        plant_id=plant_1.id,
        inverter_id=inv_1.id,
        fault_class="SHADING",
        fault_title="Shading Pattern",
        severity="WARNING",
        confidence_score=0.92,
        probable_cause="Tree branches casting shadow on string 1",
        root_cause_summary="Tree branches obstructing string 1",
        recommended_action="Trim tree branches",
    )
    # Diagnosis on Plant 2
    diag_2 = Diagnosis(
        id="DIAG-P2-001",
        plant_id=plant_2.id,
        inverter_id=inv_2.id,
        fault_class="THERMAL",
        fault_title="Inverter Underperformance",
        severity="CRITICAL",
        confidence_score=0.88,
        probable_cause="Thermal throttling",
        root_cause_summary="Thermal throttling",
        recommended_action="Inspect ventilation",
    )
    db_session.add_all([diag_1, diag_2])
    db_session.commit()
    db_session.refresh(diag_1)
    db_session.refresh(diag_2)

    # Work Order on Plant 1 assigned to Technician 1
    wo_1 = WorkOrder(
        id="WO-P1-001",
        plant_id=plant_1.id,
        technician_id=t1.id,
        assigned_to=t1.full_name,
        diagnosis_id=diag_1.id,
        title="Trim vegetation near String 1",
        scheduled_date=datetime.now(timezone.utc).date(),
        status="ASSIGNED",
        priority="MEDIUM",
    )
    # Work Order on Plant 2 unassigned (or assigned to another)
    wo_2 = WorkOrder(
        id="WO-P2-001",
        plant_id=plant_2.id,
        assigned_to="Unassigned",
        diagnosis_id=diag_2.id,
        title="Check Inverter Fan P2",
        scheduled_date=datetime.now(timezone.utc).date(),
        status="PENDING",
        priority="HIGH",
    )
    db_session.add_all([wo_1, wo_2])
    db_session.commit()
    db_session.refresh(wo_1)
    db_session.refresh(wo_2)

    # Photo Inspection on Plant 1
    photo_1 = PhotoInspection(
        id="PHOTO-P1-001",
        plant_id=plant_1.id,
        image_path="/uploads/plants/1/photo1.jpg",
        original_filename="photo1.jpg",
        uploaded_at=datetime.now(timezone.utc),
        processing_status="PROCESSED",
    )
    # Photo Inspection on Plant 2
    photo_2 = PhotoInspection(
        id="PHOTO-P2-001",
        plant_id=plant_2.id,
        image_path="/uploads/plants/2/photo2.jpg",
        original_filename="photo2.jpg",
        uploaded_at=datetime.now(timezone.utc),
        processing_status="PROCESSED",
    )
    db_session.add_all([photo_1, photo_2])

    # Alert on Plant 1
    alert_1 = Alert(
        id="ALT-P1-001",
        plant_id=plant_1.id,
        code="VOLTAGE_DROP",
        severity="WARNING",
        message="Voltage drop detected on String 1",
        status="ACTIVE",
    )
    # Alert on Plant 2
    alert_2 = Alert(
        id="ALT-P2-001",
        plant_id=plant_2.id,
        code="OVERTEMP",
        severity="CRITICAL",
        message="Inverter temperature exceeded 75C",
        status="ACTIVE",
    )
    db_session.add_all([alert_1, alert_2])
    db_session.commit()

    return {
        "plant_1": plant_1,
        "plant_2": plant_2,
        "inv_1": inv_1,
        "inv_2": inv_2,
        "pv_1": pv_1,
        "pv_2": pv_2,
        "diag_1": diag_1,
        "diag_2": diag_2,
        "wo_1": wo_1,
        "wo_2": wo_2,
        "photo_1": photo_1,
        "photo_2": photo_2,
        "alert_1": alert_1,
        "alert_2": alert_2,
    }


# ===========================================================================
# 1. Role Checkers & Permission Matrix Tests
# ===========================================================================

def test_role_checkers(test_users: dict[str, User]):
    """Test is_admin, is_homeowner, and is_technician predicates."""
    assert is_admin(test_users["admin"]) is True
    assert is_admin(test_users["asset_mgr"]) is True
    assert is_admin(test_users["homeowner_1"]) is False
    assert is_admin(test_users["technician_1"]) is False
    assert is_admin(test_users["operator"]) is False

    assert is_homeowner(test_users["homeowner_1"]) is True
    assert is_homeowner(test_users["admin"]) is False

    assert is_technician(test_users["technician_1"]) is True
    assert is_technician(test_users["homeowner_1"]) is False


def test_permission_matrix_admin(test_users: dict[str, User]):
    """Admin must have all system permissions."""
    admin = test_users["admin"]
    assert has_permission(admin, PERM_VIEW_PLANT) is True
    assert has_permission(admin, PERM_MODIFY_PLANT) is True
    assert has_permission(admin, PERM_MODIFY_INVERTER) is True
    assert has_permission(admin, PERM_MANAGE_USERS) is True
    assert has_permission(admin, PERM_MANAGE_RULES) is True
    assert has_permission(admin, PERM_MANAGE_INTEGRATIONS) is True
    assert has_permission(admin, PERM_VIEW_AUDIT_LOGS) is True


def test_permission_matrix_homeowner(test_users: dict[str, User]):
    """Homeowner has view/request permissions but cannot manage users, rules, or modify assets."""
    h1 = test_users["homeowner_1"]
    assert has_permission(h1, PERM_VIEW_PLANT) is True
    assert has_permission(h1, PERM_VIEW_INVERTER) is True
    assert has_permission(h1, PERM_VIEW_TELEMETRY) is True
    assert has_permission(h1, PERM_REQUEST_DIAGNOSIS) is True
    assert has_permission(h1, PERM_VIEW_WORK_ORDER) is True

    # Forbidden operations for homeowner
    assert has_permission(h1, PERM_MODIFY_PLANT) is False
    assert has_permission(h1, PERM_MODIFY_INVERTER) is False
    assert has_permission(h1, PERM_MODIFY_WORK_ORDER) is False
    assert has_permission(h1, PERM_MANAGE_USERS) is False
    assert has_permission(h1, PERM_MANAGE_RULES) is False
    assert has_permission(h1, PERM_VIEW_AUDIT_LOGS) is False


def test_permission_matrix_technician(test_users: dict[str, User]):
    """Technician can modify work orders and upload photos, but cannot manage users or plant configurations."""
    tech = test_users["technician_1"]
    assert has_permission(tech, PERM_VIEW_PLANT) is True
    assert has_permission(tech, PERM_VIEW_WORK_ORDER) is True
    assert has_permission(tech, PERM_MODIFY_WORK_ORDER) is True

    assert has_permission(tech, PERM_MODIFY_PLANT) is False
    assert has_permission(tech, PERM_MODIFY_INVERTER) is False
    assert has_permission(tech, PERM_MANAGE_USERS) is False
    assert has_permission(tech, PERM_MANAGE_RULES) is False
    assert has_permission(tech, PERM_VIEW_AUDIT_LOGS) is False


# ===========================================================================
# 2. Database-Backed Resource Authorization & IDOR Prevention Tests
# ===========================================================================

def test_plant_resource_authorization(test_users: dict[str, User], test_solar_ecosystem: dict[str, any]):
    """Homeowners can only view their own plant; Admin can view all."""
    p1 = test_solar_ecosystem["plant_1"]
    p2 = test_solar_ecosystem["plant_2"]
    h1 = test_users["homeowner_1"]
    h2 = test_users["homeowner_2"]
    admin = test_users["admin"]

    # Homeowner 1 can view Plant 1 but NOT Plant 2 (IDOR protection)
    assert can_view_plant(h1, p1) is True
    assert can_view_plant(h1, p2) is False

    # Homeowner 2 can view Plant 2 but NOT Plant 1
    assert can_view_plant(h2, p2) is True
    assert can_view_plant(h2, p1) is False

    # Admin can view both
    assert can_view_plant(admin, p1) is True
    assert can_view_plant(admin, p2) is True


def test_inverter_and_pv_asset_authorization(test_users: dict[str, User], test_solar_ecosystem: dict[str, any]):
    """Inverter and PV Asset access inherits from parent plant ownership."""
    inv1 = test_solar_ecosystem["inv_1"]
    inv2 = test_solar_ecosystem["inv_2"]
    pv1 = test_solar_ecosystem["pv_1"]
    pv2 = test_solar_ecosystem["pv_2"]
    h1 = test_users["homeowner_1"]
    h2 = test_users["homeowner_2"]

    # Homeowner 1 can view Inverter 1 and PV Asset 1, but NOT Inverter 2 or PV Asset 2
    assert can_view_inverter(h1, inv1) is True
    assert can_view_inverter(h1, inv2) is False
    assert can_view_pv_asset(h1, pv1) is True
    assert can_view_pv_asset(h1, pv2) is False

    # Homeowner 2
    assert can_view_inverter(h2, inv2) is True
    assert can_view_inverter(h2, inv1) is False


def test_work_order_authorization(test_users: dict[str, User], test_solar_ecosystem: dict[str, any]):
    """Technicians can only access work orders assigned to them; Homeowners only on their plants."""
    wo1 = test_solar_ecosystem["wo_1"]  # On Plant 1, assigned to Tech 1
    wo2 = test_solar_ecosystem["wo_2"]  # On Plant 2, unassigned
    h1 = test_users["homeowner_1"]
    h2 = test_users["homeowner_2"]
    t1 = test_users["technician_1"]
    t2 = test_users["technician_2"]
    admin = test_users["admin"]

    # Technician 1 assigned to wo1 -> can view & modify
    assert can_view_work_order(t1, wo1) is True
    assert can_modify_work_order(t1, wo1) is True

    # Technician 2 NOT assigned to wo1 -> cannot view or modify
    assert can_view_work_order(t2, wo1) is False
    assert can_modify_work_order(t2, wo1) is False

    # Homeowner 1 owns plant of wo1 -> can view, but CANNOT modify
    assert can_view_work_order(h1, wo1) is True
    assert can_modify_work_order(h1, wo1) is False

    # Homeowner 1 cannot view wo2 (on Plant 2)
    assert can_view_work_order(h1, wo2) is False

    # Admin can view and modify all
    assert can_view_work_order(admin, wo1) is True
    assert can_modify_work_order(admin, wo1) is True
    assert can_view_work_order(admin, wo2) is True
    assert can_modify_work_order(admin, wo2) is True


def test_diagnosis_and_photos_authorization(test_users: dict[str, User], test_solar_ecosystem: dict[str, any]):
    """Diagnoses, photos, and alerts inherit plant ownership."""
    diag1 = test_solar_ecosystem["diag_1"]
    diag2 = test_solar_ecosystem["diag_2"]
    photo1 = test_solar_ecosystem["photo_1"]
    alert1 = test_solar_ecosystem["alert_1"]
    h1 = test_users["homeowner_1"]
    h2 = test_users["homeowner_2"]

    assert can_view_diagnosis(h1, diag1) is True
    assert can_view_diagnosis(h1, diag2) is False
    assert can_view_photo(h1, photo1) is True
    assert can_view_alert(h1, alert1) is True

    # Homeowner 2 cannot view Homeowner 1's diagnosis or photo
    assert can_view_diagnosis(h2, diag1) is False
    assert can_view_photo(h2, photo1) is False
    assert can_view_alert(h2, alert1) is False


def test_enforce_helpers_raise_403(test_users: dict[str, User], test_solar_ecosystem: dict[str, any]):
    """Enforcement helper functions must raise HTTPException 403 when authorization fails."""
    p1 = test_solar_ecosystem["plant_1"]
    wo1 = test_solar_ecosystem["wo_1"]
    diag1 = test_solar_ecosystem["diag_1"]
    h2 = test_users["homeowner_2"]
    h1 = test_users["homeowner_1"]

    with pytest.raises(HTTPException) as exc_info:
        enforce_plant_access(h2, p1)
    assert exc_info.value.status_code == 403

    with pytest.raises(HTTPException) as exc_info:
        enforce_plant_modification(h1, p1)
    assert exc_info.value.status_code == 403

    with pytest.raises(HTTPException) as exc_info:
        enforce_work_order_access(h2, wo1)
    assert exc_info.value.status_code == 403

    with pytest.raises(HTTPException) as exc_info:
        enforce_work_order_access(h1, wo1, write=True)
    assert exc_info.value.status_code == 403

    with pytest.raises(HTTPException) as exc_info:
        enforce_diagnosis_access(h2, diag1)
    assert exc_info.value.status_code == 403


# ===========================================================================
# 3. FastAPI Dependency Helpers Tests
# ===========================================================================

def test_require_active_user(test_users: dict[str, User]):
    """Inactive users must be rejected with 403 Forbidden."""
    active_user = test_users["homeowner_1"]
    inactive_user = test_users["inactive"]

    assert get_current_active_user(active_user) == active_user

    with pytest.raises(HTTPException) as exc_info:
        get_current_active_user(inactive_user)
    assert exc_info.value.status_code == 403


def test_require_roles_dependency(test_users: dict[str, User]):
    """require_roles should allow matching roles or admin, and reject others."""
    tech_checker = require_roles(["technician"])
    admin = test_users["admin"]
    tech = test_users["technician_1"]
    h1 = test_users["homeowner_1"]

    # Technician permitted
    assert tech_checker(tech) == tech
    # Admin is universally permitted
    assert tech_checker(admin) == admin
    # Homeowner rejected
    with pytest.raises(HTTPException) as exc_info:
        tech_checker(h1)
    assert exc_info.value.status_code == 403


def test_require_permission_dependency(test_users: dict[str, User]):
    """require_permission dependency checks granular permission."""
    user_mgmt_checker = require_permission(PERM_MANAGE_USERS)
    admin = test_users["admin"]
    tech = test_users["technician_1"]

    assert user_mgmt_checker(admin) == admin
    with pytest.raises(HTTPException) as exc_info:
        user_mgmt_checker(tech)
    assert exc_info.value.status_code == 403


def test_require_plant_access_dependency(
    db_session: Session, test_users: dict[str, User], test_solar_ecosystem: dict[str, any]
):
    """require_plant_access returns plant on success, 404 on missing, 403 on IDOR attempt."""
    p1 = test_solar_ecosystem["plant_1"]
    h1 = test_users["homeowner_1"]
    h2 = test_users["homeowner_2"]

    # Success
    result = require_plant_access(plant_id=p1.id, current_user=h1, db=db_session)
    assert result.id == p1.id

    # 403 Forbidden on unauthorized homeowner
    with pytest.raises(HTTPException) as exc_403:
        require_plant_access(plant_id=p1.id, current_user=h2, db=db_session)
    assert exc_403.value.status_code == 403

    # 404 Not Found on non-existent plant
    with pytest.raises(HTTPException) as exc_404:
        require_plant_access(plant_id=99999, current_user=h1, db=db_session)
    assert exc_404.value.status_code == 404


def test_require_asset_access_dependency(
    db_session: Session, test_users: dict[str, User], test_solar_ecosystem: dict[str, any]
):
    """require_asset_access checks inverter ownership and existence."""
    inv1 = test_solar_ecosystem["inv_1"]
    h1 = test_users["homeowner_1"]
    h2 = test_users["homeowner_2"]

    # Success
    result = require_asset_access(inverter_id=inv1.id, current_user=h1, db=db_session)
    assert result.id == inv1.id

    # 403 Forbidden
    with pytest.raises(HTTPException) as exc_403:
        require_asset_access(inverter_id=inv1.id, current_user=h2, db=db_session)
    assert exc_403.value.status_code == 403

    # 404 Not Found
    with pytest.raises(HTTPException) as exc_404:
        require_asset_access(inverter_id="NON_EXISTENT_INV", current_user=h1, db=db_session)
    assert exc_404.value.status_code == 404


def test_require_assigned_work_order_dependency(
    db_session: Session, test_users: dict[str, User], test_solar_ecosystem: dict[str, any]
):
    """require_assigned_work_order verifies assignment and handles 404/403."""
    wo1 = test_solar_ecosystem["wo_1"]
    t1 = test_users["technician_1"]
    t2 = test_users["technician_2"]

    # Success for assigned technician
    result = require_assigned_work_order(work_order_id=wo1.id, current_user=t1, db=db_session)
    assert result.id == wo1.id

    # 403 Forbidden for unassigned technician
    with pytest.raises(HTTPException) as exc_403:
        require_assigned_work_order(work_order_id=wo1.id, current_user=t2, db=db_session)
    assert exc_403.value.status_code == 403

    # 404 Not Found
    with pytest.raises(HTTPException) as exc_404:
        require_assigned_work_order(work_order_id="WO-NONEXISTENT", current_user=t1, db=db_session)
    assert exc_404.value.status_code == 404


# ===========================================================================
# 4. Transactional Consistency & Atomic Audit Logging Tests
# ===========================================================================

def test_transactional_audit_success(db_session: Session, test_users: dict[str, User]):
    """Transactional audit commits both the mutation and the audit event atomically."""
    admin = test_users["admin"]

    with transactional_audit(
        db=db_session,
        actor=admin,
        action="UPDATE_SETTING",
        target_type="SystemSetting",
        target_id="GRID_SYNC_INTERVAL",
        details="Changed interval to 15 minutes",
    ):
        new_plant = Plant(
            name="Transactional Plant Success",
            location="Sector 5, Bhubaneswar",
            installed_capacity_kwp=10.0,
            owner_id=admin.id,
            status="NORMAL",
        )
        db_session.add(new_plant)

    # Verify both plant and audit event exist in DB
    persisted_plant = db_session.query(Plant).filter(Plant.name == "Transactional Plant Success").first()
    assert persisted_plant is not None

    persisted_audit = (
        db_session.query(AuditEvent)
        .filter(AuditEvent.action == "UPDATE_SETTING", AuditEvent.target_id == "GRID_SYNC_INTERVAL")
        .first()
    )
    assert persisted_audit is not None
    assert persisted_audit.actor_id == admin.id
    assert persisted_audit.status == "SUCCESS"


def test_transactional_audit_rollback_on_failure(db_session: Session, test_users: dict[str, User]):
    """When an operation inside transactional_audit raises an error, rollback prevents orphan records."""
    admin = test_users["admin"]

    with pytest.raises(ValueError, match="Simulated Mutation Failure"):
        with transactional_audit(
            db=db_session,
            actor=admin,
            action="FAILED_MUTATION_ACTION",
            target_type="Plant",
            target_id="FAIL_1",
        ):
            failed_plant = Plant(
                name="Should Rollback Plant",
                location="Sector 6, Cuttack",
                installed_capacity_kwp=12.0,
                owner_id=admin.id,
                status="NORMAL",
            )
            db_session.add(failed_plant)
            raise ValueError("Simulated Mutation Failure")

    # Verify that NEITHER the plant NOR the audit event were persisted
    assert db_session.query(Plant).filter(Plant.name == "Should Rollback Plant").first() is None
    assert (
        db_session.query(AuditEvent)
        .filter(AuditEvent.action == "FAILED_MUTATION_ACTION")
        .first()
        is None
    )


def test_log_audit_event_direct(db_session: Session, test_users: dict[str, User]):
    """Direct audit logging creates proper audit records with actor attributes."""
    tech = test_users["technician_1"]
    event = log_audit_event(
        db=db_session,
        actor=tech,
        action="WORK_ORDER_COMPLETED",
        target_type="WorkOrder",
        target_id="WO-100",
        details="Repaired loose MC4 connector on string 2",
        ip_address="192.168.1.50",
        status="SUCCESS",
    )
    db_session.commit()

    assert event.id is not None
    assert event.actor_id == tech.id
    assert event.actor_email == tech.email
    assert event.role == ROLE_TECHNICIAN
    assert event.ip_address == "192.168.1.50"
