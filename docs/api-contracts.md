# SolarMind API Contract Specification
**Version:** 1.0.0  
**Target:** React Frontend ⇄ FastAPI Backend Communication  
**Document Type:** Formal Interface & Protocol Agreement  

---

## 1. Executive Summary & Purpose

This contract establishes the architectural and protocol standards governing all communication between the **SolarMind React Client** and the **FastAPI REST API**. 

Both client and server implementations MUST strictly adhere to the schemas, error structures, unit standards, and conventions detailed herein.

---

## 2. General Protocol Conventions

### 2.1 API Versioning
- All business and analytical endpoints MUST reside under the versioned prefix `/api/v1`.
- Breaking changes require a new version path (e.g., `/api/v2`).
- Root-level endpoints (`/health`, `/docs`, `/redoc`, `/openapi.json`) are reserved for infrastructure health probes and developer documentation.

### 2.2 Content-Type & Serialization
- All request and response bodies MUST use standard JSON (`Content-Type: application/json`), except file upload endpoints which use `multipart/form-data`.
- Field names in JSON payloads follow `snake_case` (e.g., `rated_capacity_kwp`, `dc_voltage`).
- Client-side data layers may map `snake_case` to `camelCase` internally, but wire format remains strictly `snake_case`.

### 2.3 Timestamp & Timezone Conventions
- All timestamps in request and response payloads MUST use **ISO 8601** strings in **UTC** with the explicit `Z` designator or timezone offset:
  - Format: `YYYY-MM-DDTHH:mm:ss.sssZ`
  - Example: `2026-10-09T08:30:00.000Z`
- The backend stores and calculates all time-series metrics in UTC.
- The frontend is responsible for localizing displayed timestamps using the plant's configured timezone (e.g., `America/Los_Angeles` or `Europe/Berlin`).

---

## 3. Physical Measurement & Financial Units

To eliminate ambiguity across physics models, AI classifiers, telemetry charts, and financial loss calculations, units are strictly defined:

| Metric Category | Field Suffix / Name | Standard Unit | Symbol / Format | Example Value | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Nominal Power** | `*_kwp` | Kilowatt-peak | `kWp` | `5.20` | Total DC STC nameplate capacity |
| **Active Power** | `*_kw` | Kilowatts | `kW` | `4.18` | Instantaneous DC / AC power |
| **Cumulative Energy** | `*_kwh` | Kilowatt-hours | `kWh` | `24.6` | Daily or total yield |
| **Bulk Energy** | `*_mwh` | Megawatt-hours | `MWh` | `14.2` | Lifetime solar production |
| **Voltage** | `*_v` | Volts | `V` | `382.5` | DC string voltage or AC grid voltage |
| **Current** | `*_a` | Amperes | `A` | `9.85` | DC string current or AC output current |
| **Frequency** | `*_hz` | Hertz | `Hz` | `50.02` | AC utility grid frequency |
| **Solar Irradiance** | `irradiance_poa` | Watts per sq. meter | `W/m²` | `850.0` | Plane-of-Array (POA) irradiance |
| **Horizontal Irradiance** | `irradiance_ghi` | Watts per sq. meter | `W/m²` | `620.0` | Global Horizontal Irradiance |
| **Temperature** | `*_c` | Degrees Celsius | `°C` | `42.5` | Inverter IGBT or ambient temp |
| **Performance Ratio** | `performance_ratio` | Percentage | `%` (0.0 to 100.0) | `86.4` | $\frac{\text{Actual Yield}}{\text{Expected Yield}} \times 100$ |
| **Specific Yield** | `specific_yield` | Yield per Capacity | `kWh/kWp` | `4.73` | Daily energy normalized by plant size |
| **Currency** | `currency` | ISO 4217 Code | 3-Letter Code | `"USD"`, `"EUR"` | Plant financial currency |
| **Tariff Rate** | `tariff_per_kwh` | Monetary / kWh | Decimal | `0.185` | Utility feed-in or import rate |

---

## 4. Standard Response & Error Formats

### 4.1 Success Response Wrapper / Direct Representation
- Single resources return direct JSON objects (HTTP `200` or `201`).
- Paginated collections return a standardized envelope (HTTP `200`):

