"""Unit tests for Pydantic request and response schemas."""

from datetime import date, datetime, timezone
import pytest
from pydantic import ValidationError

from app.schemas import (
    AlertAcknowledge,
    AlertCreate,
    AlertResponse,
    AnalyticsTimeseriesPoint,
    DiagnosisCreate,
    DiagnosisResponse,
    DiagnosisUpdate,
    InverterCreate,
    InverterResponse,
    PaginatedResponse,
    PaginationParams,
    PhotoInspectionCreate,
    PhotoInspectionResponse,
    PlantCreate,
    PlantResponse,
    PlantUpdate,
    PVAssetCreate,
    PVAssetResponse,
    TelemetryBatchCreate,
    TelemetryCreate,
    TelemetryResponse,
    WorkOrderCreate,
    WorkOrderResponse,
    WorkOrderUpdate,
)


def test_plant_create_valid_and_serialization():
    """Test valid PlantCreate payload parses correctly."""
    data = {
        "name": "Mojave Solar Site",
        "location": "Barstow, CA",
        "timezone": "America/Los_Angeles",
        "latitude": 34.8958,
        "longitude": -117.0173,
        "system_type": "Single-String Residential Rooftop",
        "installed_capacity_kwp": 15.5,
        "tariff_rate_inr": 7.50,
        "status": "NORMAL",
        "is_active": True,
    }
    schema = PlantCreate(**data)
    assert schema.name == "Mojave Solar Site"
    assert schema.installed_capacity_kwp == 15.5
    assert schema.latitude == 34.8958


def test_plant_create_invalid_capacity_and_coordinates():
    """Test numeric range validation for Plant capacity and coordinates."""
    # Capacity must be > 0
    with pytest.raises(ValidationError) as exc:
        PlantCreate(
            name="Invalid Site",
            location="Nowhere",
            installed_capacity_kwp=0.0,
        )
    assert "installed_capacity_kwp" in str(exc.value)

    # Latitude must be <= 90
    with pytest.raises(ValidationError) as exc:
        PlantCreate(
            name="Invalid Site",
            location="Nowhere",
            installed_capacity_kwp=10.0,
            latitude=95.0,
        )
    assert "latitude" in str(exc.value)

    # Longitude must be >= -180
    with pytest.raises(ValidationError) as exc:
        PlantCreate(
            name="Invalid Site",
            location="Nowhere",
            installed_capacity_kwp=10.0,
            longitude=-185.0,
        )
    assert "longitude" in str(exc.value)


def test_plant_forbid_extra_fields():
    """Test that unexpected extra fields are rejected on create and update."""
    with pytest.raises(ValidationError) as exc:
        PlantCreate(
            name="Extra Fields Site",
            location="City",
            installed_capacity_kwp=10.0,
            unexpected_server_field="malicious_payload",  # Extra field
        )
    assert "extra_forbidden" in str(exc.value)


def test_inverter_create_validation():
    """Test InverterCreate validation and range checks."""
    valid = InverterCreate(
        id="INV-001",
        plant_id=1,
        serial_number="SMA-12345",
        manufacturer="SMA Solar",
        model="Sunny Tripower 5.0",
        rated_ac_power_kw=5.0,
        mppt_count=2,
        strings_count=2,
    )
    assert valid.id == "INV-001"
    assert valid.rated_ac_power_kw == 5.0

    # Negative power must fail
    with pytest.raises(ValidationError):
        InverterCreate(
            id="INV-002",
            plant_id=1,
            serial_number="SMA-12346",
            manufacturer="SMA Solar",
            model="Tripower",
            rated_ac_power_kw=-5.0,
        )


def test_pv_asset_create_validation():
    """Test PVAssetCreate validation including azimuth and tilt ranges."""
    valid = PVAssetCreate(
        id="PVA-INV01-STR1",
        inverter_id="INV-001",
        asset_type="STRING",
        identifier="String 1",
        capacity_kwp=4.2,
        azimuth_deg=180.0,
        tilt_deg=25.0,
    )
    assert valid.identifier == "String 1"

    # Tilt > 90 must fail
    with pytest.raises(ValidationError):
        PVAssetCreate(
            id="PVA-INV01-STR2",
            inverter_id="INV-001",
            asset_type="STRING",
            identifier="String 2",
            tilt_deg=95.0,
        )


