# SolarMind Security, Authorization & Permission Architecture

## Overview

SolarMind employs a multi-tiered security architecture engineered to safeguard solar assets, private homeowner telemetry, and technician operations. The system enforces strict authentication, role-based access control (RBAC), and database-level resource ownership validation to completely prevent Insecure Direct Object References (IDOR).

---

## 1. Modular Architecture

The authorization and security services are decoupled across specialized modules within the FastAPI backend:

| Module | Responsibility | Key Components |
|---|---|---|
| `app.core.security` | Cryptographic primitives & password hashing | `verify_password`, `get_password_hash` (Argon2id/Bcrypt) |
| `app.services.auth_service` | User authentication, token issuance, session lifecycle | `authenticate_user`, `create_session_token`, `validate_session_token`, `revoke_session` |
| `app.api.deps` | Current-user resolution & dependency injection guards | `get_current_user`, `require_authenticated_user`, `require_admin`, `require_role`, `require_permission`, `require_plant_access`, `require_asset_access`, `require_assigned_work_order` |
| `app.core.permissions` | Permission constants, role mappings, and database ownership evaluators | `ROLE_PERMISSIONS`, `can_view_plant`, `can_view_inverter`, `can_view_work_order`, `can_modify_work_order`, `can_view_diagnosis`, `enforce_plant_access`, etc. |
| `app.services.audit_service` | Immutable audit logging & transactional consistency | `log_audit_event`, `transactional_audit` |
| `app.schemas.common` | Request pagination & date-range filtering contracts | `PaginationParams`, `PaginatedResponse`, `DateRangeFilter` |
| `app.db.errors` | Centralized exception mapping and standard error envelopes | `EntityNotFoundError`, `EntityConflictError`, `register_database_exception_handlers` |
| `app.core.config` & `app.core.logging` | Secure configuration, secret masking, and structured log formatting | `Settings`, `setup_logging`, `CustomFormatter` |

---

## 2. Role Hierarchy & Permission Matrix

SolarMind defines 5 standard user roles:
1. **`admin`**: System administrator with unconditional access across all plants, users, devices, integrations, and audit records.
2. **`asset_manager`**: Solar asset portfolio manager with full visibility and operational authority across plants and devices.
3. **`operator`**: Solar plant monitoring operator with system-wide read access and diagnosis initiation authority.
4. **`technician`**: Field service technician with access restricted to assigned work orders, associated solar assets, and field inspection workflows.
5. **`homeowner`**: Solar system owner with access strictly scoped to their owned residential plants, inverters, alerts, diagnoses, and work orders.

### Granular Permission Matrix

| Permission | Description | Admin | Asset Mgr | Operator | Technician | Homeowner |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `plant:view` | View plant details & overview | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: (Assigned) | :white_check_mark: (Owned) |
| `plant:modify` | Create, update, or decommission plants | :white_check_mark: | :white_check_mark: | :x: | :x: | :x: |
| `inverter:view` | View inverter status and metadata | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: (Assigned) | :white_check_mark: (Owned) |
| `inverter:modify` | Register, update, or recalibrate inverters | :white_check_mark: | :white_check_mark: | :x: | :x: | :x: |
| `telemetry:view` | Query electrical metrics & telemetry time-series | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: (Assigned) | :white_check_mark: (Owned) |
| `telemetry:import` | Ingest bulk telemetry datasets or device payloads | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :x: |
| `diagnosis:view` | Inspect fault analysis dossiers and confidence scores | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: (Assigned) | :white_check_mark: (Owned) |
| `diagnosis:request` | Trigger AI diagnosis analysis runs | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :white_check_mark: (Owned) |
| `work_order:view` | View maintenance work orders | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: (Assigned) | :white_check_mark: (Owned) |
| `work_order:create` | Dispatch or open new maintenance work orders | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :x: |
| `work_order:modify` | Update work order status, duration, notes, and actions | :white_check_mark: | :white_check_mark: | :x: | :white_check_mark: (Assigned) | :x: |
| `photo:view` | View inspection and thermal images | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: (Assigned) | :white_check_mark: (Owned) |
| `photo:upload` | Upload panel photographs or repair evidence | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: (Assigned) | :white_check_mark: (Owned) |
| `alert:view` | View threshold alerts and outage events | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: (Assigned) | :white_check_mark: (Owned) |
| `alert:resolve` | Acknowledge or dismiss operational alerts | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :x: |
| `admin:manage_users` | Create, invite, deactivate users or alter roles | :white_check_mark: | :x: | :x: | :x: | :x: |
| `admin:manage_rules` | Configure diagnosis heuristics and thresholds | :white_check_mark: | :x: | :x: | :x: | :x: |
| `admin:manage_integrations`| Configure external OEM inverter APIs & webhooks | :white_check_mark: | :x: | :x: | :x: | :x: |
| `admin:view_audit_logs` | Review system-wide compliance and audit event history | :white_check_mark: | :white_check_mark: | :x: | :x: | :x: |

