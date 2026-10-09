"""
Unit and integration tests for SolarMind Geo Photo AI & Image Inspection Pipeline.

Validates:
- Binary multipart image upload with MIME verification and Pillow integrity decoding
- Storage in controlled directory with server-side unique filename (no absolute path leaks)
- Rejection of path traversal attempts, null bytes, and non-image / corrupted payloads
- Rejection of oversized files exceeding configured size bounds
- Graceful handling of missing GPS coordinates and optional metadata
- Status inquiry (PENDING, ANALYZING, COMPLETED, NOT_CONFIGURED, FAILED)
- Unconfigured vision model returns status='NOT_CONFIGURED' without synthesizing fake detections
- Configured vision model execution with structured visual detections (soiling, shading, cracks)
- Distinction between visible surface defects and electrical testing requirements
- Safe file streaming via GET /api/v1/photos/{photo_id}/file
"""

from datetime import datetime, timezone
import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.plant import Plant
from app.models.user import User
from app.services.auth_service import auth_service
from app.services.security import hash_password
from app.services.photo_storage_service import (
    FileSizeExceededError,
    InvalidImageFormatError,
    SecurityPathTraversalError,
    photo_storage_service,
)
from app.services.vision_pipeline_service import (
    ConfiguredMockVisionProvider,
    UnconfiguredVisionProvider,
    vision_pipeline_service,
)


@pytest.fixture
def auth_cookies(db_session: Session):
    """Creates a seeded admin user, test plant, and active session token."""
    from datetime import timedelta
    from app.repositories.auth_session import auth_session_repository
    from app.services.security import generate_secure_token

    pw_hash = hash_password("Password123!")
    user = User(
        email="photo_admin@solarmind.io",
        username="photo_admin",
        hashed_password=pw_hash,
        full_name="Photo Admin",
        role="admin",
        is_active=True,
        is_verified=True,
    )
    plant = Plant(
        id=1,
        name="Test Solar Plant 1",
        system_type="ROOFTOP",
        installed_capacity_kwp=50.0,
        tariff_rate_inr=7.50,
        location="Bhubaneswar",
        timezone="Asia/Kolkata",
    )
    from app.models.inverter import Inverter

    inverter = Inverter(
        id="INV-01",
        plant_id=1,
        serial_number="SN-INV-01",
        manufacturer="Deye",
        model="SUN-80K-G03",
        rated_ac_power_kw=80.0,
        status="NORMAL",
    )
    db_session.add(user)
    db_session.add(plant)
    db_session.add(inverter)
    db_session.flush()

    raw_token = generate_secure_token(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=1)
    auth_session_repository.create_session(
        db=db_session,
        user_id=user.id,
        raw_token=raw_token,
        token_type="session",
        expires_at=expires_at,
    )
    db_session.commit()
    return {settings.SESSION_COOKIE_NAME: raw_token}


