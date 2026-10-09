# SolarMind API & Role-Aware Integration Matrix

This document provides a comprehensive map of all SolarMind frontend modules, client services, backend REST API endpoints, role-based access control (RBAC) rules, error handling strategies, and verification test status.

---

## 1. Authentication & Session Strategy

| Feature | Implementation | Details |
| :--- | :--- | :--- |
| **Authentication Standard** | JWT Bearer Tokens (`access_token`, `refresh_token`) | Tokens are stored securely in `sessionStorage`/`localStorage` and injected via an Axios request interceptor (`Authorization: Bearer <token>`). |
| **Server-Verified RBAC** | `user.role` from `/api/v1/auth/me` & login payload | The client routes dynamically to role-specific home dashboards. Client-side URL spoofing or role alteration is invalidated by backend JWT authorization checks on every endpoint. |
| **Session Expiration (401)** | Axios Interceptor & Event Dispatcher | Detects HTTP 401, flushes auth storage, dispatches `solarmind_auth_expired` event, and redirects to `/login` with return URL state. |
| **Permission Denied (403)** | Classified Error Envelopes & `<PermissionDenied />` | Access to forbidden resources displays a clean error boundary / permission screen without crash or loop. |
| **Unsafe Mutation Protection** | No Blind Retries on POST / PATCH / DELETE | Network failures and server errors on mutations return structured errors to the caller to prevent duplicate work orders or double inspections. |

---

## 2. Dynamic Role-Aware Routing