---

## 3. Database-Backed Resource Authorization & IDOR Prevention

SolarMind explicitly disallows URL-parameter-only trust. Resource authorization is evaluated directly against database relationships:

### 1. Plant Ownership Evaluation (`can_view_plant`)
- **Admin / Operator**: Granted access across all plants.
- **Homeowner**: Must match `plant.owner_id == user.id` OR have an active entry in `plant.user_assignments`.
- **Technician**: Must be assigned to the plant via `plant.user_assignments` OR have an active work order on the plant (`work_order.technician_id == user.id` or named in `work_order.assigned_to`).

### 2. Inverter and PV Asset Evaluation (`can_view_inverter`, `can_view_pv_asset`)
- Inverters and PV string assets derive their access policy from the parent plant. If the user cannot access the parent plant, inverter/asset access is denied.

### 3. Work Order Access Evaluation (`can_view_work_order`, `can_modify_work_order`)
- **Homeowners**: Can view work orders for their owned plants, but **cannot modify** work orders (status transitions, technician repair logs).
- **Technicians**: Can view and modify **only** work orders explicitly assigned to them (`work_order.technician_id == user.id` or matching username/email/full_name).
- **Admins**: Can view, dispatch, and modify all work orders.

### 4. Diagnosis and Inspection Photos (`can_view_diagnosis`, `can_view_photo`)
- Diagnoses and inspection photos derive access from the linked plant. Homeowners can only view dossiers for their registered solar systems.

---

## 4. Reusable Dependency Helpers

FastAPI route handlers use standard reusable dependency injection:

```python
from app.api.deps import (
    require_authenticated_user,
    require_admin,
    require_role,
    require_roles,
    require_permission,
    require_plant_access,
    require_asset_access,
    require_assigned_work_order,
)

# Example 1: Require Administrator Role
@router.post("/plants", response_model=PlantResponse)
def create_plant(
    payload: PlantCreate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ...

# Example 2: Require Database-Validated Plant Access (IDOR Protected)
@router.get("/plants/{plant_id}/telemetry", response_model=List[TelemetryResponse])
def get_plant_telemetry(
    plant: Plant = Depends(require_plant_access),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    # 'plant' is guaranteed to exist and belong/be assigned to 'current_user'
    ...

# Example 3: Require Assigned Work Order Access
@router.patch("/work-orders/{work_order_id}/status", response_model=WorkOrderResponse)
def update_work_order_status(
    payload: WorkOrderStatusUpdate,
    work_order: WorkOrder = Depends(require_assigned_work_order),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    ...
```

---

## 5. Atomic Transactions and Safe Audit Logging

To ensure security compliance, sensitive mutations and their corresponding audit logs commit atomically within a single database transaction.

### `transactional_audit` Context Manager
The `app.services.audit_service.transactional_audit` helper guarantees that:
1. If the database mutation succeeds, the audit log is appended and the transaction commits atomically.
2. If any error occurs during the mutation or audit event creation, the entire transaction is rolled back safely, preventing corrupted or unlogged mutations.

```python
with transactional_audit(
    db=db,
    actor=current_user,
    action="UPDATE_WORK_ORDER_STATUS",
    target_type="WorkOrder",
    target_id=work_order.id,
    details=f"Status transitioned from {old_status} to {new_status}",
):
    work_order.status = new_status
    db.add(work_order)
```

---

## 6. Consistent API Error Standards

SolarMind maps security and business errors to standardized HTTP status codes and uniform JSON response envelopes:

| Status Code | Scenario | Behavior & Information Disclosure Policy |
|---|---|---|
| **`401 Unauthorized`** | Missing, expired, or revoked session token / bearer header | Returns `WWW-Authenticate: Bearer` header. Does not expose private internal states. |
| **`403 Forbidden`** | Authenticated user lacks the role or resource assignment | Returns explicit access denied message without leaking resource mutation controls. |
| **`404 Not Found`** | Requested entity ID does not exist | Returns entity not found envelope. |
| **`409 Conflict`** | Unique constraint violation, duplicate email, duplicate serial identifier | Maps SQLAlchemy `IntegrityError` to a clean conflict message without leaking internal database schema details. |
| **`422 Unprocessable`** | Request payload validation failure | Formats Pydantic validation field errors cleanly with request ID tracing. |
| **`500 Internal Error`** | Unhandled exception | Masked with generic support message and unique `X-Request-ID`. Python tracebacks are **never** returned to clients. |
