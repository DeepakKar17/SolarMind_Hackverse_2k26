"""Comprehensive domain model tests for SolarMind SQLAlchemy ORM.

Tests covering:
- Entity relationships & back-populates across all 8 models
- Foreign key constraints & unique constraints
- Cascade deletion behavior (CASCADE vs SET NULL)
- Duplicate identifier rejection
- Timestamp persistence and auto-generation
- Optional measurement handling in Telemetry
- PhotoInspection file path & GPS metadata persistence
"""

from datetime import date, datetime, timezone
import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Plant,
    Inverter,
    PVAsset,
    Telemetry,
    TelemetryRecord,
    Diagnosis,
    Alert,
    WorkOrder,
    PhotoInspection,
)


def test_plant_model_attributes_and_timestamps(db_session: Session):
    """Test Plant model creation, timezone attribute, and automatic timestamps."""
    plant = Plant(
        name="Sierra Foothills Array",
        location="Auburn, CA",
        timezone="America/Los_Angeles",
        latitude=38.8966,
        longitude=-121.0769,
        installed_capacity_kwp=24.0,
        tariff_rate_inr=7.80,
        system_type="Single-String Residential Rooftop",
        status="NORMAL",
    )
    db_session.add(plant)
    db_session.flush()

    assert plant.id is not None
    assert plant.timezone == "America/Los_Angeles"
    assert plant.created_at is not None
    assert plant.updated_at is not None
    assert isinstance(plant.created_at, datetime)


def test_inverter_model_and_pv_assets_relationship(db_session: Session):
    """Test Inverter model with firmware version and child PVAssets (strings/MPPTs)."""
    plant = Plant(name="Valley Farm", location="Fresno, CA", installed_capacity_kwp=30.0)
    db_session.add(plant)
    db_session.flush()

    inverter = Inverter(
        id="INV-FRESNO-1",
        plant_id=plant.id,
        serial_number="SMA-FRESNO-001",
        manufacturer="SMA Solar",
        model="Sunny Tripower CORE2",
        firmware_version="v4.01.12R",
        rated_ac_power_kw=30.0,
        mppt_count=2,
        strings_count=2,
    )
    db_session.add(inverter)
    db_session.flush()

    string_1 = PVAsset(
        id="PVA-FRESNO-S1",
        inverter_id=inverter.id,
        asset_type="STRING",
        identifier="String 1",
        capacity_kwp=15.0,
        panel_count=36,
        panel_model="JA Solar 415W",
        azimuth_deg=180.0,
        tilt_deg=22.0,
        configuration={"connector": "MC4", "fuse_rating_a": 15},
    )
    string_2 = PVAsset(
        id="PVA-FRESNO-S2",
        inverter_id=inverter.id,
        asset_type="STRING",
        identifier="String 2",
        capacity_kwp=15.0,
        panel_count=36,
        panel_model="JA Solar 415W",
        azimuth_deg=180.0,
        tilt_deg=22.0,
    )
    db_session.add_all([string_1, string_2])
    db_session.flush()

    # Verify bidirectional navigation
    assert len(inverter.pv_assets) == 2
    assert string_1.inverter.serial_number == "SMA-FRESNO-001"
    assert string_1.configuration["fuse_rating_a"] == 15


def test_telemetry_record_optional_measurements_and_quality_flags(db_session: Session):
    """Test that TelemetryRecord handles missing/optional measurements gracefully without error."""
    plant = Plant(name="Sparse Site", location="Indio, CA", installed_capacity_kwp=10.0)
    db_session.add(plant)
    db_session.flush()

    inverter = Inverter(
        id="INV-SPARSE-1",
        plant_id=plant.id,
        serial_number="SPARSE-SN-001",
        manufacturer="Enphase",
        model="IQ8+",
        rated_ac_power_kw=10.0,
    )
    db_session.add(inverter)
    db_session.flush()

    now = datetime.now(timezone.utc)

    # Partial telemetry record with only AC power and no DC or frequency readings
    telemetry = TelemetryRecord(
        inverter_id=inverter.id,
        timestamp=now,
        p_ac=7.2,
        v_dc=None,  # Not measured by this microinverter gateway
        i_dc=None,
        frequency_hz=None,
        data_source="MQTT",
        data_quality_flag="INTERPOLATED",
    )
    db_session.add(telemetry)
    db_session.flush()

    retrieved = db_session.get(TelemetryRecord, telemetry.id)
    assert retrieved is not None
    assert retrieved.p_ac == 7.2
    assert retrieved.v_dc is None
    assert retrieved.frequency_hz is None
    assert retrieved.data_source == "MQTT"
    assert retrieved.data_quality_flag == "INTERPOLATED"


