# SolarMind REST API Specification (`/api/v1`)

This document outlines the v1 REST API schema and endpoint contracts for SolarMind.

---

## Base URL
```
http://localhost:8000/api/v1
```

---

## 1. System Configuration

### `GET /system/config`
Retrieves the current solar installation parameters.

**Response `200 OK`:**
```json
{
  "system_id": 1,
  "system_name": "Residential Rooftop String-1",
  "rated_power_kw": 5.0,
  "string_count": 1,
  "panel_count": 12,
  "panel_wattage": 415.0,
  "tilt_angle": 25.0,
  "azimuth_angle": 180.0,
  "latitude": 37.7749,
  "longitude": -122.4194,
  "electricity_tariff_per_kwh": 0.18,
  "currency": "USD"
}
```

### `PUT /system/config`
Updates solar installation parameters.

---

## 2. Inverter Telemetry

### `POST /telemetry`
Ingests a single snapshot or batch of telemetry readings from inverter or data logger.

**Request Payload:**
```json
{
  "system_id": 1,
  "timestamp": "2026-10-09T12:30:00Z",
  "dc_voltage": 380.5,
  "dc_current": 10.2,
  "dc_power": 3881.1,
  "ac_power": 3745.0,
  "ac_voltage": 234.2,
  "ac_frequency": 50.02,
  "daily_yield_kwh": 18.4,
  "total_yield_kwh": 4120.5,
  "inverter_temp_c": 42.1,
  "irradiance_poa": 850.0,
  "ambient_temp_c": 28.5
}
```

### `GET /telemetry/live`
Fetches the most recent live status for real-time dashboard display.

### `GET /telemetry/history`
Query parameters: `start_time`, `end_time`, `interval` (e.g. `5m`, `1h`, `1d`).

---

## 3. Diagnostics & Faults

### `POST /diagnostics/evaluate`
Runs the fault detection engine over a specified time window.

**Response `200 OK`:**
```json
{
  "status": "ANOMALY_DETECTED",
  "alerts": [
    {
      "id": 101,
      "fault_category": "PARTIAL_SHADING",
      "severity": "WARNING",
      "confidence": 0.92,
      "detected_at": "2026-10-09T12:30:00Z",
      "estimated_power_loss_kw": 0.85,
      "estimated_daily_loss_kwh": 2.4,
      "estimated_financial_loss": 0.43,
      "explanation": "Observed 22% current drop between 11:30 and 13:00 while irradiance remained steady at ~850 W/m².",
      "recommended_action": "Inspect for tree growth or new obstructions along the south-western edge of the array."
    }
  ]
}
```

### `GET /diagnostics/alerts`
Query parameters: `status` (`ACTIVE`, `RESOLVED`, `ALL`), `severity`.

---

## 4. Loss Estimation

### `GET /loss-estimation/summary`
Returns cumulative energy and financial impact of detected abnormalities over a period.

**Response `200 OK`:**
```json
{
  "period": "LAST_30_DAYS",
  "expected_energy_kwh": 540.0,
  "actual_energy_kwh": 472.5,
  "total_lost_energy_kwh": 67.5,
  "loss_percentage": 12.5,
  "financial_loss": 12.15,
  "currency": "USD",
  "fault_breakdown": [
    { "category": "SOILING", "lost_kwh": 42.0, "cost": 7.56 },
    { "category": "PARTIAL_SHADING", "lost_kwh": 25.5, "cost": 4.59 }
  ]
}
```

---

## 5. Vision Inspection

### `POST /vision/inspect`
Multipart form upload of panel photograph.

**Request:** `file` (Image: JPEG, PNG, WEBP), `system_id` (Integer).

**Response `200 OK`:**
```json
{
  "inspection_id": 42,
  "filename": "panel_scan_01.jpg",
  "detected_anomaly": "SOILING",
  "confidence": 0.88,
  "details": {
    "uniformity_score": 0.62,
    "contrast_variance": 0.41,
    "thermal_gradient_abnormal": false
  },
  "maintenance_guidance": "Surface accumulation detected. A surface clean using soft brushes and demineralized water is recommended to restore ~8-12% yield."
}
```
