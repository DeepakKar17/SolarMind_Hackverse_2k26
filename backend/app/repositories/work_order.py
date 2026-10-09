"""WorkOrder Repository implementation."""

from datetime import date
from typing import List, Optional
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.work_order import WorkOrder
from app.repositories.base import BaseRepository
from app.schemas.work_order import WorkOrderCreate, WorkOrderUpdate


class WorkOrderRepository(BaseRepository[WorkOrder, WorkOrderCreate, WorkOrderUpdate]):
    """Repository handling database operations for WorkOrder tickets."""

    def __init__(self):
        super().__init__(WorkOrder)

    def list_with_filters(
        self,
        db: Session,
        *,
        plant_id: Optional[int] = None,
        assigned_to: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        due_before: Optional[date] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> List[WorkOrder]:
        """Query work orders with filtering on technician, status, priority, and due dates."""
        stmt = select(WorkOrder)

        if plant_id:
            stmt = stmt.where(WorkOrder.plant_id == plant_id)
        if assigned_to:
            stmt = stmt.where(WorkOrder.assigned_to == assigned_to)
        if status:
            stmt = stmt.where(WorkOrder.status == status)
        if priority:
            stmt = stmt.where(WorkOrder.priority == priority)
        if due_before:
            stmt = stmt.where(WorkOrder.due_date <= due_before)

        stmt = stmt.order_by(desc(WorkOrder.created_at)).offset(offset).limit(limit)
        return list(db.scalars(stmt).all())

    def count_with_filters(
        self,
        db: Session,
        *,
        plant_id: Optional[int] = None,
        assigned_to: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        due_before: Optional[date] = None,
    ) -> int:
        """Count total matching work orders."""
        stmt = select(func.count()).select_from(WorkOrder)

        if plant_id:
            stmt = stmt.where(WorkOrder.plant_id == plant_id)
        if assigned_to:
            stmt = stmt.where(WorkOrder.assigned_to == assigned_to)
        if status:
            stmt = stmt.where(WorkOrder.status == status)
        if priority:
            stmt = stmt.where(WorkOrder.priority == priority)
        if due_before:
            stmt = stmt.where(WorkOrder.due_date <= due_before)

        return db.scalar(stmt) or 0

    def get_with_diagnosis(self, db: Session, work_order_id: str) -> Optional[WorkOrder]:
        """Fetch work order with eager loaded diagnosis."""
        stmt = select(WorkOrder).where(WorkOrder.id == work_order_id).options(selectinload(WorkOrder.diagnosis))
        return db.scalar(stmt)


work_order_repository = WorkOrderRepository()
