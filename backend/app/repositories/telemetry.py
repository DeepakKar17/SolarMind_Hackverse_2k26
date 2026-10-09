"""Telemetry Repository implementation."""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.telemetry import Telemetry
from app.repositories.base import BaseRepository
from app.schemas.telemetry import TelemetryCreate


class TelemetryRepository(BaseRepository[Telemetry, TelemetryCreate, TelemetryCreate]):
    """Repository handling database operations for Telemetry timeseries records."""

    def __init__(self):
        super().__init__(Telemetry)

    def create_batch(self, db: Session, *, records: List[TelemetryCreate]) -> List[Telemetry]:
        """Bulk insert a collection of telemetry records."""
        db_objs = [Telemetry(**record.model_dump(exclude_unset=True)) for record in records]
        db.add_all(db_objs)
        db.flush()
        return db_objs

    def get_latest_by_inverter(self, db: Session, inverter_id: str) -> Optional[Telemetry]:
        """Fetch the most recent telemetry packet received from an inverter."""
        stmt = (
            select(Telemetry)
            .where(Telemetry.inverter_id == inverter_id)
            .order_by(desc(Telemetry.timestamp))
            .limit(1)
        )
        return db.scalar(stmt)

    def query_range(
        self,
        db: Session,
        *,
        inverter_id: Optional[str] = None,
        pv_asset_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        data_quality_flag: Optional[str] = None,
        limit: int = 100,
    ) -> List[Telemetry]:
        """Query historical telemetry points with optional asset and date range filters."""
        stmt = select(Telemetry)

        if inverter_id:
            stmt = stmt.where(Telemetry.inverter_id == inverter_id)
        if pv_asset_id:
            stmt = stmt.where(Telemetry.pv_asset_id == pv_asset_id)
        if start_time:
            stmt = stmt.where(Telemetry.timestamp >= start_time)
        if end_time:
            stmt = stmt.where(Telemetry.timestamp <= end_time)
        if data_quality_flag:
            stmt = stmt.where(Telemetry.data_quality_flag == data_quality_flag)

        stmt = stmt.order_by(desc(Telemetry.timestamp)).limit(limit)
        return list(db.scalars(stmt).all())


telemetry_repository = TelemetryRepository()
