"""Alert Repository implementation."""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.alert import Alert
from app.repositories.base import BaseRepository
from app.schemas.alert import AlertCreate, AlertUpdate


class AlertRepository(BaseRepository[Alert, AlertCreate, AlertUpdate]):
    """Repository handling database operations for Alert entities."""

    def __init__(self):
        super().__init__(Alert)

    def list_with_filters(
        self,
        db: Session,
        *,
        plant_id: Optional[int] = None,
        inverter_id: Optional[str] = None,
        pv_asset_id: Optional[str] = None,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        source: Optional[str] = None,
        acknowledged: Optional[bool] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> List[Alert]:
        """Query alerts with filtering by plant, severity, status, source, and ack state."""
        stmt = select(Alert)

        if plant_id:
            stmt = stmt.where(Alert.plant_id == plant_id)
        if inverter_id:
            stmt = stmt.where(Alert.inverter_id == inverter_id)
        if pv_asset_id:
            stmt = stmt.where(Alert.pv_asset_id == pv_asset_id)
        if severity:
            stmt = stmt.where(Alert.severity == severity)
        if status:
            stmt = stmt.where(Alert.status == status)
        if source:
            stmt = stmt.where(Alert.source == source)
        if acknowledged is not None:
            stmt = stmt.where(Alert.acknowledged == acknowledged)

        stmt = stmt.order_by(desc(Alert.event_timestamp)).offset(offset).limit(limit)
        return list(db.scalars(stmt).all())

    def count_with_filters(
        self,
        db: Session,
        *,
        plant_id: Optional[int] = None,
        inverter_id: Optional[str] = None,
        pv_asset_id: Optional[str] = None,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        source: Optional[str] = None,
        acknowledged: Optional[bool] = None,
    ) -> int:
        """Count matching alerts."""
        stmt = select(func.count()).select_from(Alert)

        if plant_id:
            stmt = stmt.where(Alert.plant_id == plant_id)
        if inverter_id:
            stmt = stmt.where(Alert.inverter_id == inverter_id)
        if pv_asset_id:
            stmt = stmt.where(Alert.pv_asset_id == pv_asset_id)
        if severity:
            stmt = stmt.where(Alert.severity == severity)
        if status:
            stmt = stmt.where(Alert.status == status)
        if source:
            stmt = stmt.where(Alert.source == source)
        if acknowledged is not None:
            stmt = stmt.where(Alert.acknowledged == acknowledged)

        return db.scalar(stmt) or 0

    def acknowledge_alert(
        self,
        db: Session,
        alert_id: str,
        acknowledged_by: str,
        acknowledged_at: datetime,
    ) -> Optional[Alert]:
        """Mark an active alert as acknowledged."""
        alert = self.get(db, alert_id)
        if alert:
            alert.acknowledged = True
            alert.acknowledged_by = acknowledged_by
            alert.acknowledged_at = acknowledged_at
            db.add(alert)
            db.flush()
        return alert

    def resolve_alert(
        self,
        db: Session,
        alert_id: str,
        resolved_at: datetime,
    ) -> Optional[Alert]:
        """Mark an alert as resolved."""
        alert = self.get(db, alert_id)
        if alert:
            alert.status = "RESOLVED"
            alert.resolved_at = resolved_at
            db.add(alert)
            db.flush()
        return alert


alert_repository = AlertRepository()
