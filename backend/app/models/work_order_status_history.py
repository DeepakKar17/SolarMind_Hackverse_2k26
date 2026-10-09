"""WorkOrderStatusHistory ORM Model for SolarMind.

Maintains an immutable historical audit trail of all maintenance work order
status transitions, actors, timestamps, and technician sign-off notes.
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, utc_now

if TYPE_CHECKING:
    from app.models.work_order import WorkOrder
    from app.models.user import User


class WorkOrderStatusHistory(Base):
    """Immutable record of work order status progression."""

    __tablename__ = "work_order_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    work_order_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    to_status: Mapped[str] = mapped_column(String(40), nullable=False, index=True)

    changed_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    changed_by_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    # Relationships
    work_order: Mapped["WorkOrder"] = relationship("WorkOrder", backref="status_history")
    changed_by: Mapped[Optional["User"]] = relationship("User")

    __table_args__ = (
        Index("ix_wo_status_history_order_time", "work_order_id", "timestamp"),
    )
