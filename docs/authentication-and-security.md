# SolarMind Security, Resilience & Authentication Documentation

## 1. Overview & Resilience Architecture

The SolarMind FastAPI backend is built with hardened production foundations, resilient error boundaries, and defensive data practices.

### Key Hardening Features

```
Client Request
      │
      ▼
┌──────────────────────────────────────────────┐
│ RequestTrackingMiddleware                    │
│ ├─ Extract or generate `X-Request-ID`        │
│ ├─ Validate Content-Length (15 MB limit)     │
│ └─ Measure latency & structured logging      │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ CORSMiddleware                               │
│ └─ Restrict to explicit `ALLOWED_ORIGINS`    │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Centralized Exception Handlers               │
│ ├─ RequestValidationError -> HTTP 422        │
│ ├─ EntityNotFoundError    -> HTTP 404        │
│ ├─ EntityConflictError    -> HTTP 409        │
│ ├─ IntegrityError         -> HTTP 409        │
│ ├─ OperationalError       -> HTTP 503        │
│ ├─ HTTPException          -> Standardized    │
│ └─ Fallback Exception     -> HTTP 500        │
└──────────────────────────────────────────────┘
```

---

## 2. Probes & Health Monitoring

### Liveness Probe (`GET /health` and `GET /api/v1/health`)
- Returns process health status without querying external dependencies.
- Used by container orchestrators (Kubernetes / Docker Compose) for restart decisions.

### Readiness Probe (`GET /ready` and `GET /api/v1/ready`)
- Executes live database ping (`SELECT 1`).
- **Failure Behavior**: If the database or any required dependency is unavailable, returns `HTTP 503 Service Unavailable` with `status: "unhealthy"` and exact component diagnostics.
- The system **never reports ready** if the database connection fails.

---

## 3. Error Handling & Information Leakage Prevention

1. **No Stack Trace Exposure**: All unhandled exceptions return a standardized error envelope:
   ```json
   {
     "error": {
       "code": "INTERNAL_SERVER_ERROR",
       "message": "An unexpected server error occurred. Please contact support.",
       "details": {},
       "request_id": "req-8f294a2b1c0e"
     }
   }
   ```
2. **Standardized Validation Errors**: Request validation failures (`HTTP 422`) structure errors by parameter/body path:
   ```json
   {
     "error": {
       "code": "VALIDATION_ERROR",
       "message": "Request payload validation failed.",
       "details": {
         "errors": [
           {"field": "body.installed_capacity_kwp", "message": "Input should be greater than 0"}
         ]
       },
       "request_id": "req-8f294a2b1c0e"
     }
   }
   ```
3. **Secret Masking**: Configuration routines mask sensitive environment variables (`DEYE_APP_SECRET`, `DEYE_PASSWORD`, database credentials) before logging.

---

## 4. Input & File Sanitization

User-supplied filenames (such as CSV telemetry uploads or inspection photos) are sanitized via `app.core.security.sanitize_filename`:
- Strips null bytes (`\x00`).
- Removes path traversal characters (`..`, `/`, `\`).
- Restricts characters to safe alphanumeric characters, underscores, and standard extensions.

---

## 5. Current Authentication Limitations & Roadmap

### Current Architecture
- In the current prototype phase, endpoints operate in an open local-network model for direct IoT telemetry ingest and browser development.
- Rate limiting and API key headers (`X-API-Key`) can be validated per organization.

### Production Authentication Roadmap
1. **OAuth 2.0 & OpenID Connect (OIDC)**:
   - Integration with enterprise identity providers (Keycloak, Auth0, Okta).
   - Asymmetric JWT token validation (`RS256`).
2. **Role-Based Access Control (RBAC)**:
   - **`Viewer`**: Read-only access to dashboard, plants, inverters, and reports.
   - **`Technician`**: Can update work orders, execute diagnostic runs, and attach inspection media.
   - **`Operator / Admin`**: Full CRUD permissions on plants, inverters, and system settings.
3. **Rate Limiting**:
   - Token bucket / Redis rate limiting per IP and API key for telemetry endpoints.
