"""Integration tests for SolarMind Repository layer."""

from datetime import date, datetime, timezone
import pytest
from sqlalchemy.orm import Session

from app.repositories import (
    alert_repository,
    analytics_repository,
    diagnosis_repository,
    inverter_repository,
    photo_inspection_repository,
    plant_repository,
    pv_asset_repository,
    telemetry_repository,
    work_order_repository,
)
from app.schemas import (
    AlertCreate,
    DiagnosisCreate,
    InverterCreate,
    PhotoInspectionCreate,
    PlantCreate,
    PlantUpdate,
    PVAssetCreate,
    TelemetryCreate,
    WorkOrderCreate,
)


def test_plant_repository_crud_and_filters(db_session: Session):
    """Test PlantRepository create, get, list_with_filters, update, and delete."""
    create_payload = PlantCreate(
        name="Sonoran Solar Park",
        location="Casa Grande, AZ",
        timezone="America/Phoenix",
        latitude=32.8795,
        longitude=-111.7573,
        system_type="Single-String Commercial Rooftop",
        installed_capacity_kwp=75.0,
        tariff_rate_inr=8.20,
        status="NORMAL",
    )
    plant = plant_repository.create(db_session, obj_in=create_payload)
    assert plant.id is not None
    assert plant.name == "Sonoran Solar Park"

    # Fetch by ID
    retrieved = plant_repository.get(db_session, plant.id)
    assert retrieved is not None
    assert retrieved.location == "Casa Grande, AZ"

    # Search by name filter
    results = plant_repository.list_with_filters(db_session, search="Sonoran")
    assert len(results) == 1
    assert results[0].id == plant.id

    # Filter count
    count = plant_repository.count_with_filters(db_session, status="NORMAL")
    assert count >= 1

    # Update
    updated = plant_repository.update(
        db_session,
        db_obj=plant,
        obj_in=PlantUpdate(name="Sonoran Solar Park Extended", installed_capacity_kwp=85.0),
    )
    assert updated.name == "Sonoran Solar Park Extended"
    assert updated.installed_capacity_kwp == 85.0

    # Delete
    deleted = plant_repository.delete(db_session, id=plant.id)
    assert deleted is not None
    assert plant_repository.get(db_session, plant.id) is None


def test_inverter_repository_operations(db_session: Session):
    """Test InverterRepository operations and serial lookup."""
    plant = plant_repository.create(
        db_session,
        obj_in=PlantCreate(name="Site Inverter Test", location="NV", installed_capacity_kwp=50.0),
    )

    inv_payload = InverterCreate(
        id="INV-REPO-01",
        plant_id=plant.id,
        serial_number="SERIAL-REPO-99",
        manufacturer="Fronius",
        model="Symo 50.0",
        firmware_version="v2.01",
        rated_ac_power_kw=50.0,
    )
    inv = inverter_repository.create(db_session, obj_in=inv_payload)
    assert inv.id == "INV-REPO-01"

    # Lookup by unique serial number
    found = inverter_repository.get_by_serial(db_session, "SERIAL-REPO-99")
    assert found is not None
    assert found.id == "INV-REPO-01"

    # List by plant
    inverters = inverter_repository.list_by_plant(db_session, plant_id=plant.id)
    assert len(inverters) == 1

    # Update last telemetry
    now = datetime.now(timezone.utc)
    inverter_repository.update_last_telemetry(db_session, inv.id, now)
    assert inv.last_telemetry_at is not None


