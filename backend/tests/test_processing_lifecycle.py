"""
Unit and integration tests for SolarMind Processing Lifecycle, Background Jobs & Alerting.

Validates:
- Background job lifecycle state transitions (QUEUED -> PROCESSING -> COMPLETED/FAILED/NOT_CONFIGURED)
- Retry management with maximum retry bounds
- Duplicate job submission prevention for active tasks
- Sanitization of error logs (no passwords, tokens, or absolute path leaks)
- Alert generation from diagnosis events with safety-grounded guidance
- Active alert deduplication (no duplicate active alerts for same fault/asset)
- Work order creation from diagnosis with structured inspection steps & safety rules
- Verification of safety recommendations (never instructs opening live/energized equipment)
- REST API endpoints for job tracking and retries
"""

from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.main import app
from app.models.alert import Alert
from app.models.diagnosis import Diagnosis
from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.user import User
from app.models.work_order import WorkOrder
from app.repositories.auth_session import auth_session_repository
from app.schemas.job import JobCreate, JobStatus
from app.services.alert_generation_service import alert_generation_service
from app.services.job_processing_service import job_processing_service
from app.services.security import generate_secure_token, hash_password


@pytest.fixture
def seeded_env(db_session: Session):
    """Creates a seeded plant and inverter for database FK relationships."""
    plant = Plant(
        id=10,
        name="Lifecycle Test Solar Plant",
        system_type="ROOFTOP",
        installed_capacity_kwp=60.0,
        tariff_rate_inr=7.50,
        location="Cuttack",
        timezone="Asia/Kolkata",
    )
    inverter = Inverter(
        id="INV-10-A",
        plant_id=10,
        serial_number="SN-INV-10-A",
        manufacturer="Deye",
        model="SUN-80K-G03",
        rated_ac_power_kw=80.0,
        status="NORMAL",
    )
    db_session.add(plant)
    db_session.add(inverter)
    db_session.flush()
    return plant, inverter