```json
{
  "items": [
    { "id": 1, "name": "Rooftop String 1" }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 45,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

### 4.2 Standard Error Response Specification
Every non-2xx error response MUST return the unified JSON error envelope:

```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable explanation of the error.",
    "status_code": 400,
    "request_id": "req-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "timestamp": "2026-10-09T08:30:00.000Z",
    "field_errors": [
      {
        "field": "rated_capacity_kwp",
        "message": "Field 'rated_capacity_kwp' must be greater than 0.0 kWp."
      }
    ]
  }
}
```

#### Canonical Error Codes
- `VALIDATION_ERROR` (422 / 400): Schema or range validation failure.
- `RESOURCE_NOT_FOUND` (404): Requested entity does not exist.
- `DUPLICATE_RESOURCE` (409): Unique constraint violation (e.g., serial number already registered).
- `UNPROCESSABLE_IMAGE` (422): Uploaded photo is corrupted or unsupported format.
- `RATE_LIMIT_EXCEEDED` (429): Ingestion rate exceeded permissible threshold.
- `INTERNAL_SERVER_ERROR` (500): Server-side unexpected exception (sanitized message, no raw trace exposed).

---

## 5. Pagination, Sorting & Filtering Standards

### Query Parameters
- `page`: 1-indexed page number (default: `1`).
- `page_size`: Number of records per page (default: `20`, maximum: `100`).
- `sort_by`: Field to sort on (e.g., `timestamp`, `created_at`).
- `sort_order`: Direction (`asc` or `desc`, default: `desc`).
- `start_time` & `end_time`: ISO 8601 strings for time-range filtering.
- `severity`: Alert severity filter (`INFO`, `WARNING`, `CRITICAL`).
- `status`: Lifecycle filter (`ACTIVE`, `RESOLVED`, `ALL`).

---

## 6. Image Upload & Computer Vision Protocol

- **Endpoint**: `POST /api/v1/photos/inspect`
- **Encoding**: `multipart/form-data`
- **Fields**:
  - `file`: Binary file stream (Supported: `image/jpeg`, `image/png`, `image/webp`). Max size: `15MB`.
  - `plant_id`: Integer identifier.
  - `inverter_id`: Optional integer identifier.
  - `inspection_type`: String (`OPTICAL` or `THERMAL_IR`).
- **Response**:
  - Extracted EXIF capture metadata.
  - Anomaly classification (`SOILING`, `HOTSPOT`, `MICRO_CRACK`, `PHYSICAL_OBSTRUCTION`, `HEALTHY`).
  - Anomaly confidence score (`0.0` to `1.0`).
  - Actionable maintenance recommendation.

---

## 7. Demo & Simulation Identification

To prevent test data from being mistaken for real physical telemetry:
- Resources and telemetry records MUST support an `is_demo` boolean property.
- When running in demo or simulation mode, backend responses MUST include the HTTP header:
  ```http
  X-SolarMind-Demo-Mode: true
  ```
- Simulated telemetry records MUST have `"data_source": "SIMULATED"`.

---

## 8. Resource Roadmaps & Implemented Route Registry

### 8.1 Current Implemented Endpoints (Verified against Backend)
| Method | Path | Status | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | **Implemented** | Root health probe (Process uptime, service name, version) |
| `GET` | `/api/v1/health` | **Implemented** | Versioned API health & readiness probe |
| `GET` | `/docs` | **Implemented** | Interactive Swagger UI |
| `GET` | `/redoc` | **Implemented** | ReDoc API documentation |
| `GET` | `/openapi.json` | **Implemented** | OpenAPI 3.1.0 schema specification |

### 8.2 Canonical Resource URI Roadmap
The planned business endpoints follow standard REST resource naming:

1. **Plants**: `/api/v1/plants` (CRUD for PV installations, coordinates, tariff)
2. **Inverters**: `/api/v1/inverters` (Single-string inverters, MPPT channels, ratings)
3. **Telemetry**: `/api/v1/telemetry` (Time-series ingestion, live status, power curves)
4. **Diagnoses**: `/api/v1/diagnoses` (Evaluation runs, fault classifications, loss math)
5. **Photos**: `/api/v1/photos` (CV panel image upload, defect analysis)
6. **Work-Orders**: `/api/v1/work-orders` (Remediation workflows, scheduled cleaning)
7. **Alerts**: `/api/v1/alerts` (Active/acknowledged diagnostic alerts)
8. **Analytics**: `/api/v1/analytics` (Historical Performance Ratio, degradation trends)

---

## 9. Concrete Examples: Health & Plant Resources

### 9.1 Health Check Resource

#### Success Response (`GET /api/v1/health` ➔ `200 OK`)
```json
{
  "status": "healthy",
  "service": "SolarMind Backend",
  "version": "0.1.0",
  "environment": "development",
  "timestamp": "2026-10-09T08:30:00.000Z"
}
```

---

### 9.2 Plant Resource

#### Create Plant Request (`POST /api/v1/plants`)
```json
{
  "name": "Sunnyvale Rooftop Installation",
  "rated_capacity_kwp": 5.4,
  "string_count": 1,
  "panel_count": 12,
  "panel_wattage": 450.0,
  "tilt_angle": 22.5,
  "azimuth_angle": 180.0,
  "latitude": 37.3688,
  "longitude": -122.0363,
  "electricity_tariff_per_kwh": 0.195,
  "currency": "USD",
  "timezone": "America/Los_Angeles"
}
```

#### Success Response (`POST /api/v1/plants` ➔ `201 Created`)
```json
{
  "id": 1,
  "name": "Sunnyvale Rooftop Installation",
  "rated_capacity_kwp": 5.4,
  "string_count": 1,
  "panel_count": 12,
  "panel_wattage": 450.0,
  "tilt_angle": 22.5,
  "azimuth_angle": 180.0,
  "latitude": 37.3688,
  "longitude": -122.0363,
  "electricity_tariff_per_kwh": 0.195,
  "currency": "USD",
  "timezone": "America/Los_Angeles",
  "status": "ACTIVE",
  "is_demo": false,
  "created_at": "2026-10-09T08:30:00.000Z",
  "updated_at": "2026-10-09T08:30:00.000Z"
}
```

#### Validation Error Response (`POST /api/v1/plants` ➔ `422 Unprocessable Entity`)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input payload failed validation checks.",
    "status_code": 422,
    "request_id": "req-8f742c12-e42a-4395-9799-d41cba239ab7",
    "timestamp": "2026-10-09T08:30:01.120Z",
    "field_errors": [
      {
        "field": "rated_capacity_kwp",
        "message": "Value must be strictly greater than 0."
      },
      {
        "field": "string_count",
        "message": "Initial platform release supports single-string systems only (string_count = 1)."
      }
    ]
  }
}
```

