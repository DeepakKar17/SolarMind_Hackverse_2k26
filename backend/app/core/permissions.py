"""SolarMind Centralized Role-Based & Resource-Level Access Control.

Defines role hierarchies, granular permission constants, permission checks,
and database resource ownership validation to prevent Insecure Direct Object References (IDOR).
"""

from typing import Any, List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.diagnosis import Diagnosis
from app.models.inverter import Inverter
from app.models.photo_inspection import PhotoInspection
from app.models.plant import Plant
from app.models.pv_asset import PVAsset
from app.models.user import User
from app.models.work_order import WorkOrder

# Standard System Roles
ROLE_ADMIN = "admin"
ROLE_HOMEOWNER = "homeowner"
ROLE_TECHNICIAN = "technician"
ROLE_OPERATOR = "operator"
ROLE_ASSET_MANAGER = "asset_manager"

# Granular Permission Constants
PERM_VIEW_PLANT = "plant:view"
PERM_MODIFY_PLANT = "plant:modify"
PERM_VIEW_INVERTER = "inverter:view"
PERM_MODIFY_INVERTER = "inverter:modify"
PERM_VIEW_TELEMETRY = "telemetry:view"
PERM_IMPORT_TELEMETRY = "telemetry:import"
PERM_VIEW_DIAGNOSIS = "diagnosis:view"
PERM_REQUEST_DIAGNOSIS = "diagnosis:request"
PERM_VIEW_WORK_ORDER = "work_order:view"
PERM_MODIFY_WORK_ORDER = "work_order:modify"
PERM_CREATE_WORK_ORDER = "work_order:create"
PERM_VIEW_PHOTO = "photo:view"
PERM_UPLOAD_PHOTO = "photo:upload"
PERM_VIEW_ALERT = "alert:view"
PERM_RESOLVE_ALERT = "alert:resolve"
PERM_MANAGE_USERS = "admin:manage_users"
PERM_MANAGE_RULES = "admin:manage_rules"
PERM_MANAGE_INTEGRATIONS = "admin:manage_integrations"
PERM_VIEW_AUDIT_LOGS = "admin:view_audit_logs"

# Role to Permissions Mapping Matrix
ROLE_PERMISSIONS: dict[str, Set[str]] = {
    ROLE_ADMIN: {
        PERM_VIEW_PLANT,
        PERM_MODIFY_PLANT,
        PERM_VIEW_INVERTER,
        PERM_MODIFY_INVERTER,
        PERM_VIEW_TELEMETRY,
        PERM_IMPORT_TELEMETRY,
        PERM_VIEW_DIAGNOSIS,
        PERM_REQUEST_DIAGNOSIS,
        PERM_VIEW_WORK_ORDER,
        PERM_MODIFY_WORK_ORDER,
        PERM_CREATE_WORK_ORDER,
        PERM_VIEW_PHOTO,
        PERM_UPLOAD_PHOTO,
        PERM_VIEW_ALERT,
        PERM_RESOLVE_ALERT,
        PERM_MANAGE_USERS,
        PERM_MANAGE_RULES,
        PERM_MANAGE_INTEGRATIONS,
        PERM_VIEW_AUDIT_LOGS,
    },
    ROLE_ASSET_MANAGER: {
        PERM_VIEW_PLANT,
        PERM_MODIFY_PLANT,
        PERM_VIEW_INVERTER,
        PERM_MODIFY_INVERTER,
        PERM_VIEW_TELEMETRY,
        PERM_IMPORT_TELEMETRY,
        PERM_VIEW_DIAGNOSIS,
        PERM_REQUEST_DIAGNOSIS,
        PERM_VIEW_WORK_ORDER,
        PERM_MODIFY_WORK_ORDER,
        PERM_CREATE_WORK_ORDER,
        PERM_VIEW_PHOTO,
        PERM_UPLOAD_PHOTO,
        PERM_VIEW_ALERT,
        PERM_RESOLVE_ALERT,
        PERM_VIEW_AUDIT_LOGS,
    },
    ROLE_OPERATOR: {
        PERM_VIEW_PLANT,
        PERM_VIEW_INVERTER,
        PERM_VIEW_TELEMETRY,
        PERM_IMPORT_TELEMETRY,
        PERM_VIEW_DIAGNOSIS,
        PERM_REQUEST_DIAGNOSIS,
        PERM_VIEW_WORK_ORDER,
        PERM_CREATE_WORK_ORDER,
        PERM_VIEW_PHOTO,
        PERM_UPLOAD_PHOTO,
        PERM_VIEW_ALERT,
        PERM_RESOLVE_ALERT,
    },
    ROLE_TECHNICIAN: {
        PERM_VIEW_PLANT,
        PERM_VIEW_INVERTER,
        PERM_VIEW_TELEMETRY,
        PERM_VIEW_DIAGNOSIS,
        PERM_VIEW_WORK_ORDER,
        PERM_MODIFY_WORK_ORDER,
        PERM_VIEW_PHOTO,
        PERM_UPLOAD_PHOTO,
        PERM_VIEW_ALERT,
    },
    ROLE_HOMEOWNER: {
        PERM_VIEW_PLANT,
        PERM_VIEW_INVERTER,
        PERM_VIEW_TELEMETRY,
        PERM_VIEW_DIAGNOSIS,
        PERM_REQUEST_DIAGNOSIS,
        PERM_VIEW_WORK_ORDER,
        PERM_VIEW_PHOTO,
        PERM_UPLOAD_PHOTO,
        PERM_VIEW_ALERT,
    },
}


