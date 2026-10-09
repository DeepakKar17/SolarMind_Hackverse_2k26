"""Unit and integration tests for SolarMind database infrastructure."""

from datetime import date, datetime, timezone
import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.health import check_db_readiness
from app.db.init_db import seed_development_data
from app.db.session import get_db_context
from app.models import (
    Plant,
    Inverter,
    Telemetry,
    Diagnosis,
    Alert,
    WorkOrder,
)


def test_plant_creation_and_query(db_session: Session):
    """Verifies creating a plant and querying it with all attributes."""
    plant = Plant(
        name="Test Solar Site",
        location="Mojave Desert, CA",
        latitude=35.011,
        longitude=-115.473,
        installed_capacity_kwp=50.0,
        tariff_rate_inr=7.50,
        system_type="Single-String Residential Rooftop",
        status="NORMAL",
    )
    db_session.add(plant)
    db_session.flush()

    retrieved = db_session.get(Plant, plant.id)
    assert retrieved is not None
    assert retrieved.name == "Test Solar Site"
    assert retrieved.installed_capacity_kwp == 50.0
    assert retrieved.status == "NORMAL"
    assert retrieved.created_at is not None
    assert retrieved.updated_at is not None


def test_inverter_foreign_key_relationship(db_session: Session):
    """Verifies inverter relates properly to plant and enforces foreign key integrity."""
    plant = Plant(
        name="Desert Array Two",
        location="Las Vegas, NV",
        installed_capacity_kwp=25.0,
    )
    db_session.add(plant)
    db_session.flush()

    inverter = Inverter(
        id="INV-TEST-01",
        plant_id=plant.id,
        serial_number="TEST-SN-9999",
        manufacturer="SMA",
        model="Tripower 25k",
        rated_ac_power_kw=25.0,
        mppt_count=1,
        strings_count=1,
    )
    db_session.add(inverter)
    db_session.flush()

    assert inverter.plant.name == "Desert Array Two"
    assert len(plant.inverters) == 1
    assert plant.inverters[0].serial_number == "TEST-SN-9999"


def test_inverter_unique_serial_number_constraint(db_session: Session):
    """Verifies that duplicate inverter serial numbers raise an IntegrityError."""
    plant = Plant(name="Site Three", location="Reno, NV", installed_capacity_kwp=10.0)
    db_session.add(plant)
    db_session.flush()

    inv1 = Inverter(
        id="TEST-INV-10",
        plant_id=plant.id,
        serial_number="DUPLICATE-SN-01",
        manufacturer="Fronius",
        model="Symo 10k",
        rated_ac_power_kw=10.0,
    )
    db_session.add(inv1)
    db_session.flush()

    inv2 = Inverter(
        id="TEST-INV-11",
        plant_id=plant.id,
        serial_number="DUPLICATE-SN-01",
        manufacturer="Fronius",
        model="Symo 10k",
        rated_ac_power_kw=10.0,
    )
    db_session.add(inv2)

    with pytest.raises(IntegrityError):
        db_session.flush()

    db_session.rollback()


def test_cascade_delete_plant_removes_inverters_and_telemetry(db_session: Session):
    """Verifies that deleting a plant cascades to child inverters, telemetries, and diagnoses."""
    plant = Plant(name="Cascade Plant", location="Yuma, AZ", installed_capacity_kwp=7.5)
    db_session.add(plant)
    db_session.flush()

    inverter = Inverter(
        id="INV-CASCADE",
        plant_id=plant.id,
        serial_number="CASCADE-SN-1",
        manufacturer="Enphase",
        model="IQ8",
        rated_ac_power_kw=5.0,
    )
    db_session.add(inverter)
    db_session.flush()

    telemetry = Telemetry(
        inverter_id=inverter.id,
        timestamp=datetime.now(timezone.utc),
        p_ac=4.8,
    )
    db_session.add(telemetry)
    db_session.flush()

    # Verify telemetry exists
    assert db_session.query(Telemetry).filter_by(inverter_id="INV-CASCADE").count() == 1

    # Delete plant
    plant_id = plant.id
    db_session.delete(plant)
    db_session.flush()

    # Verify plant, inverter, and telemetry were cascaded
    assert db_session.get(Plant, plant_id) is None
    assert db_session.get(Inverter, "INV-CASCADE") is None
    assert db_session.query(Telemetry).filter_by(inverter_id="INV-CASCADE").count() == 0


def test_transaction_multi_step_write_and_rollback(db_session: Session):
    """Verifies that multi-step operations roll back completely when an intermediate step fails."""
    plant = Plant(name="Tx Site", location="Flagstaff, AZ", installed_capacity_kwp=5.0)
    db_session.add(plant)
    db_session.flush()
    plant_id = plant.id

    # Start multi-step insert with nested savepoint
    nested = db_session.begin_nested()
    try:
        inv1 = Inverter(
            id="INV-TX-1",
            plant_id=plant_id,
            serial_number="TX-SN-1",
            manufacturer="SMA",
            model="STP",
            rated_ac_power_kw=10.0,
        )
        db_session.add(inv1)
        db_session.flush()

        # Deliberately violate FK constraint by pointing to non-existent plant id
        inv_bad = Inverter(
            id="INV-TX-BAD",
            plant_id=999999,
            serial_number="TX-SN-BAD",
            manufacturer="SMA",
            model="STP",
            rated_ac_power_kw=10.0,
        )
        db_session.add(inv_bad)
        db_session.flush()
        nested.commit()
    except Exception:
        nested.rollback()

    # The first inverter must NOT be present due to atomic rollback
    assert db_session.get(Inverter, "INV-TX-1") is None
    assert db_session.get(Inverter, "INV-TX-BAD") is None
    # The parent plant remains intact
    assert db_session.get(Plant, plant_id) is not None