| User Role | Home Path | Permitted Routes | Denied Routes |
| :--- | :--- | :--- | :--- |
| **Admin / Operator** | `/dashboard` | `/dashboard`, `/plants`, `/analytics`, `/diagnostics`, `/weather`, `/work-orders`, `/inspections`, `/settings`, `/admin/users`, `/admin/audit-logs` | Restricted homeowner private endpoints |
| **Homeowner** | `/home/dashboard` | `/home/dashboard`, `/home/plants`, `/home/alerts`, `/home/diagnoses`, `/home/work-orders`, `/settings` | `/admin/*`, `/technician/*`, non-owned plant analytics |
| **Technician** | `/technician/dashboard` | `/technician/dashboard`, `/technician/work-orders`, `/technician/work-orders/:id/inspection`, `/technician/work-orders/:id/completion`, `/inspections` | `/admin/*`, `/home/*` (other users' plants) |

---

## 3. Comprehensive Endpoint & Service Integration Matrix

### 3.1 Authentication & Profile

| Frontend Service / Module | Endpoint | Method | Required Role(s) | Error Handling & Mutation Safety | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `authService.login()` | `/api/v1/auth/login` | `POST` | Public | Returns credentials; stores token; dispatches session. | Verified |
| `authService.register()` | `/api/v1/auth/register` | `POST` | Public | Validates email uniqueness and password complexity. | Verified |
| `authService.getCurrentUser()` | `/api/v1/auth/me` | `GET` | Authenticated | Fetches profile; extracts authoritative user role. | Verified |
| `authService.logout()` | `/api/v1/auth/logout` | `POST` | Authenticated | Clears token storage, invalidates server session. | Verified |
| `authService.forgotPassword()` | `/api/v1/auth/forgot-password` | `POST` | Public | Safe rate-limited email dispatch. | Verified |
| `authService.resetPassword()` | `/api/v1/auth/reset-password` | `POST` | Public | Token validation and password reset. | Verified |

### 3.2 Homeowner Dashboard & Resources

| Frontend Service / Module | Endpoint | Method | Required Role(s) | Error Handling & Mutation Safety | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `homeownerService.getDashboard()` | `/api/v1/home/dashboard` | `GET` | `HOMEOWNER`, `ADMIN` | Loading skeleton; empty data placeholder; 403 denied guard. | Verified |
| `homeownerService.getPlants()` | `/api/v1/home/plants` | `GET` | `HOMEOWNER`, `ADMIN` | Returns homeowner-scoped solar installations only. | Verified |
| `homeownerService.getAlerts()` | `/api/v1/home/alerts` | `GET` | `HOMEOWNER`, `ADMIN` | Filterable by severity; handles network interruptions. | Verified |
| `homeownerService.getDiagnoses()` | `/api/v1/home/diagnoses` | `GET` | `HOMEOWNER`, `ADMIN` | Returns Why-Low root cause assessments and loss estimates. | Verified |
| `homeownerService.getWorkOrders()` | `/api/v1/home/work-orders` | `GET` | `HOMEOWNER`, `ADMIN` | Displays technician assignment and verification status. | Verified |

### 3.3 Technician Workflow & Work Orders

| Frontend Service / Module | Endpoint | Method | Required Role(s) | Error Handling & Mutation Safety | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `technicianService.getDashboard()` | `/api/v1/technician/dashboard` | `GET` | `TECHNICIAN`, `ADMIN` | Shows assigned jobs, pending inspections, urgent dispatch. | Verified |
| `technicianService.getWorkOrders()` | `/api/v1/technician/work-orders` | `GET` | `TECHNICIAN`, `ADMIN` | Supports status filter (`in_progress`, `completed`, etc.). | Verified |
| `technicianService.getWorkOrderDetails()` | `/api/v1/technician/work-orders/{id}` | `GET` | `TECHNICIAN`, `ADMIN` | IDOR guarded; 404/403 handled gracefully. | Verified |
| `technicianService.submitInspection()` | `/api/v1/technician/work-orders/{id}/inspection` | `POST` | `TECHNICIAN`, `ADMIN` | Unsafe mutation: strictly single submission without blind retry. | Verified |
| `technicianService.completeWorkOrder()` | `/api/v1/technician/work-orders/{id}/completion` | `POST` | `TECHNICIAN`, `ADMIN` | Requires completion notes and parts replaced. | Verified |
| `technicianService.verifyRecovery()` | `/api/v1/work-orders/{id}/verify` | `POST` | `ADMIN`, `TECHNICIAN` | Verifies post-repair generation baseline vs actual yield. | Verified |

### 3.4 Admin Overview & User Management

| Frontend Service / Module | Endpoint | Method | Required Role(s) | Error Handling & Mutation Safety | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `adminService.getOverview()` | `/api/v1/admin/overview` | `GET` | `ADMIN`, `OPERATOR` | Fleetwide telemetry, active incidents, aggregate capacity. | Verified |
| `adminService.getUsers()` | `/api/v1/admin/users` | `GET` | `ADMIN` | Paginated user management table with role badges. | Verified |
| `adminService.updateUser()` | `/api/v1/admin/users/{id}` | `PATCH` | `ADMIN` | Role modifications and account status toggles. | Verified |
| `adminService.getAuditLogs()` | `/api/v1/admin/audit-logs` | `GET` | `ADMIN` | Security audit trail; timestamps and IP addresses. | Verified |
| `adminService.getIntegrations()` | `/api/v1/admin/integrations` | `GET` | `ADMIN` | DeyeCloud / Weather / IoT provider sync status. | Verified |
| `adminService.getSystemHealth()` | `/api/v1/admin/system-health` | `GET` | `ADMIN` | Database, cache, engine, and background worker status. | Verified |

### 3.5 Plants, Inverters & Telemetry

| Frontend Service / Module | Endpoint | Method | Required Role(s) | Error Handling & Mutation Safety | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `plantService.getPlants()` | `/api/v1/plants` | `GET` | Authenticated | Filtered by user ownership / fleet access. | Verified |
| `plantService.getPlantById()` | `/api/v1/plants/{id}` | `GET` | Authenticated | Detailed plant config, capacity, inverter list. | Verified |
| `plantService.getInverters()` | `/api/v1/plants/{id}/inverters` | `GET` | Authenticated | MPPT channels, AC/DC status, daily yields. | Verified |
| `telemetryService.getLatest()` | `/api/v1/telemetry/plant/{id}/latest` | `GET` | Authenticated | Real-time power output, grid frequency, temperature. | Verified |
| `telemetryService.getHistory()` | `/api/v1/telemetry/plant/{id}/history` | `GET` | Authenticated | Date range queries for analytics and chart plotting. | Verified |

### 3.6 Diagnostics & Why-Low Engine

| Frontend Service / Module | Endpoint | Method | Required Role(s) | Error Handling & Mutation Safety | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `diagnosisService.getDiagnoses()` | `/api/v1/diagnostics` | `GET` | Authenticated | Why-Low 10-step fault evaluations and severity ranks. | Verified |
| `diagnosisService.triggerWhyLow()` | `/api/v1/diagnostics/evaluate/{plant_id}` | `POST` | `OPERATOR`, `ADMIN` | Computes expected generation vs actual yield. | Verified |
| `diagnosisService.getFaultCatalog()` | `/api/v1/diagnostics/fault-catalog` | `GET` | Authenticated | Standardized fault taxonomy and recommended remedies. | Verified |

### 3.7 Weather & Outage Events

| Frontend Service / Module | Endpoint | Method | Required Role(s) | Error Handling & Mutation Safety | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `weatherService.getPlantWeather()` | `/api/v1/weather/plant/{id}` | `GET` | Authenticated | Live irradiance ($W/m^2$), cloud cover %, ambient temp. | Verified |
| `weatherService.getForecast()` | `/api/v1/weather/plant/{id}/forecast` | `GET` | Authenticated | 24-48h forecast with expected vs unconstrained solar. | Verified |
| `weatherService.getOutages()` | `/api/v1/outages` | `GET` | Authenticated | Grid failure logs, AC supply interruptions, lost energy. | Verified |
| `weatherService.getPlantOutages()` | `/api/v1/outages/plant/{id}` | `GET` | Authenticated | Plant-specific outage history and evidence records. | Verified |

### 3.8 Geo Photo AI & Inspections

| Frontend Service / Module | Endpoint | Method | Required Role(s) | Error Handling & Mutation Safety | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `inspectionService.analyzePhoto()` | `/api/v1/inspections/analyze-photo` | `POST` | `TECHNICIAN`, `ADMIN` | Multipart upload; thermal/visual defect classification. | Verified |
| `inspectionService.getInspections()` | `/api/v1/inspections` | `GET` | Authenticated | Historical photo inspections with bounding boxes. | Verified |

---

## 4. Test Verification Summary

### Frontend Unit & Integration Tests
- Total Test Files: **27**
- Total Tests: **198 passing**
- Coverage Areas:
  - Role-aware routing & authentication state management.
  - Homeowner, Technician, and Admin service contracts.
  - HTTP 401 session expiry and event broadcasting.
  - HTTP 403 permission denied handling.
  - Multilingual internationalization (English, Hindi, Odia).
  - PWA service worker caching and offline fallback.

### Backend End-to-End & Unit Tests
- Total Tests: **196 passing**
- Coverage Areas:
  - RBAC security checks on all endpoints.
  - IDOR cross-user access prevention.
  - DeyeCloud integration client & backoff resilience.
  - Expected generation & 10-step Why-Low diagnostic engine.
  - Maintenance workflow & post-repair recovery verification.
