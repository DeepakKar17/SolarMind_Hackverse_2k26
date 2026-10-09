"""API endpoints for Telemetry timeseries queries and CSV batch import."""

import csv
from datetime import datetime, timezone
import io
from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db.errors import EntityNotFoundError
from app.db.session import get_db
from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.telemetry import Telemetry
from app.repositories.inverter import inverter_repository
from app.repositories.telemetry import telemetry_repository
from app.schemas.telemetry import (
    CSVImportRowError,
    CSVImportSummaryResponse,
    TelemetryCreate,
    TelemetryResponse,
)

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])


@router.get(
    "/latest",
    response_model=Union[TelemetryResponse, List[TelemetryResponse]],
    summary="Get Latest Telemetry",
    description="Retrieve the latest real-time telemetry snapshot for a specific inverter or all inverters within a plant.",
)
def get_latest_telemetry(
    inverter_id: Optional[str] = Query(default=None, description="Inverter identifier"),
    plant_id: Optional[int] = Query(default=None, description="Plant identifier to get latest telemetry across all inverters"),
    db: Session = Depends(get_db),
) -> Any:
    if inverter_id:
        telemetry = telemetry_repository.get_latest_by_inverter(db, inverter_id)
        if not telemetry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No telemetry readings found for inverter '{inverter_id}'.",
            )
        return TelemetryResponse.model_validate(telemetry)

    elif plant_id:
        # Fetch latest telemetry for each inverter in the plant
        inverters = db.scalars(select(Inverter).where(Inverter.plant_id == plant_id)).all()
        if not inverters:
            raise EntityNotFoundError("Plant", plant_id)

        results = []
        for inv in inverters:
            tel = telemetry_repository.get_latest_by_inverter(db, inv.id)
            if tel:
                results.append(TelemetryResponse.model_validate(tel))
        return results

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'inverter_id' or 'plant_id' must be provided.",
        )


@router.get(
    "/history",
    response_model=List[TelemetryResponse],
    summary="Get Telemetry History",
    description="Query historical timeseries telemetry records for an inverter with optional date range and quality filters.",
)
def get_telemetry_history(
    inverter_id: str = Query(..., description="Target inverter identifier"),
    pv_asset_id: Optional[str] = Query(default=None, description="Optional PV asset (string/MPPT) filter"),
    start_time: Optional[datetime] = Query(default=None, description="Start timestamp in UTC (inclusive)"),
    end_time: Optional[datetime] = Query(default=None, description="End timestamp in UTC (inclusive)"),
    data_quality_flag: Optional[str] = Query(default=None, description="Filter by quality tag ('VALID', 'SUSPICIOUS', etc.)"),
    limit: int = Query(default=100, ge=1, le=1000, description="Max records to return"),
    db: Session = Depends(get_db),
) -> List[TelemetryResponse]:
    # 1. Verify inverter exists
    inverter = inverter_repository.get(db, inverter_id)
    if not inverter:
        raise EntityNotFoundError("Inverter", inverter_id)

    # 2. Validate date range
    if start_time and end_time and start_time > end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_time must be less than or equal to end_time.",
        )

    records = telemetry_repository.query_range(
        db,
        inverter_id=inverter_id,
        pv_asset_id=pv_asset_id,
        start_time=start_time,
        end_time=end_time,
        data_quality_flag=data_quality_flag,
        limit=limit,
    )

    return [TelemetryResponse.model_validate(r) for r in records]