def test_full_domain_model_creation(db_session: Session):
    """Verifies full lifecycle of Plant, Inverter, Telemetry, Diagnosis, Alert, and WorkOrder."""
    now = datetime.now(timezone.utc)

    plant = Plant(
        name="End to End Solar Farm",
        location="Tucson, AZ",
        installed_capacity_kwp=10.0,
        system_type="Single-String Residential Rooftop",
        status="WARNING",
    )
    db_session.add(plant)
    db_session.flush()

    inverter = Inverter(
        id="INV-E2E-01",
        plant_id=plant.id,
        serial_number="E2E-SN-12345",
        manufacturer="Huawei",
        model="SUN2000-5KTL",
        rated_ac_power_kw=5.0,
        mppt_count=1,
        strings_count=1,
        status="WARNING",
    )
    db_session.add(inverter)
    db_session.flush()

    telemetry = Telemetry(
        inverter_id=inverter.id,
        timestamp=now,
        v_dc=360.0,
        i_dc=7.0,
        p_dc=2.52,
        v_ac=230.0,
        i_ac=10.8,
        p_ac=2.48,
        temperature_c=52.3,
        poa_irradiance_wm2=920.0,
        daily_yield_kwh=18.0,
        total_yield_kwh=5400.0,
    )
    db_session.add(telemetry)
    db_session.flush()

    diagnosis = Diagnosis(
        id="DIAG-E2E",
        plant_id=plant.id,
        inverter_id=inverter.id,
        affected_string="String 1",
        fault_class="PARTIAL_SHADING",
        fault_title="Partial Shading Anomaly",
        severity="WARNING",
        engine_type="ML_CLASSIFIER",
        status="ACTIVE",
        confidence_score=0.88,
        probable_cause="Localized shadow or vegetation encroachment causing a dip in String 1 current.",
        root_cause_summary="Obstruction detected in afternoon profile.",
        estimated_lost_energy_kwh=12.0,
        financial_deficit_inr=90.00,
    )
    db_session.add(diagnosis)
    db_session.flush()

    alert = Alert(
        id="ALT-E2E",
        plant_id=plant.id,
        inverter_id=inverter.id,
        related_diagnosis_id=diagnosis.id,
        severity="WARNING",
        code="WARN_SHADING_DETECTED",
        message="Current mismatch detected on String 1.",
        status="ACTIVE",
    )
    db_session.add(alert)
    db_session.flush()

    work_order = WorkOrder(
        id="WO-E2E",
        plant_id=plant.id,
        diagnosis_id=diagnosis.id,
        title="Inspect Array Obstructions",
        priority="MEDIUM",
        assigned_to="Jordan Vance",
        scheduled_date=date(2026, 10, 20),
        status="PENDING",
    )
    db_session.add(work_order)
    db_session.flush()

    # Query and assert relationships
    queried_diag = db_session.get(Diagnosis, "DIAG-E2E")
    assert queried_diag is not None
    assert queried_diag.plant.id == plant.id
    assert queried_diag.inverter.id == "INV-E2E-01"
    assert len(queried_diag.alerts) == 1
    assert queried_diag.alerts[0].code == "WARN_SHADING_DETECTED"
    assert len(queried_diag.work_orders) == 1
    assert queried_diag.work_orders[0].title == "Inspect Array Obstructions"


def test_idempotent_seeding(db_session: Session):
    """Verifies that seed_development_data seeds once and does not duplicate records when re-run."""
    # Run first seed
    seeded_first = seed_development_data(db_session)
    assert seeded_first is True

    plant_count_after_first = db_session.query(Plant).count()
    assert plant_count_after_first >= 3

    # Run second seed on existing data
    seeded_second = seed_development_data(db_session)
    assert seeded_second is False

    plant_count_after_second = db_session.query(Plant).count()
    assert plant_count_after_first == plant_count_after_second


def test_db_readiness_probe_healthy(db_session: Session):
    """Verifies the check_db_readiness probe execution against an active session."""
    probe = check_db_readiness(db_session)
    assert probe["status"] == "healthy"
    assert probe["healthy"] is True
    assert probe["latency_ms"] >= 0.0
    assert "sqlite" in probe["dialect"]


def test_persistence_across_sessions():
    """Verifies that data committed in one session persists to disk and is readable by independent sessions."""
    plant_name = f"Persistent Site {datetime.now(timezone.utc).timestamp()}"

    # Session 1: Write and commit
    with get_db_context() as session1:
        plant = Plant(
            name=plant_name,
            location="Persisted Valley, NV",
            installed_capacity_kwp=15.0,
            status="NORMAL",
        )
        session1.add(plant)
        session1.commit()
        created_id = plant.id

    # Session 2: Read in new session context
    with get_db_context() as session2:
        retrieved = session2.get(Plant, created_id)
        assert retrieved is not None
        assert retrieved.name == plant_name
        assert retrieved.installed_capacity_kwp == 15.0

        # Clean up
        session2.delete(retrieved)
        session2.commit()

    # Session 3: Verify clean deletion
    with get_db_context() as session3:
        assert session3.get(Plant, created_id) is None


def test_get_db_context_automatic_rollback_on_error():
    """Verifies that get_db_context rolls back transactions when an unhandled exception occurs."""
    with pytest.raises(ValueError, match="Simulated application failure"):
        with get_db_context() as session:
            plant = Plant(
                name="Rollback Plant",
                location="Transient Area",
                installed_capacity_kwp=1.0,
            )
            session.add(plant)
            session.flush()
            raise ValueError("Simulated application failure")

    with get_db_context() as session:
        queried = session.query(Plant).filter_by(name="Rollback Plant").first()
        assert queried is None

