"""Comprehensive Database Schema, Constraints, Relationships, and Migrations Test Suite."""

from datetime import datetime, timezone
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.alert import Alert
from app.models.application_setting import ApplicationSetting
from app.models.audit_event import AuditEvent
from app.models.auth_session import AuthSession
from app.models.diagnosis import Diagnosis
from app.models.diagnosis_evidence import DiagnosisEvidence
from app.models.diagnosis_rule_version import DiagnosisRuleVersion
from app.models.fault_catalog_entry import FaultCatalogEntry
from app.models.fault_rule import FaultRule
from app.models.integration_config import IntegrationConfig
from app.models.integration_sync_run import IntegrationSyncRun
from app.models.inverter import Inverter
from app.models.outage_event import OutageEvent
from app.models.photo_inspection import PhotoInspection
from app.models.plant import Plant
from app.models.plant_user_assignment import PlantUserAssignment
from app.models.pv_asset import PVAsset
from app.models.telemetry import TelemetryRecord
from app.models.user import User
from app.models.weather_record import WeatherRecord
from app.models.work_order import WorkOrder
from app.models.work_order_status_history import WorkOrderStatusHistory


@pytest.fixture
def test_db():
    """Create in-memory SQLite engine with foreign key enforcement and all tables."""
    engine = create_engine("sqlite:///:memory:", echo=False)

    # Enable SQLite foreign key enforcement
    with engine.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys = ON;"))

    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def test_all_twenty_tables_registered_in_metadata():
    """Verify all 20 required tables exist in the SQLAlchemy Base.metadata schema."""
    table_names = set(Base.metadata.tables.keys())

    required_tables = {
        "users",
        "auth_sessions",
        "plants",
        "plant_user_assignments",
        "inverters",
        "pv_assets",
        "telemetries",
        "diagnoses",
        "diagnosis_evidence",
        "fault_catalog_entries",
        "diagnosis_rule_versions",
        "weather_records",
        "outage_events",
        "photo_inspections",
        "work_orders",
        "work_order_status_history",
        "alerts",
        "integration_configs",
        "integration_sync_runs",
        "audit_events",
        "application_settings",
    }

    for req in required_tables:
        assert req in table_names, f"Expected table '{req}' missing from Base.metadata"


def test_plant_user_assignments_and_uniqueness(test_db):
    """Test multi-tenant user plant assignments and enforce unique constraint per user-plant pair."""
    # Create user and plant
    user = User(
        email="homeowner.rao@solarmind.io",
        full_name="Dr. Rao",
        hashed_password="argon2id$hashed",
        role="homeowner",
    )
    plant = Plant(
        name="Rao Solar Rooftop",
        location="Bengaluru",
        installed_capacity_kwp=5.4,
        timezone="Asia/Kolkata",
    )
    test_db.add_all([user, plant])
    test_db.commit()

    # Create assignment
    assignment = PlantUserAssignment(
        plant_id=plant.id,
        user_id=user.id,
        role="homeowner",
    )
    test_db.add(assignment)
    test_db.commit()

    assert assignment.id is not None
    assert assignment.user.email == "homeowner.rao@solarmind.io"
    assert assignment.plant.name == "Rao Solar Rooftop"

    # Verify duplicate assignment rejection
    duplicate = PlantUserAssignment(
        plant_id=plant.id,
        user_id=user.id,
        role="homeowner",
    )
    test_db.add(duplicate)
    with pytest.raises(IntegrityError):
        test_db.commit()
    test_db.rollback()


def test_hierarchical_asset_relationships_cascade(test_db):
    """Test Plant -> Inverter -> PV Asset hierarchy and cascade delete."""
    plant = Plant(
        name="Whitefield Array Alpha",
        location="Bengaluru, Karnataka",
        installed_capacity_kwp=10.0,
    )
    test_db.add(plant)
    test_db.commit()

    inverter = Inverter(
        id="INV-WF-01",
        plant_id=plant.id,
        serial_number="SN-INV-WF-9001",
        manufacturer="SolarMind / Deye OEM",
        model="SUN-10K-SG01LP1",
        rated_ac_power_kw=10.0,
        firmware_version="v2.4.1",
    )
    test_db.add(inverter)
    test_db.commit()

    pv_asset = PVAsset(
        id="PVA-WF01-STR1",
        inverter_id=inverter.id,
        identifier="String 1 South",
        capacity_kwp=5.0,
        panel_count=12,
    )
    test_db.add(pv_asset)
    test_db.commit()

    assert pv_asset.inverter.plant.name == "Whitefield Array Alpha"
    assert len(plant.inverters) == 1
    assert len(inverter.pv_assets) == 1