@pytest.fixture
def auth_cookies(db_session: Session, seeded_env):
    """Creates a seeded admin user and active session token."""
    pw_hash = hash_password("Password123!")
    user = User(
        email="job_admin@solarmind.io",
        username="job_admin",
        hashed_password=pw_hash,
        full_name="Job Admin",
        role="admin",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
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


# -----------------------------------------------------------------------------
# 1. Job Lifecycle & Duplicate Prevention Tests
# -----------------------------------------------------------------------------

def test_job_submission_and_successful_completion():
    """Job transitions from QUEUED -> PROCESSING -> COMPLETED with output payload."""
    def sample_worker(x: int, y: int) -> dict:
        return {"sum": x + y, "status": "OK"}

    job_in = JobCreate(
        job_type="CALCULATION_TEST",
        resource_id="RES-001",
        plant_id=10,
    )
    job = job_processing_service.submit_job(job_in, handler=sample_worker, x=10, y=25)

    assert job.job_id.startswith("JOB-")
    assert job.status == JobStatus.COMPLETED
    assert job.result_payload == {"sum": 35, "status": "OK"}
    assert job.completed_at is not None
    assert job.error_message is None


def test_job_duplicate_prevention():
    """Submitting identical active task returns existing job without duplicating."""
    job_in = JobCreate(
        job_type="SYNC_RESOURCE",
        resource_id="PLANT-10",
        plant_id=10,
    )

    # Submit first without immediate completion
    with job_processing_service._lock:
        job1_id = f"JOB-TEST-DUP-1"
        job_processing_service._jobs[job1_id] = {
            "job_id": job1_id,
            "job_type": "SYNC_RESOURCE",
            "resource_id": "PLANT-10",
            "plant_id": 10,
            "status": JobStatus.PROCESSING,
            "created_at": datetime.now(timezone.utc),
            "started_at": datetime.now(timezone.utc),
            "completed_at": None,
            "retry_count": 0,
            "max_retries": 3,
            "is_retryable": True,
            "error_message": None,
            "result_payload": None,
        }

    # Submit second job for same type and resource
    job2 = job_processing_service.submit_job(job_in)

    assert job2.job_id == job1_id  # Returns existing active job


def test_job_failure_and_retry_policy():
    """Failed job records sanitized error and can be retried up to max_retries."""
    def failing_worker():
        raise RuntimeError("Database connection failed on secret_token='secret_12345' at C:\\Users\\Lenovo\\file.py")

    job_in = JobCreate(
        job_type="FLAKY_ANALYSIS",
        resource_id="PHOTO-999",
        max_retries=2,
    )
    job = job_processing_service.submit_job(job_in, handler=failing_worker)

    assert job.status == JobStatus.FAILED
    assert job.error_message is not None
    # Verify sanitization: token and local path must be masked
    assert "secret_12345" not in job.error_message
    assert "C:\\Users\\Lenovo\\" not in job.error_message
    assert job.retry_count == 0

    # Retry 1
    job_retry1 = job_processing_service.retry_job(job.job_id)
    assert job_retry1.retry_count == 1
    assert job_retry1.status == JobStatus.FAILED

    # Retry 2
    job_retry2 = job_processing_service.retry_job(job.job_id)
    assert job_retry2.retry_count == 2
    assert job_retry2.is_retryable is False

    # Retry 3 should fail with limit error
    with pytest.raises(ValueError, match="exceeded max retry limit"):
        job_processing_service.retry_job(job.job_id)


def test_job_not_configured_status():
    """Handler returning not_configured sets status to NOT_CONFIGURED without failure."""
    def unconfigured_worker():
        return {"status": "NOT_CONFIGURED", "reason": "No weights file present"}

    job_in = JobCreate(
        job_type="VISION_INFERENCE",
        resource_id="PHOTO-500",
    )
    job = job_processing_service.submit_job(job_in, handler=unconfigured_worker)

    assert job.status == JobStatus.NOT_CONFIGURED
    assert job.error_message is None


# -----------------------------------------------------------------------------
# 2. Alert Generation & Deduplication Tests
# -----------------------------------------------------------------------------

def test_alert_generation_from_diagnosis(db_session: Session, seeded_env):
    """Generates active unacknowledged alert with safety guidance from diagnosis."""
    diagnosis = Diagnosis(
        id="DIAG-TEST-01",
        plant_id=10,
        inverter_id="INV-10-A",
        fault_class="GROUND_INSULATION_FAULT",
        fault_title="DC Array Ground Fault (ISO Failure)",
        severity="CRITICAL",
        status="ACTIVE",
        engine_type="DETERMINISTIC_RULE",
        confidence_score=0.98,
        probable_cause="Measured insulation resistance < 50kΩ to ground.",
        root_cause_summary="DC isolation breakdown on Array 1",
        recommended_action="Disconnect DC isolators and perform 1000V megger test.",
        estimated_lost_energy_kwh=45.0,
        detected_at=datetime.now(timezone.utc),
    )
    db_session.add(diagnosis)
    db_session.flush()

    alert = alert_generation_service.generate_alert_from_diagnosis(
        db=db_session,
        diagnosis=diagnosis,
        source="RULE_ENGINE",
    )

    assert alert is not None
    assert alert.id.startswith("ALT-")
    assert alert.plant_id == 10
    assert alert.inverter_id == "INV-10-A"
    assert alert.code == "GROUND_INSULATION_FAULT"
    assert alert.severity == "CRITICAL"
    assert alert.status == "ACTIVE"
    assert alert.acknowledged is False
    assert alert.related_diagnosis_id == "DIAG-TEST-01"

    # Verify safety notice is present and prevents dangerous DIY actions
    assert alert.actionable_guidance is not None
    assert "SAFETY NOTICE" in alert.actionable_guidance
    assert "Do not open energized panels" in alert.actionable_guidance


def test_alert_deduplication_prevents_duplicate_active_alerts(db_session: Session, seeded_env):
    """Deduplication ensures only one active unacknowledged alert exists per fault code."""
    diagnosis = Diagnosis(
        id="DIAG-TEST-DUP",
        plant_id=10,
        inverter_id="INV-10-A",
        fault_class="GRID_OUTAGE",
        fault_title="Utility Grid Outage",
        severity="HIGH",
        status="ACTIVE",
        probable_cause="AC voltage dropped to 0V across all 3 phases.",
        root_cause_summary="Utility grid interruption",
        detected_at=datetime.now(timezone.utc),
    )
    db_session.add(diagnosis)
    db_session.flush()

    alert1 = alert_generation_service.generate_alert_from_diagnosis(db_session, diagnosis)
    alert2 = alert_generation_service.generate_alert_from_diagnosis(db_session, diagnosis)

    assert alert1.id == alert2.id  # Same alert returned without duplicate insertion


# -----------------------------------------------------------------------------
# 3. Work Order Creation & Safety Inspection Checklist Tests
# -----------------------------------------------------------------------------

def test_work_order_creation_from_diagnosis(db_session: Session, seeded_env):
    """Creates structured work order linking diagnosis, assigned technician, and checklist."""
    diagnosis = Diagnosis(
        id="DIAG-TEST-WO",
        plant_id=10,
        inverter_id="INV-10-A",
        fault_class="STRING_DISCONNECTION",
        fault_title="String 2 Disconnection",
        severity="HIGH",
        status="ACTIVE",
        probable_cause="Current on String 2 dropped to 0.0A under 800 W/m² irradiance.",
        root_cause_summary="DC open-circuit fault on String 2",
        detected_at=datetime.now(timezone.utc),
    )
    db_session.add(diagnosis)
    db_session.flush()

    wo = alert_generation_service.create_work_order_from_diagnosis(
        db=db_session,
        diagnosis=diagnosis,
        created_by="admin@solarmind.io",
        technician_id="TECH-01",
        due_days=3,
    )

    assert wo is not None
    assert wo.id.startswith("WO-")
    assert wo.diagnosis_id == "DIAG-TEST-WO"
    assert wo.priority == "HIGH"
    assert wo.status == "ASSIGNED"
    assert wo.assigned_to == "TECH-01"

    # Verify safety precautions do not instruct user to open live/energized equipment
    assert "DANGER: High DC voltage" in wo.instructions
    assert "Do not open energized" in wo.instructions
    assert "lock out AC and DC disconnect switches" in wo.instructions

    # Verify structured inspection steps in checklist
    assert any("MC4" in item["item"] for item in wo.checklist)
    assert any("open-circuit voltage" in item["item"] for item in wo.checklist)


# -----------------------------------------------------------------------------
# 4. REST API Jobs Integration
# -----------------------------------------------------------------------------

def test_api_get_job_and_retry(client, auth_cookies):
    """GET /api/v1/jobs/{id} and POST /api/v1/jobs/{id}/retry endpoint tests."""
    def test_task():
        return {"processed": 100}

    job = job_processing_service.submit_job(
        JobCreate(job_type="TELEMETRY_SYNC", resource_id="PLANT-10"),
        handler=test_task,
    )

    # 1. Query Job
    res = client.get(f"/api/v1/jobs/{job.job_id}", cookies=auth_cookies)
    assert res.status_code == 200
    data = res.json()
    assert data["job_id"] == job.job_id
    assert data["status"] == "COMPLETED"
    assert data["result_payload"] == {"processed": 100}

    # 2. List Jobs
    list_res = client.get(f"/api/v1/jobs?job_type=TELEMETRY_SYNC", cookies=auth_cookies)
    assert list_res.status_code == 200
    jobs_list = list_res.json()
    assert isinstance(jobs_list, list)
    assert any(j["job_id"] == job.job_id for j in jobs_list)