def parse_flexible_timestamp(val: str) -> Optional[datetime]:
    """Parse timestamps across common standard ISO and string formats."""
    val = val.strip()
    # Try ISO format
    try:
        dt = datetime.fromisoformat(val)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        pass

    # Try standard string date-time formats
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%Y/%m/%d %H:%M:%S"):
        try:
            dt = datetime.strptime(val, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    return None


def normalize_ts_key(dt: datetime) -> str:
    """Normalize datetime to UTC naive ISO string for consistent deduplication hashing."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.strftime("%Y-%m-%d %H:%M:%S")


@router.post(
    "/import",
    response_model=CSVImportSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Import Telemetry from CSV",
    description="Bulk import historical electrical and thermal telemetry from a CSV file with automatic column validation, deduplication, and error reporting.",
)
async def import_telemetry_csv(
    file: UploadFile = File(..., description="CSV file containing historical telemetry records"),
    inverter_id: Optional[str] = Query(default=None, description="Target inverter ID if not specified in CSV column"),
    db: Session = Depends(get_db),
) -> CSVImportSummaryResponse:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only valid .csv files are accepted.",
        )

    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            decoded = content.decode("latin-1")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to decode file content as UTF-8 or Latin-1 text.",
            )

    reader = csv.DictReader(io.StringIO(decoded))
    if not reader.fieldnames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file contains no headers or is empty.",
        )

    # Normalize header mapping (strip whitespace and lowercase)
    field_map = {orig.strip().lower(): orig for orig in reader.fieldnames}

    # Identify key column candidates
    time_col = None
    for candidate in ("timestamp", "time", "date_time", "datetime", "reading_time"):
        if candidate in field_map:
            time_col = field_map[candidate]
            break

    if not time_col:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Required timestamp column not found in CSV. Expected one of: timestamp, time, date_time, datetime.",
        )

    # Helper mapping for measurement keys
    col_mapping = {
        "v_dc": ["v_dc", "vdc", "dc_voltage", "dc_voltage_v", "voltage_dc"],
        "i_dc": ["i_dc", "idc", "dc_current", "dc_current_a", "current_dc"],
        "p_dc": ["p_dc", "pdc", "dc_power", "dc_power_kw", "power_dc"],
        "v_ac": ["v_ac", "vac", "ac_voltage", "ac_voltage_v", "voltage_ac"],
        "i_ac": ["i_ac", "iac", "ac_current", "ac_current_a", "current_ac"],
        "p_ac": ["p_ac", "pac", "ac_power", "ac_power_kw", "power_ac"],
        "frequency_hz": ["frequency_hz", "frequency", "freq", "grid_freq"],
        "temperature_c": ["temperature_c", "temperature", "temp_c", "inverter_temp"],
        "ambient_temp_c": ["ambient_temp_c", "ambient_temp", "weather_temp"],
        "poa_irradiance_wm2": ["poa_irradiance_wm2", "irradiance", "irradiance_wm2", "poa"],
        "daily_yield_kwh": ["daily_yield_kwh", "daily_yield", "yield_today_kwh"],
        "total_yield_kwh": ["total_yield_kwh", "total_yield", "lifetime_yield_kwh"],
        "inverter_id": ["inverter_id", "inverter", "device_id", "serial"],
    }

    resolved_cols: Dict[str, Optional[str]] = {}
    for target_key, aliases in col_mapping.items():
        resolved = None
        for alias in aliases:
            if alias in field_map:
                resolved = field_map[alias]
                break
        resolved_cols[target_key] = resolved

    total_rows = 0
    accepted_records: List[Telemetry] = []
    errors: List[CSVImportRowError] = []
    duplicate_rows = 0
    last_timestamp = None
    target_inverter_id = inverter_id or "UNKNOWN"

    # Pre-fetch existing timestamps for fast deduplication
    existing_timestamp_keys = set()
    if inverter_id:
        existing_rows = db.execute(
            select(Telemetry.timestamp).where(Telemetry.inverter_id == inverter_id)
        ).scalars().all()
        existing_timestamp_keys = {normalize_ts_key(dt) for dt in existing_rows}

    for row_idx, row in enumerate(reader, start=2):  # start at 2 because row 1 is header
        total_rows += 1
        raw_time = row.get(time_col, "")
        if not raw_time or not raw_time.strip():
            errors.append(CSVImportRowError(row_number=row_idx, reason="Empty timestamp field"))
            continue

        ts = parse_flexible_timestamp(raw_time)
        if not ts:
            errors.append(CSVImportRowError(row_number=row_idx, reason=f"Invalid timestamp format: '{raw_time}'"))
            continue

        # Determine inverter ID for row
        row_inv_id = inverter_id
        if resolved_cols["inverter_id"] and row.get(resolved_cols["inverter_id"]):
            row_inv_id = row[resolved_cols["inverter_id"]].strip()

        if not row_inv_id:
            errors.append(CSVImportRowError(row_number=row_idx, reason="Inverter ID not provided in row or query parameters"))
            continue

        target_inverter_id = row_inv_id

        # Deduplication check
        ts_key = normalize_ts_key(ts)
        if ts_key in existing_timestamp_keys:
            duplicate_rows += 1
            continue

        # Extract floats safely
        measurements: Dict[str, Optional[float]] = {}
        row_has_error = False

        for metric in (
            "v_dc", "i_dc", "p_dc", "v_ac", "i_ac", "p_ac",
            "frequency_hz", "temperature_c", "ambient_temp_c",
            "poa_irradiance_wm2", "daily_yield_kwh", "total_yield_kwh"
        ):
            col_name = resolved_cols.get(metric)
            if col_name and row.get(col_name) and row[col_name].strip():
                try:
                    measurements[metric] = float(row[col_name].strip())
                except ValueError:
                    errors.append(CSVImportRowError(
                        row_number=row_idx,
                        reason=f"Non-numeric value in {metric}: '{row[col_name]}'",
                    ))
                    row_has_error = True
                    break
            else:
                measurements[metric] = None

        if row_has_error:
            continue

        # Create record
        tel = Telemetry(
            inverter_id=row_inv_id,
            timestamp=ts,
            v_dc=measurements.get("v_dc"),
            i_dc=measurements.get("i_dc"),
            p_dc=measurements.get("p_dc"),
            v_ac=measurements.get("v_ac"),
            i_ac=measurements.get("i_ac"),
            p_ac=measurements.get("p_ac"),
            frequency_hz=measurements.get("frequency_hz"),
            temperature_c=measurements.get("temperature_c"),
            ambient_temp_c=measurements.get("ambient_temp_c"),
            poa_irradiance_wm2=measurements.get("poa_irradiance_wm2"),
            daily_yield_kwh=measurements.get("daily_yield_kwh"),
            total_yield_kwh=measurements.get("total_yield_kwh"),
            data_source="CSV_IMPORT",
            data_quality_flag="VALID",
        )
        accepted_records.append(tel)
        existing_timestamp_keys.add(ts_key)
        last_timestamp = ts

    # Batch save accepted records
    if accepted_records:
        db.add_all(accepted_records)
        # Update inverter last_telemetry_at
        if target_inverter_id and last_timestamp:
            inv = inverter_repository.get(db, target_inverter_id)
            if inv:
                inv.last_telemetry_at = last_timestamp
                db.add(inv)
        db.commit()

    return CSVImportSummaryResponse(
        total_rows=total_rows,
        accepted_rows=len(accepted_records),
        rejected_rows=len(errors),
        duplicate_rows=duplicate_rows,
        inverter_id=target_inverter_id,
        source="CSV_IMPORT",
        errors=errors[:50],  # Return up to 50 detailed error rows
    )
