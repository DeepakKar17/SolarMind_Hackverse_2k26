"""Pydantic schemas for Telemetry timeseries records and ingestion."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TelemetryBase(BaseModel):
    """Shared telemetry measurement properties with explicit electrical units."""

    # DC Electrical Measurements
    v_dc: Optional[float] = Field(default=None, ge=0.0, le=1500.0, description="DC Voltage (Volts, V)")
    i_dc: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="DC Current (Amperes, A)")
    p_dc: Optional[float] = Field(default=None, ge=0.0, description="DC Power (kilowatts, kW)")

    # AC Electrical Measurements
    v_ac: Optional[float] = Field(default=None, ge=0.0, le=600.0, description="AC Output Voltage (Volts, V)")
    i_ac: Optional[float] = Field(default=None, ge=0.0, le=200.0, description="AC Output Current (Amperes, A)")
    p_ac: Optional[float] = Field(default=None, ge=0.0, description="AC Output Power (kilowatts, kW)")
    frequency_hz: Optional[float] = Field(default=None, ge=40.0, le=70.0, description="AC Grid Frequency (Hertz, Hz)")

    # Environmental & Temperature Measurements
    temperature_c: Optional[float] = Field(default=None, ge=-40.0, le=125.0, description="Inverter Internal Temperature (°C)")
    ambient_temp_c: Optional[float] = Field(default=None, ge=-40.0, le=70.0, description="Ambient Weather Temperature (°C)")
    poa_irradiance_wm2: Optional[float] = Field(default=None, ge=0.0, le=2000.0, description="Plane of Array Solar Irradiance (W/m²)")

    # Energy Yield
    daily_yield_kwh: Optional[float] = Field(default=None, ge=0.0, description="Daily Accumulated Yield (kilowatt-hours, kWh)")
    total_yield_kwh: Optional[float] = Field(default=None, ge=0.0, description="Cumulative Lifetime Yield (kilowatt-hours, kWh)")

    # Ingestion Metadata
    data_source: str = Field(default="SIMULATED", max_length=40, description="Data Source ('MODBUS', 'SIMULATED', 'MQTT', 'MANUAL', 'CSV_IMPORT')")
    data_quality_flag: str = Field(default="VALID", max_length=40, description="Data Quality ('VALID', 'SUSPICIOUS', 'INTERPOLATED', 'MISSING_MEASUREMENTS')")


class TelemetryCreate(TelemetryBase):
    """Payload for ingesting a single Telemetry record."""

    model_config = ConfigDict(extra="forbid")

    inverter_id: str = Field(min_length=2, max_length=50, description="Inverter identifier")
    pv_asset_id: Optional[str] = Field(default=None, max_length=60, description="Optional associated PVAsset (string/MPPT) ID")
    timestamp: datetime = Field(description="Telemetry reading timestamp in UTC (ISO 8601)")


class TelemetryBatchCreate(BaseModel):
    """Payload for ingesting a batch of Telemetry records."""

    model_config = ConfigDict(extra="forbid")

    records: List[TelemetryCreate] = Field(min_length=1, max_length=500, description="Batch of telemetry records (max 500 per batch)")


class TelemetryResponse(TelemetryBase):
    """Response schema representing a single Telemetry record."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Internal autoincrement ID")
    inverter_id: str = Field(description="Inverter identifier")
    pv_asset_id: Optional[str] = Field(default=None, description="PVAsset identifier")
    timestamp: datetime = Field(description="Timestamp in UTC")


class TelemetryQueryFilter(BaseModel):
    """Filter parameters for querying timeseries telemetry."""

    model_config = ConfigDict(extra="forbid")

    inverter_id: Optional[str] = Field(default=None, description="Filter by Inverter ID")
    pv_asset_id: Optional[str] = Field(default=None, description="Filter by PVAsset ID")
    start_time: Optional[datetime] = Field(default=None, description="Start timestamp in UTC")
    end_time: Optional[datetime] = Field(default=None, description="End timestamp in UTC")
    data_quality_flag: Optional[str] = Field(default=None, description="Filter by quality flag")
    limit: int = Field(default=100, ge=1, le=1000, description="Max telemetry records to return")


class CSVImportRowError(BaseModel):
    """Details of a single rejected CSV row."""

    row_number: int = Field(description="1-indexed row number in the CSV file")
    reason: str = Field(description="Reason the row was rejected")
    raw_data: Optional[str] = Field(default=None, description="Truncated raw row snippet")


class CSVImportSummaryResponse(BaseModel):
    """Summary result returned after importing telemetry from a CSV file."""

    total_rows: int = Field(ge=0, description="Total rows parsed in the CSV")
    accepted_rows: int = Field(ge=0, description="Count of successfully inserted telemetry records")
    rejected_rows: int = Field(ge=0, description="Count of rejected rows due to validation or formatting errors")
    duplicate_rows: int = Field(ge=0, description="Count of rows skipped due to duplicate timestamp deduplication")
    inverter_id: str = Field(description="Inverter target identifier for the import")
    source: str = Field(default="CSV_IMPORT", description="Data source recorded for imported records")
    errors: List[CSVImportRowError] = Field(default_factory=list, description="List of row error descriptions")