def test_telemetry_create_optional_measurements():
    """Test TelemetryCreate handles sparse sensor readings as None without defaulting to 0."""
    now = datetime.now(timezone.utc)
    sparse = TelemetryCreate(
        inverter_id="INV-001",
        timestamp=now,
        p_ac=4.2,
        # v_dc, i_dc, frequency_hz omitted
    )
    assert sparse.p_ac == 4.2
    assert sparse.v_dc is None
    assert sparse.i_dc is None
    assert sparse.frequency_hz is None
    assert sparse.data_source == "SIMULATED"
    assert sparse.data_quality_flag == "VALID"


def test_telemetry_batch_create_validation():
    """Test TelemetryBatchCreate validation."""
    now = datetime.now(timezone.utc)
    batch = TelemetryBatchCreate(
        records=[
            TelemetryCreate(inverter_id="INV-001", timestamp=now, p_ac=4.2),
            TelemetryCreate(inverter_id="INV-002", timestamp=now, p_ac=3.8),
        ]
    )
    assert len(batch.records) == 2

    # Empty batch must fail
    with pytest.raises(ValidationError):
        TelemetryBatchCreate(records=[])


def test_diagnosis_confidence_score_range():
    """Test Diagnosis confidence score range constraint (0.0 to 1.0)."""
    valid = DiagnosisCreate(
        id="DIAG-001",
        plant_id=1,
        fault_class="STRING_OPEN_CIRCUIT",
        fault_title="String Disconnected",
        severity="HIGH",
        probable_cause="MC4 connector disconnected",
        root_cause_summary="Open circuit on DC bus",
        confidence_score=0.95,
    )
    assert valid.confidence_score == 0.95

    # Confidence score > 1.0 must fail
    with pytest.raises(ValidationError):
        DiagnosisCreate(
            id="DIAG-002",
            plant_id=1,
            fault_class="STRING_OPEN_CIRCUIT",
            fault_title="String Disconnected",
            probable_cause="Cause",
            root_cause_summary="Summary",
            confidence_score=1.5,
        )


def test_photo_inspection_create_validation():
    """Test PhotoInspectionCreate schema with GPS and metadata."""
    now = datetime.now(timezone.utc)
    photo = PhotoInspectionCreate(
        id="PHOTO-101",
        plant_id=1,
        image_path="uploads/inspections/photo_101.jpg",
        uploaded_at=now,
        latitude=34.0522,
        longitude=-118.2437,
        gps_accuracy_m=5.0,
        notes="Cell discoloration on module 4",
    )
    assert photo.image_path == "uploads/inspections/photo_101.jpg"
    assert photo.latitude == 34.0522


def test_work_order_schemas():
    """Test WorkOrderCreate and partial WorkOrderUpdate."""
    wo = WorkOrderCreate(
        id="WO-001",
        plant_id=1,
        title="Fuse Replacement",
        priority="HIGH",
        assigned_to="Alex Rivera",
        scheduled_date=date(2026, 10, 15),
    )
    assert wo.priority == "HIGH"

    update = WorkOrderUpdate(
        status="COMPLETED",
        completed_date=date(2026, 10, 15),
        cost_inr=1500.0,
        resolution_notes="Replaced blown 15A string fuse.",
    )
    assert update.status == "COMPLETED"
    assert update.title is None  # Partial update leaves omitted fields as None


def test_alert_acknowledge_schema():
    """Test AlertAcknowledge payload."""
    ack = AlertAcknowledge(acknowledged_by="admin@solarmind.io")
    assert ack.acknowledged_by == "admin@solarmind.io"

    with pytest.raises(ValidationError):
        AlertAcknowledge(acknowledged_by="")  # min_length=2


def test_pagination_params_and_response():
    """Test PaginationParams offset calculation and PaginatedResponse builder."""
    params = PaginationParams(page=3, page_size=20)
    assert params.offset == 40

    paginated = PaginatedResponse.create(
        items=["item1", "item2", "item3"],
        total=53,
        params=params,
    )
    assert paginated.total == 53
    assert paginated.page == 3
    assert paginated.page_size == 20
    assert paginated.pages == 3
    assert len(paginated.items) == 3
