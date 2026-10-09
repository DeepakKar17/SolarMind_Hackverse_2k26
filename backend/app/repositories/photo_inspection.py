"""PhotoInspection Repository implementation."""

from typing import List, Optional
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.photo_inspection import PhotoInspection
from app.repositories.base import BaseRepository
from app.schemas.photo_inspection import PhotoInspectionCreate, PhotoInspectionUpdate


class PhotoInspectionRepository(BaseRepository[PhotoInspection, PhotoInspectionCreate, PhotoInspectionUpdate]):
    """Repository handling database operations for PhotoInspection entities."""

    def __init__(self):
        super().__init__(PhotoInspection)

    def list_by_plant(
        self,
        db: Session,
        plant_id: int,
        *,
        processing_status: Optional[str] = None,
        fault_detected: Optional[bool] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> List[PhotoInspection]:
        """List photo inspections for a plant with optional status filter."""
        stmt = select(PhotoInspection).where(PhotoInspection.plant_id == plant_id)
        if processing_status:
            stmt = stmt.where(PhotoInspection.processing_status == processing_status)
        if fault_detected is not None:
            stmt = stmt.where(PhotoInspection.fault_detected == fault_detected)

        stmt = stmt.order_by(desc(PhotoInspection.uploaded_at)).offset(offset).limit(limit)
        return list(db.scalars(stmt).all())

    def count_by_plant(
        self,
        db: Session,
        plant_id: int,
        *,
        processing_status: Optional[str] = None,
        fault_detected: Optional[bool] = None,
    ) -> int:
        """Count photo inspections for a plant."""
        stmt = select(func.count()).select_from(PhotoInspection).where(PhotoInspection.plant_id == plant_id)
        if processing_status:
            stmt = stmt.where(PhotoInspection.processing_status == processing_status)
        if fault_detected is not None:
            stmt = stmt.where(PhotoInspection.fault_detected == fault_detected)
        return db.scalar(stmt) or 0

    def get_pending_inspections(self, db: Session, *, limit: int = 10) -> List[PhotoInspection]:
        """Retrieve oldest pending inspections for vision AI background worker."""
        stmt = (
            select(PhotoInspection)
            .where(PhotoInspection.processing_status == "PENDING")
            .order_by(PhotoInspection.uploaded_at.asc())
            .limit(limit)
        )
        return list(db.scalars(stmt).all())


photo_inspection_repository = PhotoInspectionRepository()
