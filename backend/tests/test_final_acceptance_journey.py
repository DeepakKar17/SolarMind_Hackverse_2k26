"""
SolarMind Final Acceptance End-to-End User Journey Test Suite
Validates the complete 12-step operational user workflow against the real FastAPI backend.
"""

import io
import pytest
from starlette.testclient import TestClient
from app.main import create_app
from app.db.session import get_db, SessionLocal
from app.core.config import settings


@pytest.fixture
def app_client():
    app = create_app()
    with TestClient(app) as client:
        yield client


def test_final_acceptance_user_journey(app_client):
    client = app_client

    # Step 1: Health & Readiness
    health_res = client.get("/api/v1/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "healthy"

    readiness_res = client.get("/api/v1/readiness")
    assert readiness_res.status_code == 200
    assert readiness_res.json()["status"] == "ready"

    # Step 2: Authentication
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "admin@solarmind.io", "password": "SolarAdmin#2026!"},
    )
    assert login_res.status_code == 200
    auth_data = login_res.json()
    token = auth_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Step 3: Open Dashboard & View Plant List
    plants_res = client.get("/api/v1/plants", headers=headers)
    assert plants_res.status_code == 200
    plants_data = plants_res.json()
    assert "items" in plants_data
    assert plants_data["total"] >= 1
    plant_id = plants_data["items"][0]["id"]

    # Step 4: View Plant & Inverter Details
    plant_detail = client.get(f"/api/v1/plants/{plant_id}", headers=headers)
    assert plant_detail.status_code == 200
    plant = plant_detail.json()
    assert plant["id"] == plant_id

    inverters_res = client.get(f"/api/v1/inverters?plant_id={plant_id}", headers=headers)
    assert inverters_res.status_code == 200
    inverters_data = inverters_res.json()
    assert inverters_data["total"] >= 1
    inverter_id = inverters_data["items"][0]["id"]

    inverter_detail = client.get(f"/api/v1/inverters/{inverter_id}", headers=headers)
    assert inverter_detail.status_code == 200
    assert inverter_detail.json()["id"] == inverter_id

    # Step 5: Inspect Generation & Telemetry History
    telemetry_history = client.get(
        f"/api/v1/telemetry/history?plant_id={plant_id}&inverter_id={inverter_id}&limit=50",
        headers=headers,
    )
    assert telemetry_history.status_code == 200
    tel_data = telemetry_history.json()
    assert isinstance(tel_data, list) or isinstance(tel_data, dict)

    # Step 6: Submit Diagnosis Request Using Evidence
    analyze_payload = {
        "plant_id": plant_id,
        "inverter_id": inverter_id,
    }
    diagnosis_res = client.post("/api/v1/diagnoses/analyze", json=analyze_payload, headers=headers)
    assert diagnosis_res.status_code == 200
    diag_result = diagnosis_res.json()
    assert "diagnoses" in diag_result or "plant_id" in diag_result

    # Why-low evaluation with explicit timestamp
    why_low_payload = {
        "plant_id": plant_id,
        "inverter_id": inverter_id,
        "lookback_hours": 24,
    }
    why_low_res = client.post("/api/v1/diagnoses/why-low", json=why_low_payload, headers=headers)
    assert why_low_res.status_code == 200
    why_low_data = why_low_res.json()
    assert "candidate_cause" in why_low_data or "is_fault" in why_low_data

    # Step 7: Fault Code Knowledge Lookup & Unknown Code Handling
    lookup_res = client.get("/api/v1/diagnoses/fault-code/lookup?manufacturer=Deye&code=F01", headers=headers)
    assert lookup_res.status_code == 200
    assert lookup_res.json()["is_known"] is True
    assert lookup_res.json()["status"] == "VERIFIED_OEM_MAPPING"

    unknown_res = client.get("/api/v1/diagnoses/fault-code/lookup?manufacturer=UnknownBrand&code=ERR999", headers=headers)
    assert unknown_res.status_code == 200
    assert unknown_res.json()["is_known"] is False
    assert unknown_res.json()["status"] == "UNRESOLVED_UNKNOWN_CODE"

    # Step 8: Upload a Photo and Check Processing Status & Model Configuration
    from PIL import Image
    test_img = Image.new("RGB", (120, 120), color="blue")
    img_buf = io.BytesIO()
    test_img.save(img_buf, format="JPEG")
    valid_jpeg_bytes = img_buf.getvalue()

    upload_res = client.post(
        "/api/v1/photos/upload-file",
        files={"file": ("test_panel.jpg", io.BytesIO(valid_jpeg_bytes), "image/jpeg")},
        data={"plant_id": plant_id, "inverter_id": inverter_id, "notes": "Acceptance test photo"},
        headers=headers,
    )
    assert upload_res.status_code in [200, 201]
    photo_data = upload_res.json()
    photo_id = photo_data["id"]

    # Verify status
    status_res = client.get(f"/api/v1/photos/{photo_id}/status", headers=headers)
    assert status_res.status_code == 200

    # Request analysis
    analyze_res = client.post(f"/api/v1/photos/{photo_id}/analyze", headers=headers)
    assert analyze_res.status_code == 200
    analysis = analyze_res.json()
    # If no physical vision weights are present, status is NOT_CONFIGURED without synthesizing fake detections
    assert analysis["status"].upper() in ["NOT_CONFIGURED", "COMPLETED", "QUEUED", "PROCESSING"]

    # Step 9: Create a Maintenance Work Order
    from datetime import date
    import uuid
    unique_wo_id = f"WO-ACC-{uuid.uuid4().hex[:6].upper()}"
    wo_create_payload = {
        "id": unique_wo_id,
        "plant_id": plant_id,
        "inverter_id": inverter_id,
        "title": "Acceptance Test Maintenance Order",
        "instructions": "Panel string soiling and leaf obstruction clean-up.",
        "priority": "HIGH",
        "assigned_to": "Field Tech Arjun",
        "scheduled_date": date.today().isoformat(),
    }
    wo_res = client.post("/api/v1/work-orders", json=wo_create_payload, headers=headers)
    assert wo_res.status_code in [200, 201]
    wo_data = wo_res.json()
    wo_id = wo_data["id"]

    # Step 10: Update Work Order Status and Submit Inspection
    update_res = client.patch(
        f"/api/v1/work-orders/{wo_id}",
        json={"status": "IN_PROGRESS", "notes": "Technician deployed on site."},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "IN_PROGRESS"

    inspection_res = client.post(
        f"/api/v1/work-orders/{wo_id}/inspection",
        json={
            "fault_observations": "Cleaned thick layer of dust from panels 1-6.",
            "repair_action": "Washed modules with demineralized water and cleared leaf obstruction.",
            "mark_completed": True,
        },
        headers=headers,
    )
    assert inspection_res.status_code == 200

    # Verify Work Order post-repair recovery
    verify_res = client.post(
        f"/api/v1/work-orders/{wo_id}/verify",
        json={"verification_window_hours": 4, "auto_close_on_success": False},
        headers=headers,
    )
    assert verify_res.status_code == 200
    assert "verification_status" in verify_res.json()

    # Step 11: View Alerts and Analytics
    alerts_res = client.get("/api/v1/alerts", headers=headers)
    assert alerts_res.status_code == 200

    analytics_summary = client.get(f"/api/v1/analytics/summary?plant_id={plant_id}", headers=headers)
    assert analytics_summary.status_code == 200
    analytics_gen = client.get(f"/api/v1/analytics/generation?plant_id={plant_id}&interval=daily", headers=headers)
    assert analytics_gen.status_code == 200
    analytics_loss = client.get(f"/api/v1/analytics/energy-loss?plant_id={plant_id}", headers=headers)
    assert analytics_loss.status_code == 200

    # Step 12: Restart / New Client Instance to Verify Database Persistence
    app_restarted = create_app()
    with TestClient(app_restarted) as new_client:
        persisted_wo = new_client.get(f"/api/v1/work-orders/{wo_id}", headers=headers)
        assert persisted_wo.status_code == 200
        assert persisted_wo.json()["id"] == wo_id
        assert persisted_wo.json()["status"] in ["COMPLETED_PENDING_VERIFICATION", "IN_PROGRESS", "RESOLVED", "CLOSED"]
        assert persisted_wo.json()["title"] == "Acceptance Test Maintenance Order"

        persisted_photo = new_client.get(f"/api/v1/photos/{photo_id}", headers=headers)
        assert persisted_photo.status_code == 200
        assert persisted_photo.json()["id"] == photo_id
