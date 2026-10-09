# SolarMind Deye Cloud Inverter Integration Architecture

## Overview

SolarMind provides a modular, production-ready integration layer for **Deye Cloud Developer OpenAPI** (India region endpoint: `https://india-developer.deyecloud.com:443/`), enabling real-time electrical telemetry ingestion, station/inverter discovery, historical yield aggregation, and hardware alarm synchronization for single-string and hybrid solar installations.

---

## 1. Modular Provider Architecture

The integration follows a decoupled, contract-driven architecture:

```
                  ┌─────────────────────────────────────┐
                  │    BaseInverterProvider (ABC)       │
                  └──────────────────┬──────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
  ┌──────────────▼───────────────┐        ┌──────────────▼──────────────┐
  │     DeyeInverterProvider     │        │  SimulatedInverterProvider  │
  │ (Live OEM DeyeCloud OpenAPI) │        │ (Synthetic Diurnal Physics) │
  └──────────────┬───────────────┘        └─────────────────────────────┘
                 │
  ┌──────────────▼───────────────┐
  │       DeyeCloudClient        │
  │  (HTTP / Auth / Backoff)     │
  └──────────────────────────────┘
```

### Key Modules:
- [`app.integrations.base`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/backend/app/integrations/base.py): Defines the abstract `BaseInverterProvider` interface and vendor-neutral normalized dataclasses (`NormalizedPlantDiscovery`, `NormalizedDeviceDiscovery`, `NormalizedTelemetry`, `NormalizedAlert`, `NormalizedDeviceStatus`, `ConnectionTestResult`, `SyncRunSummary`).
- [`app.integrations.deye.client`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/backend/app/integrations/deye/client.py): Low-level HTTP client managing SHA256 authentication, proactive bearer token renewal, exponential backoff with jitter, non-retryable error detection, and timeout policies.
- [`app.integrations.deye.provider`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/backend/app/integrations/deye/provider.py): Normalized provider translating raw Deye JSON payloads into SolarMind's internal domain models without leaking proprietary vendor fields.
- [`app.integrations.simulator.provider`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/backend/app/integrations/simulator/provider.py): Explicitly labeled fallback provider (`is_simulated=True`) generating solar diurnal generation curves when Deye credentials are not configured or live gateways are unreachable.
- [`app.integrations.sync_service`](file:///c:/Users/Lenovo/Desktop/Solar%20mind/backend/app/integrations/sync_service.py): Orchestrates periodic and on-demand synchronization runs, deduplicates time-series records, updates `IntegrationConfig` metadata, and records immutable `IntegrationSyncRun` and `AuditEvent` compliance logs.

---

## 2. Verified DeyeCloud Developer OpenAPI Endpoints

| Operation | Endpoint | Method | Verified Status | Description |
|---|---|:---:|:---:|---|
| **Account Token** | `/v1.0/account/token` | `POST` | :white_check_mark: Verified | Authenticates using `appId`, `appSecret`, `email`, and `SHA256(password)`. Returns bearer token valid for 7200 seconds. |
| **Station Discovery** | `/v1.0/station/list` | `POST` | :white_check_mark: Verified | Discovers registered solar power stations and capacities. |
| **Device Discovery** | `/v1.0/device/list` | `POST` | :white_check_mark: Verified | Lists inverters and data-loggers under stations. |
| **Latest Telemetry** | `/v1.0/device/data/latest` | `POST` / `GET` | :white_check_mark: Verified | Retrieves instantaneous AC/DC power, voltage, current, frequency, daily/total yield, and temperatures. |
| **Historical Telemetry**| `/v1.0/device/data/history` | `POST` | :white_check_mark: Verified | Queries 5-minute time-series electrical metrics across specified date ranges. |
| **Alarm / Fault Log** | `/v1.0/station/alarm/list` | `POST` | :white_check_mark: Verified | Fetches active and resolved hardware fault trips. |

---

## 3. Reliability & Resilience Engine

### 1. Token Lifecycle Management
- Access tokens expire after 7200 seconds (2 hours).
- `DeyeCloudClient` caches tokens in memory and proactively triggers renewal when within a 300-second window before expiry.
- Automatic 401 recovery: if an active token is rejected by the server, the client immediately invalidates the cache, fetches a fresh token, and retries the request.

### 2. Exponential Backoff with Jitter
- Applied to transient network timeouts, HTTP 5xx gateway errors, and HTTP 429 rate limit responses.
- Sleep formula: $\text{sleep} = \min(\text{max\_backoff}, \text{base\_backoff} \times 2^{\text{attempt}-1} + \text{uniform}(0.1, 0.5))$.

### 3. Non-Retryable Error Recognition
- Hard failures (HTTP 400 Bad Request, HTTP 401 Invalid Credentials, HTTP 403 Forbidden, HTTP 422 Unprocessable Entity) short-circuit immediately without retrying, preventing infinite loops or account lockout.

### 4. Database Ingestion & Deduplication
- Before persisting incoming telemetry, `IntegrationSyncService` checks for pre-existing records matching `(inverter_id, timestamp)` to prevent duplicated energy counters or corrupted analytics.

---

## 4. Security & Privacy Guarantees

1. **Server-Side Credential Storage**: `DEYE_APP_ID`, `DEYE_APP_SECRET`, `DEYE_EMAIL`, and `DEYE_PASSWORD` reside exclusively on the server in environment variables or encrypted configuration tables.
2. **Secret Masking**: All API responses (e.g. `/api/v1/admin/integrations`) mask sensitive keys as `••••••••••••`.
3. **Role Restrictions**: Only users with the `admin` role can test connectivity, update integration endpoints, or view sync logs.

---

## 5. Truthful Simulator Fallback

When live Deye credentials are not configured, SolarMind defaults to `SimulatedInverterProvider`:
- All generated telemetry points have `is_simulated = True` and `data_source = "SIMULATED"`.
- The frontend and analytics modules clearly distinguish simulated demonstration data from live OEM telemetry.
