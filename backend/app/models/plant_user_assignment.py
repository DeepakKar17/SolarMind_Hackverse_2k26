"""PlantUserAssignment ORM Model for SolarMind.

Represents explicit multi-tenant assignments linking users (homeowners,
technicians, operators, managers) to specific solar photovoltaic installations.
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, utc_now

if TYPE_CHECKING:
    from app.models.plant import Plant
    from app.models.user import User


class PlantUserAssignment(Base):
    """Explicit association between a User and a Plant with role scoping."""

    __tablename__ = "plant_user_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(
        String(50), default="homeowner", nullable=False, index=True
    )  # 'homeowner' | 'technician' | 'operator' | 'manager'

    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    assigned_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    plant: Mapped["Plant"] = relationship("Plant", backref="user_assignments")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], backref="plant_assignments")
    assigned_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[assigned_by_id])

    __table_args__ = (
        UniqueConstraint("plant_id", "user_id", name="uq_plant_user_assignment"),
        Index("ix_plant_user_role", "plant_id", "user_id", "role"),
    )