def is_admin(user: User) -> bool:
    """Check if user has full administrative privileges."""
    return (user.role or "").lower() in (ROLE_ADMIN, ROLE_ASSET_MANAGER)


def is_homeowner(user: User) -> bool:
    """Check if user has homeowner role."""
    return (user.role or "").lower() == ROLE_HOMEOWNER


def is_technician(user: User) -> bool:
    """Check if user has technician role."""
    return (user.role or "").lower() == ROLE_TECHNICIAN


def has_permission(user: User, permission: str) -> bool:
    """Evaluate whether user role possesses the requested permission."""
    role = (user.role or "").lower()
    perms = ROLE_PERMISSIONS.get(role, set())
    return permission in perms


# ---------------------------------------------------------------------------
# Resource Access Control Evaluators (Database-Backed)
# ---------------------------------------------------------------------------

def can_view_plant(user: User, plant: Plant) -> bool:
    """Evaluate whether user is authorized to view a specific plant."""
    if is_admin(user) or (user.role or "").lower() == ROLE_OPERATOR:
        return True
    if is_homeowner(user):
        # Homeowner can ONLY view plants they own or are assigned to
        if plant.owner_id == user.id:
            return True
        # Check explicit multi-tenant assignments if loaded
        if hasattr(plant, "user_assignments") and plant.user_assignments:
            if any(a.user_id == user.id for a in plant.user_assignments):
                return True
        return False
    if is_technician(user):
        # Technician can view plants where they have assigned work orders or assignments
        if hasattr(plant, "user_assignments") and plant.user_assignments:
            if any(a.user_id == user.id for a in plant.user_assignments):
                return True
        if any(
            wo.technician_id == user.id
            or (wo.assigned_to and wo.assigned_to.lower() in (user.full_name.lower(), (user.username or "").lower(), user.email.lower()))
            for wo in (plant.work_orders or [])
        ):
            return True
        return False
    return False


def can_modify_plant(user: User, plant: Optional[Plant] = None) -> bool:
    """Only administrators may create, modify, or delete plant configurations."""
    return is_admin(user)


def can_view_inverter(user: User, inverter: Inverter) -> bool:
    """Inverter access inherits from the parent plant ownership."""
    if not inverter.plant:
        return is_admin(user)
    return can_view_plant(user, inverter.plant)


def can_modify_inverter(user: User, inverter: Optional[Inverter] = None) -> bool:
    """Only administrators may register or update inverters."""
    return is_admin(user)


