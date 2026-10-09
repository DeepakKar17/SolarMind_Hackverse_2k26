"""Database initialization and development data seeding for SolarMind.

This module initializes schema tables (for local dev / testing) and populates
idempotent sample data if the database is unpopulated. It DOES NOT drop or recreate
existing tables to prevent accidental data loss.
"""

import logging
from datetime import date, datetime, timezone
from sqlalchemy.orm import Session
from app.db.base import Base
from app.db.session import engine, get_db_context
from app.models import (
    Plant,
    Inverter,
    PVAsset,
    Telemetry,
    Diagnosis,
    Alert,
    WorkOrder,
    PhotoInspection,
)

logger = logging.getLogger("solarmind.db.init")


def init_db() -> None:
    """Create tables if they do not exist (without dropping anything)."""
    logger.info("Verifying database schema initialization...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema verification completed.")


def seed_development_data(session: Session) -> bool:
    """Idempotently seed sample plants, inverters, pv assets, alerts, diagnoses, photo inspections, and work orders.

    Returns:
        bool: True if seeding was performed, False if database already contained data.
    """
    try:
        existing_plants = session.query(Plant).count()
        if existing_plants > 0:
            logger.info("Database already contains %d plants. Skipping seed.", existing_plants)
            return False
    except Exception as exc:
        logger.warning("Could not query existing plants for seeding: %s. Skipping seed.", exc)
        return False

    logger.info("Seeding initial development dataset for SolarMind...")

    # 1. Plants
    plant_1 = Plant(
        id=1,
        name="Solaria Alpha Solar Farm",
        location="Bakersfield, CA",
        timezone="America/Los_Angeles",
        latitude=35.3733,
        longitude=-119.0187,
        installed_capacity_kwp=12.5,
        tariff_rate_inr=7.50,
        system_type="Single-String Residential Rooftop",
        status="NORMAL",
        is_active=True,
    )

    plant_2 = Plant(
        id=2,
        name="Helios Commercial Rooftop",
        location="Phoenix, AZ",
        timezone="America/Phoenix",
        latitude=33.4484,
        longitude=-112.0740,
        installed_capacity_kwp=8.5,
        tariff_rate_inr=8.00,
        system_type="Single-String Commercial Rooftop",
        status="WARNING",
        is_active=True,
    )

    plant_3 = Plant(
        id=3,
        name="Verde Valley Solar Array",
        location="Cottonwood, AZ",
        timezone="America/Phoenix",
        latitude=34.7392,
        longitude=-112.0099,
        installed_capacity_kwp=6.0,
        tariff_rate_inr=7.20,
        system_type="Single-String Residential Ground",
        status="FAULT",
        is_active=True,
    )

    session.add_all([plant_1, plant_2, plant_3])
    session.flush()

    # 2. Inverters
    now_utc = datetime.now(timezone.utc)

    inv_1_1 = Inverter(
        id="INV-101",
        plant_id=plant_1.id,
        serial_number="SMA-STP-50000-8821",
        manufacturer="SMA Solar",
        model="Sunny Tripower 5kW",
        firmware_version="v3.12.04",
        rated_ac_power_kw=5.0,
        mppt_count=1,
        strings_count=1,
        status="NORMAL",
        last_telemetry_at=now_utc,
    )

    inv_1_2 = Inverter(
        id="INV-102",
        plant_id=plant_1.id,
        serial_number="SMA-STP-50000-8822",
        manufacturer="SMA Solar",
        model="Sunny Tripower 5kW",
        firmware_version="v3.12.04",
        rated_ac_power_kw=5.0,
        mppt_count=1,
        strings_count=1,
        status="WARNING",
        last_telemetry_at=now_utc,
    )

    inv_2_1 = Inverter(
        id="INV-201",
        plant_id=plant_2.id,
        serial_number="FRO-SYMO-8200-1102",
        manufacturer="Fronius",
        model="Primo 8.2-1",
        firmware_version="v1.18.2",
        rated_ac_power_kw=8.2,
        mppt_count=1,
        strings_count=1,
        status="FAULT",
        last_telemetry_at=now_utc,
    )

    session.add_all([inv_1_1, inv_1_2, inv_2_1])
    session.flush()

    # 3. PV Assets (Strings / MPPT channels)
    pva_1_1 = PVAsset(
        id="PVA-INV101-STR1",
        inverter_id=inv_1_1.id,
        asset_type="STRING",
        identifier="String 1",
        capacity_kwp=5.2,
        panel_count=13,
        panel_model="Canadian Solar HiKu 400W",
        azimuth_deg=180.0,
        tilt_deg=25.0,
        status="NORMAL",
    )

    pva_2_1 = PVAsset(
        id="PVA-INV201-STR1",
        inverter_id=inv_2_1.id,
        asset_type="STRING",
        identifier="String 1",
        capacity_kwp=8.5,
        panel_count=20,
        panel_model="JA Solar DeepBlue 425W",
        azimuth_deg=175.0,
        tilt_deg=30.0,
        status="FAULT",
    )

    session.add_all([pva_1_1, pva_2_1])
    session.flush()

    # 4. Telemetry records
    telemetry_1 = Telemetry(
        inverter_id=inv_1_1.id,
        pv_asset_id=pva_1_1.id,
        timestamp=now_utc,
        v_dc=380.5,
        i_dc=12.2,
        p_dc=4.64,
        v_ac=230.2,
        i_ac=19.8,
        p_ac=4.51,
        frequency_hz=50.01,
        temperature_c=48.5,
        ambient_temp_c=32.0,
        poa_irradiance_wm2=860.0,
        daily_yield_kwh=28.4,
        total_yield_kwh=14230.0,
        data_source="MODBUS",
        data_quality_flag="VALID",
    )

    session.add(telemetry_1)
    session.flush()

    # 5. Diagnosis
    diag_1 = Diagnosis(
        id="DIAG-401",
        plant_id=plant_2.id,
        inverter_id=inv_2_1.id,
        pv_asset_id=pva_2_1.id,
        affected_string="String 1",
        fault_class="STRING_OPEN_CIRCUIT",
        fault_title="String Open-Circuit Detected",
        severity="CRITICAL",
        engine_type="ML_CLASSIFIER",
        confidence_score=0.94,
        is_suspicion_only=False,
        has_insufficient_evidence=False,
        status="ACTIVE",
        evidence={
            "expected_current_a": 9.5,
            "measured_current_a": 0.0,
            "measured_voltage_v": 380.0,
        },
        estimated_lost_energy_kwh=18.5,
        cumulative_lost_energy_kwh=54.2,
        financial_deficit_inr=433.60,
        probable_cause="Zero current flow detected on String 1 despite normal open-circuit voltage (380V). Blown string fuse or disconnected MC4 connector.",
        root_cause_summary="DC side open-circuit between module #6 and inverter DC disconnect.",
        recommended_action="Inspect DC combiner fuse block and test MC4 connectors for physical disconnection.",
        detected_at=now_utc,
    )

    session.add(diag_1)
    session.flush()

    # 6. Alert
    alert_1 = Alert(
        id="ALT-901",
        plant_id=plant_2.id,
        inverter_id=inv_2_1.id,
        pv_asset_id=pva_2_1.id,
        string_id="String 1",
        severity="CRITICAL",
        code="FAULT_STRING_DISCONNECTED",
        source="RULE_ENGINE",
        message="String 1 is producing 0.0A under 860 W/m² irradiance.",
        status="ACTIVE",
        event_timestamp=now_utc,
        acknowledged=False,
        related_diagnosis_id=diag_1.id,
        estimated_power_loss_kw=4.1,
        estimated_daily_loss_kwh=18.5,
        actionable_guidance="Inspect DC combiner fuse block and test MC4 connectors for physical disconnection.",
    )

    session.add(alert_1)

    # 7. Work Order
    work_order_1 = WorkOrder(
        id="WO-801",
        plant_id=plant_2.id,
        inverter_id=inv_2_1.id,
        pv_asset_id=pva_2_1.id,
        diagnosis_id=diag_1.id,
        title="Repair Disconnected String on Inverter Primo-1",
        priority="HIGH",
        assigned_to="Alex Rivera",
        service_provider="Apex Solar Service",
        instructions="Inspect combiner box fuse, measure open-circuit DC voltage at each string junction, and replace damaged MC4 connector.",
        scheduled_date=date(2026, 10, 15),
        due_date=date(2026, 10, 18),
        cost_inr=2500.0,
        status="ASSIGNED",
        notes="Technician dispatch confirmed with customer.",
    )

    session.add(work_order_1)

    # 8. Photo Inspection
    photo_1 = PhotoInspection(
        id="PHOTO-501",
        plant_id=plant_2.id,
        inverter_id=inv_2_1.id,
        pv_asset_id=pva_2_1.id,
        diagnosis_id=diag_1.id,
        image_path="uploads/inspections/2026/plant2_string1_junction.jpg",
        original_filename="string1_junction.jpg",
        file_size_bytes=2458200,
        mime_type="image/jpeg",
        uploaded_at=now_utc,
        latitude=33.4484,
        longitude=-112.0740,
        gps_accuracy_m=3.5,
        notes="Photo of disconnected MC4 branch connector showing thermal scorching.",
        processing_status="COMPLETED",
        fault_detected=True,
        confidence_score=0.96,
        analysis_result={
            "detected_defects": [
                {"type": "BURNT_CONNECTOR", "bounding_box": [120, 340, 280, 490], "confidence": 0.96}
            ]
        },
    )

    session.add(photo_1)

    # 9. Initial Users (Admin & Operator)
    from app.services.security import hash_password
    from app.models.user import User

    existing_admin = session.query(User).filter(User.email == "admin@solarmind.io").first()
    if not existing_admin:
        admin_user = User(
            email="admin@solarmind.io",
            username="admin",
            full_name="SolarMind Administrator",
            hashed_password=hash_password("SolarAdmin#2026!"),
            role="admin",
            is_active=True,
            is_verified=True,
        )
        operator_user = User(
            email="operator@solarmind.io",
            username="operator",
            full_name="Solar Fleet Operator",
            hashed_password=hash_password("SolarMind#2026!"),
            role="operator",
            is_active=True,
            is_verified=True,
        )
        session.add_all([admin_user, operator_user])

    session.commit()
    logger.info("Initial development seed data and user accounts successfully created.")
    return True