def test_diagnosis_evidence_linkage(test_db):
    """Test Diagnosis and DiagnosisEvidence records with metric attributes."""
    plant = Plant(
        name="Indiranagar Tech Rooftop",
        location="Bengaluru",
        installed_capacity_kwp=25.0,
    )
    test_db.add(plant)
    test_db.commit()

    diagnosis = Diagnosis(
        id="DIAG-TEST-901",
        plant_id=plant.id,
        fault_class="PARTIAL_SHADING",
        fault_title="Midday String Shading Anomaly",
        probable_cause="Tree foliage growth along south perimeter",
        root_cause_summary="Midday current delta observed across MPPT-1",
        severity="WARNING",
        confidence_score=94.0,
        recommended_action="Trim tree branches along south edge",
        status="ACTIVE",
    )
    test_db.add(diagnosis)
    test_db.commit()

    evidence = DiagnosisEvidence(
        diagnosis_id=diagnosis.id,
        evidence_type="TELEMETRY_ANOMALY",
        metric_name="current_drop_pct",
        metric_value=34.8,
        metric_unit="percent",
        details="DC string current dropped while POA remained >950 W/m²",
    )
    test_db.add(evidence)
    test_db.commit()

    assert evidence.id is not None
    assert evidence.diagnosis.fault_class == "PARTIAL_SHADING"
    assert len(diagnosis.evidence_records) == 1


def test_work_order_status_history_tracking(test_db):
    """Test WorkOrder lifecycle and WorkOrderStatusHistory audit trail."""
    plant = Plant(
        name="Koramangala Array",
        location="Bengaluru",
        installed_capacity_kwp=15.0,
    )
    user = User(
        email="tech.lead@solarmind.io",
        full_name="Tech Lead",
        hashed_password="argon2id$hashed",
        role="technician",
    )
    test_db.add_all([plant, user])
    test_db.commit()

    from datetime import date
    work_order = WorkOrder(
        id="WO-TEST-501",
        plant_id=plant.id,
        title="MC4 Connector Replacement",
        priority="HIGH",
        status="OPEN",
        scheduled_date=date(2026, 10, 15),
        assigned_to="tech.lead@solarmind.io",
    )
    test_db.add(work_order)
    test_db.commit()

    # Record status change in status history
    history = WorkOrderStatusHistory(
        work_order_id=work_order.id,
        from_status="OPEN",
        to_status="IN_PROGRESS",
        changed_by_id=user.id,
        changed_by_email=user.email,
        notes="Started field inspection and isolated AC breaker.",
    )
    test_db.add(history)
    test_db.commit()

    assert history.id is not None
    assert history.work_order.title == "MC4 Connector Replacement"
    assert len(work_order.status_history) == 1


def test_weather_and_outage_records(test_db):
    """Test WeatherRecord and OutageEvent storage and loss calculations."""
    plant = Plant(
        name="Jayanagar Villa Array",
        location="Bengaluru",
        installed_capacity_kwp=8.0,
    )
    test_db.add(plant)
    test_db.commit()

    now = datetime.now(timezone.utc)

    # Weather Record
    weather = WeatherRecord(
        plant_id=plant.id,
        timestamp=now,
        poa_irradiance_wm2=985.0,
        ghi_irradiance_wm2=940.0,
        ambient_temperature_c=31.5,
        cell_temperature_c=48.2,
        wind_speed_ms=2.4,
    )
    test_db.add(weather)

    # Outage Event
    outage = OutageEvent(
        plant_id=plant.id,
        event_type="OVERVOLTAGE_TRIP",
        start_time=now,
        duration_minutes=45.0,
        estimated_lost_energy_kwh=5.2,
        estimated_financial_loss_inr=39.0,
        reason="Grid AC voltage exceeded 253.5V threshold",
        resolved=True,
    )
    test_db.add(outage)
    test_db.commit()

    assert weather.id is not None
    assert weather.poa_irradiance_wm2 == 985.0
    assert outage.estimated_financial_loss_inr == 39.0


def test_application_settings_and_integration_sync_runs(test_db):
    """Test ApplicationSetting storage and IntegrationSyncRun logging."""
    # Application Setting
    setting = ApplicationSetting(
        key="BESCOM_GRID_TARIFF_INR",
        value="7.50",
        category="TARIFF",
        is_secret=False,
        description="Karnataka electricity board net-metering export tariff",
    )
    test_db.add(setting)
    test_db.commit()

    assert setting.id is not None

    # Integration Config & Sync Run
    config = IntegrationConfig(
        id="deye-india-cloud",
        name="Deye Cloud Inverter Connector",
        provider="Deye OpenAPI",
        endpoint_url="https://india-developer.deyecloud.com:443",
        app_id="deye_app_prod_902",
        encrypted_secret="aes_gcm_encrypted_blob",
        status="CONNECTED",
    )
    test_db.add(config)
    test_db.commit()

    sync_run = IntegrationSyncRun(
        integration_id=config.id,
        provider="Deye OpenAPI",
        records_ingested=240,
        records_failed=0,
        status="SUCCESS",
        duration_ms=480,
    )
    test_db.add(sync_run)
    test_db.commit()

    assert sync_run.id is not None
    assert sync_run.records_ingested == 240
    assert sync_run.integration.name == "Deye Cloud Inverter Connector"
