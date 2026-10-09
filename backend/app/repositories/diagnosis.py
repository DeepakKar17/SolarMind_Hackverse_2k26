"""Diagnosis Repository implementation."""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.diagnosis import Diagnosis
from app.repositories.base import BaseRepository
from app.schemas.diagnosis import DiagnosisCreate, DiagnosisUpdate


class DiagnosisRepository(BaseRepository[Diagnosis, DiagnosisCreate, DiagnosisUpdate]):
    """Repository handling database operations for Diagnosis entities."""

    def __init__(self):
        super().__init__(Diagnosis)

    def list_with_filters(
        self,
        db: Session,
        *,
        plant_id: Optional[int] = None,
        inverter_id: Optional[str] = None,
        pv_asset_id: Optional[str] = None,
        fault_class: Optional[str] = None,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> List[Diagnosis]:
        """Query diagnoses with multi-attribute filtering and pagination."""
        stmt = select(Diagnosis)

        if plant_id:
            stmt = stmt.where(Diagnosis.plant_id == plant_id)
        if inverter_id:
            stmt = stmt.where(Diagnosis.inverter_id == inverter_id)
        if pv_asset_id:
            stmt = stmt.where(Diagnosis.pv_asset_id == pv_asset_id)
        if fault_class:
            stmt = stmt.where(Diagnosis.fault_class == fault_class)
        if severity:
            stmt = stmt.where(Diagnosis.severity == severity)
        if status:
            stmt = stmt.where(Diagnosis.status == status)
        if start_time:
            stmt = stmt.where(Diagnosis.detected_at >= start_time)
        if end_time:
            stmt = stmt.where(Diagnosis.detected_at <= end_time)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    Diagnosis.fault_title.ilike(pattern),
                    Diagnosis.probable_cause.ilike(pattern),
                    Diagnosis.root_cause_summary.ilike(pattern),
                )
            )

        stmt = stmt.order_by(desc(Diagnosis.detected_at)).offset(offset).limit(limit)
        return list(db.scalars(stmt).all())

    def count_with_filters(
        self,
        db: Session,
        *,
        plant_id: Optional[int] = None,
        inverter_id: Optional[str] = None,
        pv_asset_id: Optional[str] = None,
        fault_class: Optional[str] = None,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> int:
        """Count total matching diagnoses."""
        stmt = select(func.count()).select_from(Diagnosis)

        if plant_id:
            stmt = stmt.where(Diagnosis.plant_id == plant_id)
        if inverter_id:
            stmt = stmt.where(Diagnosis.inverter_id == inverter_id)
        if pv_asset_id:
            stmt = stmt.where(Diagnosis.pv_asset_id == pv_asset_id)
        if fault_class:
            stmt = stmt.where(Diagnosis.fault_class == fault_class)
        if severity:
            stmt = stmt.where(Diagnosis.severity == severity)
        if status:
            stmt = stmt.where(Diagnosis.status == status)
        if start_time:
            stmt = stmt.where(Diagnosis.detected_at >= start_time)
        if end_time:
            stmt = stmt.where(Diagnosis.detected_at <= end_time)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    Diagnosis.fault_title.ilike(pattern),
                    Diagnosis.probable_cause.ilike(pattern),
                    Diagnosis.root_cause_summary.ilike(pattern),
                )
            )

        return db.scalar(stmt) or 0

    def get_with_details(self, db: Session, diagnosis_id: str) -> Optional[Diagnosis]:
        """Fetch diagnosis eagerly loading related alerts and work orders."""
        stmt = (
            select(Diagnosis)
            .where(Diagnosis.id == diagnosis_id)
            .options(
                selectinload(Diagnosis.alerts),
                selectinload(Diagnosis.work_orders),
                selectinload(Diagnosis.photo_inspections),
            )
        )
        return db.scalar(stmt)


diagnosis_repository = DiagnosisRepository()
