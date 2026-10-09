"""Inverter Repository implementation."""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.inverter import Inverter
from app.repositories.base import BaseRepository
from app.schemas.inverter import InverterCreate, InverterUpdate


class InverterRepository(BaseRepository[Inverter, InverterCreate, InverterUpdate]):
    """Repository handling database operations for Inverter entities."""

    def __init__(self):
        super().__init__(Inverter)

    def get_by_serial(self, db: Session, serial_number: str) -> Optional[Inverter]:
        """Fetch an inverter by its unique serial number."""
        stmt = select(Inverter).where(Inverter.serial_number == serial_number)
        return db.scalar(stmt)

    def list_by_plant(
        self,
        db: Session,
        plant_id: int,
        *,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 50,
    ) -> List[Inverter]:
        """Fetch all inverters belonging to a specific plant with optional status filter."""
        stmt = select(Inverter).where(Inverter.plant_id == plant_id)
        if status:
            stmt = stmt.where(Inverter.status == status)
        stmt = stmt.order_by(Inverter.id.asc()).offset(offset).limit(limit)
        return list(db.scalars(stmt).all())

    def count_by_plant(self, db: Session, plant_id: int, *, status: Optional[str] = None) -> int:
        """Count inverters belonging to a plant."""
        stmt = select(func.count()).select_from(Inverter).where(Inverter.plant_id == plant_id)
        if status:
            stmt = stmt.where(Inverter.status == status)
        return db.scalar(stmt) or 0

    def get_with_pv_assets(self, db: Session, inverter_id: str) -> Optional[Inverter]:
        """Fetch inverter eagerly loading its connected PVAssets."""
        stmt = select(Inverter).where(Inverter.id == inverter_id).options(selectinload(Inverter.pv_assets))
        return db.scalar(stmt)

    def update_last_telemetry(self, db: Session, inverter_id: str, timestamp: datetime) -> Optional[Inverter]:
        """Update the last_telemetry_at timestamp on the inverter."""
        inverter = self.get(db, inverter_id)
        if inverter:
            inverter.last_telemetry_at = timestamp
            db.add(inverter)
            db.flush()
        return inverter


inverter_repository = InverterRepository()