def test_pv_asset_repository_operations(db_session: Session):
    """Test PVAssetRepository create and listing by inverter."""
    plant = plant_repository.create(
        db_session,
        obj_in=PlantCreate(name="Site PVA Test", location="CA", installed_capacity_kwp=10.0),
    )
    inv = inverter_repository.create(
        db_session,
        obj_in=InverterCreate(
            id="INV-PVA-01",
            plant_id=plant.id,
            serial_number="PVA-SN-01",
            manufacturer="SMA",
            model="STP",
            rated_ac_power_kw=10.0,
        ),
    )

    pva_payload = PVAssetCreate(
        id="PVA-STR-01",
        inverter_id=inv.id,
        asset_type="STRING",
        identifier="String 1",
        capacity_kwp=5.0,
        panel_count=12,
        tilt_deg=20.0,
    )
    pva = pv_asset_repository.create(db_session, obj_in=pva_payload)
    assert pva.id == "PVA-STR-01"

    assets = pv_asset_repository.list_by_inverter(db_session, inverter_id=inv.id)
    assert len(assets) == 1

    found = pv_asset_repository.get_by_inverter_and_identifier(db_session, inv.id, "String 1")
    assert found is not None
    assert found.capacity_kwp == 5.0


def test_telemetry_repository_batch_and_range_queries(db_session: Session):
    """Test TelemetryRepository batch ingestion and time-range queries."""
    plant = plant_repository.create(
        db_session,
        obj_in=PlantCreate(name="Site Tel Test", location="AZ", installed_capacity_kwp=10.0),
    )
    inv = inverter_repository.create(
        db_session,
        obj_in=InverterCreate(
            id="INV-TEL-01",
            plant_id=plant.id,
            serial_number="TEL-SN-01",
            manufacturer="SMA",
            model="STP",
            rated_ac_power_kw=10.0,
        ),
    )

    t1 = datetime(2026, 10, 9, 8, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 10, 9, 9, 0, 0, tzinfo=timezone.utc)
    t3 = datetime(2026, 10, 9, 10, 0, 0, tzinfo=timezone.utc)

    records = [
        TelemetryCreate(inverter_id=inv.id, timestamp=t1, p_ac=2.0, daily_yield_kwh=2.0),
        TelemetryCreate(inverter_id=inv.id, timestamp=t2, p_ac=4.5, daily_yield_kwh=6.5),
        TelemetryCreate(inverter_id=inv.id, timestamp=t3, p_ac=5.0, daily_yield_kwh=11.5),
    ]
    created = telemetry_repository.create_batch(db_session, records=records)
    assert len(created) == 3

    # Latest record query
    latest = telemetry_repository.get_latest_by_inverter(db_session, inv.id)
    assert latest is not None
    assert latest.timestamp == t3
    assert latest.p_ac == 5.0

    # Range query between t1 and t2
    window = telemetry_repository.query_range(
        db_session,
        inverter_id=inv.id,
        start_time=t1,
        end_time=t2,
    )
    assert len(window) == 2


def test_diagnosis_repository_filtering_and_details(db_session: Session):
    """Test DiagnosisRepository multi-parameter filtering and eager detail loading."""
    plant = plant_repository.create(
        db_session,
        obj_in=PlantCreate(name="Diag Test Site", location="CA", installed_capacity_kwp=20.0),
    )

    diag_payload = DiagnosisCreate(
        id="DIAG-REPO-01",
        plant_id=plant.id,
        fault_class="STRING_OPEN_CIRCUIT",
        fault_title="String Open Circuit Fault",
        severity="HIGH",
        status="ACTIVE",
        probable_cause="Blown DC fuse",
        root_cause_summary="Open circuit on String 1",
        estimated_lost_energy_kwh=15.0,
        financial_deficit_inr=112.50,
    )
    diag = diagnosis_repository.create(db_session, obj_in=diag_payload)
    assert diag.id == "DIAG-REPO-01"

    # Filter by fault_class and severity
    results = diagnosis_repository.list_with_filters(
        db_session,
        fault_class="STRING_OPEN_CIRCUIT",
        severity="HIGH",
    )
    assert len(results) >= 1

    # Count
    count = diagnosis_repository.count_with_filters(db_session, plant_id=plant.id)
    assert count == 1


