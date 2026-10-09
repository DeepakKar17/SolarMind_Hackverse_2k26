"""API endpoint tests for Telemetry timeseries and CSV import (/api/v1/telemetry)."""

from datetime import datetime, timezone
import io
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.telemetry import Telemetry


def test_get_latest_telemetry_endpoint(client: TestClient, db_session: Session):
    """Test GET /api/v1/telemetry/latest by inverter_id and by plant_id."""
    plant = Plant(name="Plant Tel Latest", location="AZ", installed_capacity_kwp=10.0)
    db_session.add(plant)
    db_session.flush()

    inv = Inverter(
        id="INV-TEL-LATEST",
        plant_id=plant.id,
        serial_number="TEL-SN-LATEST",
        manufacturer="SMA",
        model="STP",
        rated_ac_power_kw=5.0,
    )
    db_session.add(inv)
    db_session.flush()

    t1 = datetime(2026, 10, 9, 8, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 10, 9, 9, 0, 0, tzinfo=timezone.utc)

    tel1 = Telemetry(inverter_id=inv.id, timestamp=t1, p_ac=3.0)
    tel2 = Telemetry(inverter_id=inv.id, timestamp=t2, p_ac=4.5)
    db_session.add_all([tel1, tel2])
    db_session.flush()

    # Query by inverter_id -> returns latest record (t2)
    resp = client.get(f"/api/v1/telemetry/latest?inverter_id={inv.id}")
    assert resp.status_code == 200
    assert resp.json()["p_ac"] == 4.5

    # Query by plant_id -> returns list containing latest record
    resp_plant = client.get(f"/api/v1/telemetry/latest?plant_id={plant.id}")
    assert resp_plant.status_code == 200
    items = resp_plant.json()
    assert len(items) == 1
    assert items[0]["p_ac"] == 4.5

    # Missing both parameters -> 400 Bad Request
    resp_bad = client.get("/api/v1/telemetry/latest")
    assert resp_bad.status_code == 400


def test_get_telemetry_history_and_invalid_date_range(client: TestClient, db_session: Session):
    """Test GET /api/v1/telemetry/history and invalid start/end date validation."""
    plant = Plant(name="Plant Tel History", location="AZ", installed_capacity_kwp=10.0)
    db_session.add(plant)
    db_session.flush()

    inv = Inverter(
        id="INV-TEL-HIST",
        plant_id=plant.id,
        serial_number="TEL-SN-HIST",
        manufacturer="SMA",
        model="STP",
        rated_ac_power_kw=5.0,
    )
    db_session.add(inv)
    db_session.flush()

    t1 = datetime(2026, 10, 9, 10, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 10, 9, 11, 0, 0, tzinfo=timezone.utc)

    tel = Telemetry(inverter_id=inv.id, timestamp=t1, p_ac=4.2, v_dc=380.0, i_dc=11.0)
    db_session.add(tel)
    db_session.flush()

    # Valid history query
    resp = client.get(f"/api/v1/telemetry/history?inverter_id={inv.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["v_dc"] == 380.0

    # Invalid date range (start_time > end_time)
    resp_invalid_dates = client.get(
        f"/api/v1/telemetry/history?inverter_id={inv.id}&start_time=2026-10-09T12:00:00Z&end_time=2026-10-09T08:00:00Z"
    )
    assert resp_invalid_dates.status_code == 400


def test_csv_import_valid_and_deduplication(client: TestClient, db_session: Session):
    """Test importing telemetry from CSV with unit columns, deduplication on re-upload."""
    plant = Plant(name="Plant CSV Import", location="AZ", installed_capacity_kwp=10.0)
    db_session.add(plant)
    db_session.flush()

    inv = Inverter(
        id="INV-CSV-01",
        plant_id=plant.id,
        serial_number="CSV-SN-01",
        manufacturer="Deye",
        model="SUN-5K",
        rated_ac_power_kw=5.0,
    )
    db_session.add(inv)
    db_session.flush()

    csv_content = (
        "timestamp,v_dc,i_dc,p_dc,v_ac,i_ac,p_ac,frequency_hz,temperature_c,poa_irradiance_wm2,daily_yield_kwh\n"
        "2026-10-09 08:00:00,380.5,8.2,3.12,230.1,13.2,3.04,50.01,42.5,650.0,3.5\n"
        "2026-10-09 08:15:00,381.0,9.5,3.62,230.0,15.4,3.54,49.99,44.0,780.0,4.4\n"
        "2026-10-09 08:30:00,382.2,10.8,4.13,229.8,17.6,4.04,50.02,46.5,890.0,5.4\n"
    )

    file_obj = io.BytesIO(csv_content.encode("utf-8"))
    response = client.post(
        f"/api/v1/telemetry/import?inverter_id={inv.id}",
        files={"file": ("telemetry_data.csv", file_obj, "text/csv")},
    )

    assert response.status_code == 200
    summary = response.json()
    assert summary["total_rows"] == 3
    assert summary["accepted_rows"] == 3
    assert summary["rejected_rows"] == 0
    assert summary["duplicate_rows"] == 0

    # Re-upload the exact same CSV to verify deduplication policy
    file_obj_second = io.BytesIO(csv_content.encode("utf-8"))
    response_second = client.post(
        f"/api/v1/telemetry/import?inverter_id={inv.id}",
        files={"file": ("telemetry_data.csv", file_obj_second, "text/csv")},
    )

    assert response_second.status_code == 200
    summary_second = response_second.json()
    assert summary_second["total_rows"] == 3
    assert summary_second["accepted_rows"] == 0
    assert summary_second["duplicate_rows"] == 3


def test_csv_import_with_invalid_rows(client: TestClient, db_session: Session):
    """Test CSV import reporting row-level format and numeric errors."""
    plant = Plant(name="Plant CSV Errors", location="AZ", installed_capacity_kwp=10.0)
    db_session.add(plant)
    db_session.flush()

    inv = Inverter(
        id="INV-CSV-ERR",
        plant_id=plant.id,
        serial_number="CSV-SN-ERR",
        manufacturer="Deye",
        model="SUN-5K",
        rated_ac_power_kw=5.0,
    )
    db_session.add(inv)
    db_session.flush()

    # Row 2 is valid, Row 3 has bad timestamp, Row 4 has non-numeric voltage
    csv_content = (
        "timestamp,v_dc,p_ac\n"
        "2026-10-09 10:00:00,380.0,4.5\n"
        "invalid_timestamp_string,380.0,4.5\n"
        "2026-10-09 10:30:00,NOT_A_NUMBER,4.5\n"
    )

    file_obj = io.BytesIO(csv_content.encode("utf-8"))
    response = client.post(
        f"/api/v1/telemetry/import?inverter_id={inv.id}",
        files={"file": ("corrupted_telemetry.csv", file_obj, "text/csv")},
    )

    assert response.status_code == 200
    summary = response.json()
    assert summary["total_rows"] == 3
    assert summary["accepted_rows"] == 1
    assert summary["rejected_rows"] == 2
    assert len(summary["errors"]) == 2