def can_view_pv_asset(user: User, pv_asset: PVAsset) -> bool:
    """PV Asset access inherits from inverter and parent plant."""
    if not pv_asset.inverter or not pv_asset.inverter.plant:
        return is_admin(user)
    return can_view_plant(user, pv_asset.inverter.plant)


def can_view_work_order(user: User, work_order: WorkOrder) -> bool:
    """Evaluate if user can view a work order."""
    if is_admin(user) or (user.role or "").lower() == ROLE_OPERATOR:
        return True
    if is_homeowner(user):
        # Homeowners can view work orders on their own plants
        return bool(work_order.plant and work_order.plant.owner_id == user.id)
    if is_technician(user):
        # Technicians can ONLY view work orders assigned to them
        if work_order.technician_id == user.id:
            return True
        assigned = (work_order.assigned_to or "").lower()
        if assigned and assigned in (user.full_name.lower(), (user.username or "").lower(), user.email.lower()):
            return True
        return False
    return False


def can_modify_work_order(user: User, work_order: WorkOrder) -> bool:
    """Evaluate if user can update work order notes, duration, or lifecycle status."""
    if is_admin(user):
        return True
    if is_technician(user):
        # Assigned technician can record actions and advance status
        return can_view_work_order(user, work_order)
    # Homeowners CANNOT modify technician work orders
    return False


def can_view_diagnosis(user: User, diagnosis: Diagnosis) -> bool:
    """Evaluate if user can view fault diagnosis dossier."""
    if is_admin(user) or (user.role or "").lower() == ROLE_OPERATOR:
        return True
    if is_homeowner(user):
        return bool(diagnosis.plant and diagnosis.plant.owner_id == user.id)
    if is_technician(user):
        if diagnosis.plant:
            return can_view_plant(user, diagnosis.plant)
        return False
    return False


def can_request_diagnosis(user: User, plant: Plant) -> bool:
    """Evaluate if user can trigger an AI diagnosis analysis run."""
    if is_admin(user) or (user.role or "").lower() == ROLE_OPERATOR:
        return True
    if is_homeowner(user):
        return plant.owner_id == user.id
    return False


def can_view_photo(user: User, photo: PhotoInspection) -> bool:
    """Evaluate if user can view an inspection photo."""
    if is_admin(user) or (user.role or "").lower() == ROLE_OPERATOR:
        return True
    if photo.plant:
        return can_view_plant(user, photo.plant)
    return False


def can_view_alert(user: User, alert: Alert) -> bool:
    """Evaluate if user can view system alert."""
    if is_admin(user) or (user.role or "").lower() == ROLE_OPERATOR:
        return True
    if is_homeowner(user):
        return bool(alert.plant and alert.plant.owner_id == user.id)
    if is_technician(user):
        return bool(alert.plant and can_view_plant(user, alert.plant))
    return False


# ---------------------------------------------------------------------------
# Strict Enforcement Helper Functions
# ---------------------------------------------------------------------------

def enforce_plant_access(user: User, plant: Plant) -> None:
    """Raise HTTP 403 Forbidden if user lacks view permission on the plant."""
    if not can_view_plant(user, plant):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You do not have permission to access solar plant #{plant.id}.",
        )


def enforce_plant_modification(user: User, plant: Optional[Plant] = None) -> None:
    """Raise HTTP 403 Forbidden if user lacks plant modification permissions."""
    if not can_modify_plant(user, plant):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only administrators can create or modify solar plant configurations.",
        )


def enforce_work_order_access(user: User, work_order: WorkOrder, write: bool = False) -> None:
    """Raise HTTP 403 Forbidden if user cannot view or update work order."""
    if write:
        if not can_modify_work_order(user, work_order):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You do not have permission to modify work order '{work_order.id}'.",
            )
    else:
        if not can_view_work_order(user, work_order):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You do not have permission to view work order '{work_order.id}'.",
            )


def enforce_diagnosis_access(user: User, diagnosis: Diagnosis) -> None:
    """Raise HTTP 403 Forbidden if user cannot access diagnosis."""
    if not can_view_diagnosis(user, diagnosis):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You do not have permission to access diagnosis '{diagnosis.id}'.",
        )