def test_photo_inspection_repository_pending_queue(db_session: Session):
    """Test PhotoInspectionRepository and pending inspection queue retrieval."""
    plant = plant_repository.create(
        db_session,
        obj_in=PlantCreate(name="Photo Repo Site", location="AZ", installed_capacity_kwp=15.0),
    )

    now = datetime.now(timezone.utc)
    photo_payload = PhotoInspectionCreate(
        id="PHOTO-REPO-01",
        plant_id=plant.id,
        image_path="uploads/inspections/test.jpg",
        uploaded_at=now,
    )
    photo = photo_inspection_repository.create(db_session, obj_in=photo_payload)
    assert photo.processing_status == "PENDING"

    pending = photo_inspection_repository.get_pending_inspections(db_session, limit=5)
    assert len(pending) >= 1
    assert any(p.id == "PHOTO-REPO-01" for p in pending)


def test_work_order_repository_filters_and_diagnosis(db_session: Session):
    """Test WorkOrderRepository filtering by technician, status, and priority."""
    plant = plant_repository.create(
        db_session,
        obj_in=PlantCreate(name="WO Repo Site", location="CA", installed_capacity_kwp=15.0),
    )

    wo_payload = WorkOrderCreate(
        id="WO-REPO-01",
        plant_id=plant.id,
        title="Replace Combiner Fuse",
        priority="HIGH",
        assigned_to="Tech-Alex",
        scheduled_date=date(2026, 10, 15),
        status="ASSIGNED",
    )
    wo = work_order_repository.create(db_session, obj_in=wo_payload)
    assert wo.id == "WO-REPO-01"

    filtered = work_order_repository.list_with_filters(db_session, assigned_to="Tech-Alex", status="ASSIGNED")
    assert len(filtered) == 1
    assert filtered[0].title == "Replace Combiner Fuse"


def test_alert_repository_acknowledgement_and_resolution(db_session: Session):
    """Test AlertRepository create, filtering, acknowledgement, and resolution."""
    plant = plant_repository.create(
        db_session,
        obj_in=PlantCreate(name="Alert Repo Site", location="NV", installed_capacity_kwp=15.0),
    )

    alert_payload = AlertCreate(
        id="ALT-REPO-01",
        plant_id=plant.id,
        severity="CRITICAL",
        code="FAULT_INVERTER_OFFLINE",
        source="INVERTER_EVENT",
        message="Inverter communication lost.",
        status="ACTIVE",
    )
    alert = alert_repository.create(db_session, obj_in=alert_payload)
    assert alert.acknowledged is False
    assert alert.status == "ACTIVE"

    # Acknowledge
    now = datetime.now(timezone.utc)
    ack_alert = alert_repository.acknowledge_alert(
        db_session,
        alert_id=alert.id,
        acknowledged_by="operator@solarmind.io",
        acknowledged_at=now,
    )
    assert ack_alert is not None
    assert ack_alert.acknowledged is True
    assert ack_alert.acknowledged_by == "operator@solarmind.io"

    # Resolve
    resolved = alert_repository.resolve_alert(
        db_session,
        alert_id=alert.id,
        resolved_at=now,
    )
    assert resolved is not None
    assert resolved.status == "RESOLVED"


def test_analytics_repository_dashboard_summary(db_session: Session):
    """Test AnalyticsRepository computing dashboard summary metrics."""
    plant = plant_repository.create(
        db_session,
        obj_in=PlantCreate(name="Analytics Site", location="CA", installed_capacity_kwp=50.0),
    )

    start_time = datetime(2026, 10, 1, 0, 0, 0, tzinfo=timezone.utc)
    end_time = datetime(2026, 10, 10, 23, 59, 59, tzinfo=timezone.utc)

    summary = analytics_repository.get_dashboard_summary(
        db_session,
        plant_id=plant.id,
        start_time=start_time,
        end_time=end_time,
    )
    assert summary.plant_id == plant.id
    assert summary.total_actual_generation_kwh >= 0.0
    assert summary.maintenance_sla is not None