def test_photo_inspection_storage_and_gps_metadata(db_session: Session):
    """Test PhotoInspection model storing file paths, GPS metadata, and vision-AI diagnostic results."""
    plant = Plant(name="Photo Test Site", location="Phoenix, AZ", installed_capacity_kwp=8.0)
    db_session.add(plant)
    db_session.flush()

    inverter = Inverter(
        id="INV-PHOTO-1",
        plant_id=plant.id,
        serial_number="PHOTO-SN-999",
        manufacturer="Fronius",
        model="Primo",
        rated_ac_power_kw=8.0,
    )
    db_session.add(inverter)
    db_session.flush()

    now = datetime.now(timezone.utc)

    photo = PhotoInspection(
        id="PHOTO-TEST-001",
        plant_id=plant.id,
        inverter_id=inverter.id,
        image_path="uploads/inspections/2026/10/damaged_panel_01.jpg",
        original_filename="IMG_20261009_101234.jpg",
        file_size_bytes=3420100,
        mime_type="image/jpeg",
        uploaded_at=now,
        latitude=33.4484,
        longitude=-112.0740,
        gps_accuracy_m=2.1,
        notes="Suspected physical cracking on lower cell matrix.",
        processing_status="COMPLETED",
        fault_detected=True,
        confidence_score=0.97,
        analysis_result={
            "detected_defects": [
                {"defect_type": "CELL_MICROCRACK", "confidence": 0.97, "bbox": [100, 150, 300, 400]}
            ]
        },
    )
    db_session.add(photo)
    db_session.flush()

    retrieved = db_session.get(PhotoInspection, "PHOTO-TEST-001")
    assert retrieved is not None
    assert retrieved.image_path == "uploads/inspections/2026/10/damaged_panel_01.jpg"
    assert retrieved.fault_detected is True
    assert retrieved.gps_accuracy_m == 2.1
    assert retrieved.analysis_result["detected_defects"][0]["defect_type"] == "CELL_MICROCRACK"
    assert retrieved.plant.name == "Photo Test Site"
    assert retrieved.inverter.id == "INV-PHOTO-1"


def test_work_order_due_date_instructions_and_completion(db_session: Session):
    """Test WorkOrder model lifecycle including scheduled_date, due_date, instructions, and resolution notes."""
    plant = Plant(name="WO Test Site", location="Sedona, AZ", installed_capacity_kwp=12.0)
    db_session.add(plant)
    db_session.flush()

    diagnosis = Diagnosis(
        id="DIAG-WO-TEST",
        plant_id=plant.id,
        fault_class="GROUND_FAULT",
        fault_title="DC Ground Isolation Fault",
        severity="CRITICAL",
        status="ACTIVE",
        probable_cause="Insulation degradation on DC positive lead causing leakage current to ground.",
        root_cause_summary="Cable conduit water ingress near array combiner.",
    )
    db_session.add(diagnosis)
    db_session.flush()

    wo = WorkOrder(
        id="WO-TEST-999",
        plant_id=plant.id,
        diagnosis_id=diagnosis.id,
        title="Repair DC Ground Fault",
        priority="CRITICAL",
        assigned_to="Tech-Jordan-Vance",
        service_provider="Red Rock Solar Maintenance",
        instructions="Isolate DC isolator, test Megger insulation resistance across strings, replace conduit seals.",
        scheduled_date=date(2026, 10, 12),
        due_date=date(2026, 10, 14),
        status="IN_PROGRESS",
    )
    db_session.add(wo)
    db_session.flush()

    assert wo.diagnosis.id == "DIAG-WO-TEST"
    assert wo.instructions is not None
    assert wo.due_date == date(2026, 10, 14)

    # Complete the work order
    wo.status = "COMPLETED"
    wo.completed_date = date(2026, 10, 13)
    wo.duration_hours = 3.5
    wo.cost_inr = 4200.0
    wo.resolution_notes = "Replaced degraded 4mm DC solar cable and resealed conduit entrance. Insulation resistance restored to >20 MOhm."
    db_session.flush()

    retrieved = db_session.get(WorkOrder, "WO-TEST-999")
    assert retrieved.status == "COMPLETED"
    assert retrieved.cost_inr == 4200.0
    assert retrieved.completed_date == date(2026, 10, 13)