def create_test_image_bytes(format: str = "JPEG", size: tuple = (120, 120), color: str = "blue") -> bytes:
    """Generates valid in-memory image bytes for test uploads."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


# -----------------------------------------------------------------------------
# 1. Storage & Validation Unit Tests
# -----------------------------------------------------------------------------

def test_photo_storage_valid_image():
    """Validates and stores standard JPEG image safely."""
    data = create_test_image_bytes("JPEG")
    rel_path, orig_name, size, mime = photo_storage_service.validate_and_store_photo(
        file_bytes=data,
        original_filename="roof_panel_01.jpg",
        content_type="image/jpeg",
    )
    assert orig_name == "roof_panel_01.jpg"
    assert mime == "image/jpeg"
    assert size == len(data)
    assert "uploads/photos/photo_" in rel_path
    assert not rel_path.startswith("C:") and not rel_path.startswith("/")

    # Verify read back
    read_bytes, read_mime = photo_storage_service.read_photo_bytes(rel_path)
    assert read_bytes == data
    assert read_mime == "image/jpeg"


def test_photo_storage_rejects_path_traversal():
    """Rejects malicious path traversal attempts in filename."""
    data = create_test_image_bytes("PNG")
    with pytest.raises(SecurityPathTraversalError):
        photo_storage_service.validate_and_store_photo(
            file_bytes=data,
            original_filename="../../etc/passwd.png",
        )

    with pytest.raises(SecurityPathTraversalError):
        photo_storage_service.validate_and_store_photo(
            file_bytes=data,
            original_filename="something\0evil.jpg",
        )


def test_photo_storage_rejects_corrupted_or_fake_image():
    """Rejects plaintext files disguised with an image extension."""
    fake_data = b"<?php echo 'malicious'; ?>"
    with pytest.raises(InvalidImageFormatError):
        photo_storage_service.validate_and_store_photo(
            file_bytes=fake_data,
            original_filename="innocent.jpg",
            content_type="image/jpeg",
        )


def test_photo_storage_rejects_oversized_file():
    """Rejects payloads exceeding configured size limit."""
    fake_huge = b"A" * (settings.MAX_PHOTO_SIZE_BYTES + 1024)
    with pytest.raises(FileSizeExceededError):
        photo_storage_service.validate_and_store_photo(
            file_bytes=fake_huge,
            original_filename="huge.jpg",
        )


# -----------------------------------------------------------------------------
# 2. Vision Pipeline & Unconfigured Model Behavior
# -----------------------------------------------------------------------------

def test_unconfigured_vision_provider_returns_not_configured():
    """Rule: Unconfigured vision model returns NOT_CONFIGURED without synthetic detections."""
    vision_pipeline_service.set_provider(UnconfiguredVisionProvider())

    data = create_test_image_bytes("JPEG")
    res = vision_pipeline_service.analyze_photo_bytes(data, "panel.jpg")

    assert res.status == "NOT_CONFIGURED"
    assert res.detections == []  # MUST NOT fabricate fake defects
    assert res.model_name is None
    assert "No trained computer vision model" in res.summary


def test_configured_vision_provider_detects_defects_and_separates_electrical():
    """Configured provider detects soiling, cracks, and notes electrical testing requirement."""
    vision_pipeline_service.set_provider(ConfiguredMockVisionProvider())

    # Soiling test
    soil_data = create_test_image_bytes("JPEG", color="brown")
    soil_res = vision_pipeline_service.analyze_photo_bytes(soil_data, "dusty_soiled_panel.jpg")
    assert soil_res.status == "COMPLETED"
    assert len(soil_res.detections) >= 1
    assert soil_res.detections[0].defect_class == "SOILING"
    assert soil_res.detections[0].is_visual_observation_only is True

    # Crack test
    crack_data = create_test_image_bytes("JPEG")
    crack_res = vision_pipeline_service.analyze_photo_bytes(crack_data, "cracked_module_corner.jpg")
    assert crack_res.status == "COMPLETED"
    assert any(d.defect_class == "SURFACE_CRACK" for d in crack_res.detections)
    assert crack_res.electrical_testing_required is True  # Physical electrical test required for cracks


# -----------------------------------------------------------------------------
# 3. REST API Upload, Inspection & Analysis Integration
# -----------------------------------------------------------------------------

def test_api_upload_photo_file_and_retrieve_metadata(client, auth_cookies):
    """POST /api/v1/photos/upload-file with valid multipart form data."""
    data = create_test_image_bytes("JPEG", size=(200, 200), color="darkblue")

    files = {"file": ("inspection_solar.jpg", data, "image/jpeg")}
    form = {
        "plant_id": "1",
        "inverter_id": "INV-01",
        "latitude": "20.2961",
        "longitude": "85.8245",
        "notes": "Routine visual inspection of Array 1",
    }

    response = client.post("/api/v1/photos/upload-file", files=files, data=form, cookies=auth_cookies)
    assert response.status_code == 201
    photo = response.json()

    assert photo["id"].startswith("PHOTO-")
    assert photo["plant_id"] == 1
    assert photo["inverter_id"] == "INV-01"
    assert photo["latitude"] == 20.2961
    assert photo["longitude"] == 85.8245
    assert photo["processing_status"] == "PENDING"
    assert "uploads/photos/photo_" in photo["image_path"]
    # Path MUST NOT be absolute filesystem path
    assert not photo["image_path"].startswith("C:")

    photo_id = photo["id"]

    # 1. Retrieve Detail
    get_res = client.get(f"/api/v1/photos/{photo_id}", cookies=auth_cookies)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == photo_id

    # 2. Retrieve Status
    status_res = client.get(f"/api/v1/photos/{photo_id}/status", cookies=auth_cookies)
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["photo_id"] == photo_id
    assert status_data["processing_status"] == "PENDING"
    assert status_data["is_analyzed"] is False

    # 3. Stream File Binary
    file_res = client.get(f"/api/v1/photos/{photo_id}/file", cookies=auth_cookies)
    assert file_res.status_code == 200
    assert file_res.headers["content-type"] == "image/jpeg"
    assert len(file_res.content) == len(data)

    # 4. Trigger Analysis (Unconfigured Mode)
    vision_pipeline_service.set_provider(UnconfiguredVisionProvider())
    analyze_res = client.post(f"/api/v1/photos/{photo_id}/analyze", cookies=auth_cookies)
    assert analyze_res.status_code == 200
    res_data = analyze_res.json()
    assert res_data["status"] == "NOT_CONFIGURED"

    # 5. Retrieve Results
    results_res = client.get(f"/api/v1/photos/{photo_id}/results", cookies=auth_cookies)
    assert results_res.status_code == 200
    assert results_res.json()["status"] == "NOT_CONFIGURED"


def test_api_upload_photo_without_gps_coordinates(client, auth_cookies):
    """Handles missing optional GPS coordinates gracefully."""
    data = create_test_image_bytes("PNG")
    files = {"file": ("no_gps_panel.png", data, "image/png")}
    form = {"plant_id": "1"}

    response = client.post("/api/v1/photos/upload-file", files=files, data=form, cookies=auth_cookies)
    assert response.status_code == 201
    photo = response.json()
    assert photo["latitude"] is None
    assert photo["longitude"] is None


def test_api_upload_rejects_corrupted_file(client, auth_cookies):
    """Rejects corrupted file payload with 400 Bad Request."""
    corrupted_data = b"NOT_A_VALID_IMAGE_BYTES"
    files = {"file": ("corrupt.jpg", corrupted_data, "image/jpeg")}
    form = {"plant_id": "1"}

    response = client.post("/api/v1/photos/upload-file", files=files, data=form, cookies=auth_cookies)
    assert response.status_code == 400
    assert "Corrupted or invalid image content" in response.json()["detail"]


def test_api_upload_rejects_path_traversal(client, auth_cookies):
    """Rejects path traversal in uploaded filename."""
    data = create_test_image_bytes("JPEG")
    files = {"file": ("../../etc/shadow.jpg", data, "image/jpeg")}
    form = {"plant_id": "1"}

    response = client.post("/api/v1/photos/upload-file", files=files, data=form, cookies=auth_cookies)
    assert response.status_code == 400
    assert "Path traversal" in response.json()["detail"]
