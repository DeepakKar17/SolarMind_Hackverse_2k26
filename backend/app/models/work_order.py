"""WorkOrder ORM Model.

Maintenance intervention tickets, field service tracking, and resolution history.
"""

from datetime import date
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, Date, Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.plant import Plant
    from app.models.inverter import Inverter
    from app.models.pv_asset import PVAsset
    from app.models.diagnosis import Diagnosis


class WorkOrder(Base, TimestampMixin):
    __tablename__ = "work_orders"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g. "WO-801"
    plant_id: Mapped[int] = mapped_column(Integer, ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True)
    inverter_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("inverters.id", ondelete="SET NULL"), nullable=True, index=True)
    pv_asset_id: Mapped[Optional[str]] = mapped_column(String(60), ForeignKey("pv_assets.id", ondelete="SET NULL"), nullable=True, index=True)
    diagnosis_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("diagnoses.id", ondelete="SET NULL"), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(150), nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="HIGH", nullable=False, index=True)  # 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    assigned_to: Mapped[str] = mapped_column(String(100), nullable=False, index=True)  # Assigned technician identifier
    technician_id: Mapped[Optional[int]] = mapped_column(Integer, index=True, nullable=True)
    service_provider: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    completed_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    duration_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cost_inr: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="OPEN", nullable=False, index=True)  # 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED_PENDING_VERIFICATION' | 'VERIFIED' | 'CLOSED' | 'CANCELLED'

    # Technician Inspection & Maintenance Observations
    checklist: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)
    fault_observations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    repair_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parts_replaced: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    before_photo_id: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    after_photo_id: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    requires_follow_up: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    follow_up_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Post-Repair Recovery Verification
    verification_status: Mapped[str] = mapped_column(String(40), default="PENDING", nullable=False, index=True)  # 'PENDING' | 'VERIFIED_FULL_RECOVERY' | 'PARTIAL_RECOVERY' | 'INCONCLUSIVE' | 'INSUFFICIENT_DATA'
    verification_details: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    plant: Mapped["Plant"] = relationship("Plant", back_populates="work_orders")
    inverter: Mapped[Optional["Inverter"]] = relationship("Inverter", back_populates="work_orders")
    pv_asset: Mapped[Optional["PVAsset"]] = relationship("PVAsset", back_populates="work_orders")
    diagnosis: Mapped[Optional["Diagnosis"]] = relationship("Diagnosis", back_populates="work_orders")

    __table_args__ = (
        Index("ix_work_orders_plant_status", "plant_id", "status"),
        Index("ix_work_orders_technician_status", "assigned_to", "status"),
    )
