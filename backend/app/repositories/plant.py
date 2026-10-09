"""Plant Repository implementation."""

from typing import List, Optional
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.plant import Plant
from app.repositories.base import BaseRepository
from app.schemas.plant import PlantCreate, PlantUpdate


class PlantRepository(BaseRepository[Plant, PlantCreate, PlantUpdate]):
    """Repository handling database operations for Plant entities."""

    def __init__(self):
        super().__init__(Plant)

    def list_with_filters(
        self,
        db: Session,
        *,
        status: Optional[str] = None,
        system_type: Optional[str] = None,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> List[Plant]:
        """Query plants with optional filtering by status, system type, search term, and pagination."""
        stmt = select(Plant)

        if status:
            stmt = stmt.where(Plant.status == status)
        if system_type:
            stmt = stmt.where(Plant.system_type == system_type)
        if is_active is not None:
            stmt = stmt.where(Plant.is_active == is_active)
        if search:
            search_pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    Plant.name.ilike(search_pattern),
                    Plant.location.ilike(search_pattern),
                )
            )

        stmt = stmt.order_by(Plant.id.asc()).offset(offset).limit(limit)
        return list(db.scalars(stmt).all())

    def count_with_filters(
        self,
        db: Session,
        *,
        status: Optional[str] = None,
        system_type: Optional[str] = None,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> int:
        """Count total matching plants for pagination."""
        stmt = select(func.count()).select_from(Plant)

        if status:
            stmt = stmt.where(Plant.status == status)
        if system_type:
            stmt = stmt.where(Plant.system_type == system_type)
        if is_active is not None:
            stmt = stmt.where(Plant.is_active == is_active)
        if search:
            search_pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    Plant.name.ilike(search_pattern),
                    Plant.location.ilike(search_pattern),
                )
            )

        return db.scalar(stmt) or 0

    def get_with_inverters(self, db: Session, plant_id: int) -> Optional[Plant]:
        """Fetch plant eagerly loading related inverters."""
        stmt = select(Plant).where(Plant.id == plant_id).options(selectinload(Plant.inverters))
        return db.scalar(stmt)


plant_repository = PlantRepository()