#### Not Found Error Response (`GET /api/v1/plants/999` ➔ `404 Not Found`)
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Plant with ID 999 was not found in the system.",
    "status_code": 404,
    "request_id": "req-29df3411-9a99-4c12-8812-70129cfbe194",
    "timestamp": "2026-10-09T08:30:02.045Z"
  }
}
```

---

## 10. Frontend/Backend Contract Compatibility Checklist

Before delivering or reviewing PRs across frontend and backend:

- [ ] **1. Path & Method Verification**: Route is defined under `/api/v1/<resource>` with appropriate HTTP method (`GET`, `POST`, `PUT`, `DELETE`).
- [ ] **2. Wire Casing**: JSON request and response keys strictly use `snake_case`.
- [ ] **3. Timestamp ISO UTC**: Every datetime field is serialized as ISO 8601 UTC with explicit `Z` designator.
- [ ] **4. Unit Consistency**: Numbers match standard unit suffixes (`_kw`, `_kwh`, `_v`, `_a`, `_c`, `_kwp`).
- [ ] **5. Unified Error Envelope**: All HTTP 4xx/5xx responses conform to `{ "error": { "code", "message", "status_code", "request_id", ... } }`.
- [ ] **6. Status Codes**: Returns `200` for general retrieval, `201` for creation, `204` for deletion, `400`/`422` for invalid input, `404` for missing entities.
- [ ] **7. CORS Policy**: Origins like `http://localhost:5173` are explicitly allowed; wildcard `*` is not used.
- [ ] **8. Demo Tagging**: Synthetic/simulated test data contains `is_demo: true` and header `X-SolarMind-Demo-Mode: true`.
- [ ] **9. Pagination Envelope**: List endpoints return `{ "items": [...], "pagination": { ... } }`.
- [ ] **10. OpenAPI Sync**: The FastAPI endpoint is reflected in `GET /openapi.json` without contract divergence.
