"""FastAPI Authentication, Security & Authorization Dependencies.

Provides current-user resolution, session validation, role-based authorization guards,
and database-backed resource ownership verification preventing Insecure Direct Object References (IDOR).
"""

from typing import Callable, List, Optional, Union
from fastapi import Cookie, Depends, Header, HTTPException, Path, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import (
    can_view_diagnosis,
    can_view_inverter,
    can_view_plant,
    can_view_pv_asset,
    can_view_work_order,
    has_permission,
    is_admin,
    ROLE_ADMIN,
    ROLE_HOMEOWNER,
    ROLE_OPERATOR,
    ROLE_TECHNICIAN,
)
from app.db.session import get_db
from app.models.diagnosis import Diagnosis
from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.pv_asset import PVAsset
from app.models.user import User
from app.models.work_order import WorkOrder
from app.services.auth_service import auth_service


def extract_token(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    cookie_token: Optional[str] = Cookie(None, alias=settings.SESSION_COOKIE_NAME),
) -> Optional[str]:
    """Extract token from either Authorization Bearer header or HttpOnly session cookie."""
    # 1. Check Bearer Authorization header first
    if authorization and authorization.lower().startswith("bearer "):
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[1].strip():
            return parts[1].strip()

    # 2. Check HttpOnly cookie
    if cookie_token:
        return cookie_token.strip()

    return None


def get_current_user(
    token: Optional[str] = Depends(extract_token),
    db: Session = Depends(get_db),
) -> User:
    """Validate active session or bearer token and return the authenticated User entity.

    Raises:
        HTTPException (401): If no token provided, expired, revoked, or user inactive.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid session cookie or bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = auth_service.validate_session_token(db, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_optional_current_user(
    token: Optional[str] = Depends(extract_token),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Return authenticated User if valid token/cookie provided, else None."""
    if not token:
        return None
    return auth_service.validate_session_token(db, token)


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure authenticated user account is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account.",
        )
    return current_user


# Alias for explicit requirement naming convention
require_authenticated_user = get_current_active_user


def require_role(role_name: str) -> Callable[[User], User]:
    """Dependency factory requiring a specific role."""
    return require_roles([role_name])


def require_roles(allowed_roles: List[str]) -> Callable[[User], User]:
    """Dependency factory enforcing role-based access control.

    Args:
        allowed_roles: List of permitted roles (e.g. ['admin', 'technician', 'homeowner']).

    Returns:
        Callable dependency that returns current user or raises 403 Forbidden.
    """
    normalized_allowed = {r.lower() for r in allowed_roles}

    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        user_role = (current_user.role or "").lower()
        if user_role not in normalized_allowed and user_role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of {allowed_roles} roles. Your role is '{current_user.role}'.",
            )
        return current_user

    return role_checker


def require_permission(permission_name: str) -> Callable[[User], User]:
    """Dependency factory requiring a granular permission."""
    def permission_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if is_admin(current_user):
            return current_user
        if not has_permission(current_user, permission_name):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires permission '{permission_name}'.",
            )
        return current_user

    return permission_checker


# Pre-configured role guards
require_admin = require_roles(["admin"])
require_homeowner = require_roles(["homeowner", "admin"])
require_technician = require_roles(["technician", "admin"])
get_current_admin_user = require_roles(["admin"])
get_current_operator_or_above = require_roles(["admin", "asset_manager", "operator", "technician"])


# ---------------------------------------------------------------------------
# Database-Backed Resource Authorization Dependencies (IDOR Protection)
# ---------------------------------------------------------------------------

def require_plant_access(
    plant_id: int = Path(..., description="Solar plant identifier"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Plant:
    """Verify in database that current user has authorization to access the specified plant.

    Raises:
        HTTPException (404): If plant does not exist.
        HTTPException (403): If user lacks permission on this plant.
    """
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Solar plant #{plant_id} not found.",
        )

    if not can_view_plant(current_user, plant):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You do not have authorization to access solar plant #{plant_id}.",
        )

    return plant


def require_asset_access(
    inverter_id: str = Path(..., description="Inverter identifier"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Inverter:
    """Verify in database that current user has authorization to access the inverter asset."""
    inverter = db.query(Inverter).filter(Inverter.id == inverter_id).first()
    if not inverter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inverter '{inverter_id}' not found.",
        )

    if not can_view_inverter(current_user, inverter):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You do not have authorization to access inverter '{inverter_id}'.",
        )

    return inverter


def require_assigned_work_order(
    work_order_id: str = Path(..., description="Work order identifier"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> WorkOrder:
    """Verify in database that current user has authorization to view or execute this work order."""
    work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not work_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Work order '{work_order_id}' not found.",
        )

    if not can_view_work_order(current_user, work_order):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You are not authorized to access work order '{work_order_id}'.",
        )

    return work_order