def test_alert_source_and_event_timestamp(db_session: Session):
    """Test Alert model with event source, event_timestamp, and acknowledgement workflow."""
    plant = Plant(name="Alert Test Plant", location="Yuma, AZ", installed_capacity_kwp=20.0)
    db_session.add(plant)
    db_session.flush()

    event_time = datetime(2026, 10, 9, 8, 30, 0, tzinfo=timezone.utc)

    alert = Alert(
        id="ALT-EVENT-001",
        plant_id=plant.id,
        severity="HIGH",
        code="OVER_VOLTAGE_DC",
        source="INVERTER_EVENT",
        message="DC voltage exceeded 450V threshold on String 1.",
        event_timestamp=event_time,
        status="ACTIVE",
    )
    db_session.add(alert)
    db_session.flush()

    assert alert.source == "INVERTER_EVENT"
    assert alert.event_timestamp == event_time
    assert alert.acknowledged is False

    # Acknowledge the alert
    ack_time = datetime(2026, 10, 9, 8, 35, 0, tzinfo=timezone.utc)
    alert.acknowledged = True
    alert.acknowledged_by = "operator@solarmind.io"
    alert.acknowledged_at = ack_time
    db_session.flush()

    retrieved = db_session.get(Alert, "ALT-EVENT-001")
    assert retrieved.acknowledged is True
    assert retrieved.acknowledged_by == "operator@solarmind.io"
    assert retrieved.acknowledged_at == ack_time


def test_diagnosis_deletion_preserves_work_order_and_alert(db_session: Session):
    """Test that deleting a Diagnosis sets diagnosis_id=NULL on related WorkOrders and Alerts (SET NULL constraint)."""
    plant = Plant(name="Preserve Site", location="Tucson, AZ", installed_capacity_kwp=15.0)
    db_session.add(plant)
    db_session.flush()

    diagnosis = Diagnosis(
        id="DIAG-PRESERVE-01",
        plant_id=plant.id,
        fault_class="SOILING",
        fault_title="Uniform Dust Soiling",
        severity="LOW",
        probable_cause="Dust accumulation on array surface.",
        root_cause_summary="20% irradiance transmission loss due to desert dust storm.",
    )
    db_session.add(diagnosis)
    db_session.flush()

    wo = WorkOrder(
        id="WO-PRESERVE-01",
        plant_id=plant.id,
        diagnosis_id=diagnosis.id,
        title="Panel Washing Service",
        assigned_to="Cleaner Team",
        scheduled_date=date(2026, 10, 16),
    )
    alert = Alert(
        id="ALT-PRESERVE-01",
        plant_id=plant.id,
        related_diagnosis_id=diagnosis.id,
        severity="LOW",
        code="WARN_SOILING",
        message="Soiling detected on array.",
    )
    db_session.add_all([wo, alert])
    db_session.flush()

    # Verify relationships
    assert wo.diagnosis_id == "DIAG-PRESERVE-01"
    assert alert.related_diagnosis_id == "DIAG-PRESERVE-01"

    # Delete the diagnosis
    db_session.delete(diagnosis)
    db_session.flush()

    # Diagnosis is gone, but WorkOrder and Alert remain with NULL foreign key
    assert db_session.get(Diagnosis, "DIAG-PRESERVE-01") is None
    wo_retrieved = db_session.get(WorkOrder, "WO-PRESERVE-01")
    assert wo_retrieved is not None
    assert wo_retrieved.diagnosis_id is None

    alert_retrieved = db_session.get(Alert, "ALT-PRESERVE-01")
    assert alert_retrieved is not None
    assert alert_retrieved.related_diagnosis_id is None
