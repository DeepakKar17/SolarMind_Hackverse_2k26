"""FaultCatalogEntry ORM Model for SolarMind.

Stores standardized solar PV fault definitions, classification hierarchies,
remediation guidelines, IEC standards cross-references, and estimated yield loss algorithms.
"""

from typing import Optional
from sqlalchemy import Boolean, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class FaultCatalogEntry(Base, TimestampMixin):
    """Standard fault catalog definition for solar installations."""

    __tablename__ = "fault_catalog_entries"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g. 'FC-SHADE-01', 'FC-SOIL-02'
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # 'PARTIAL_SHADING' | 'SURFACE_SOILING' | 'STRING_DISCONNECT' | 'THERMAL_CLIPPING' | 'GRID_OVERVOLTAGE'

    severity_default: Mapped[str] = mapped_column(
        String(30), default="MEDIUM", nullable=False
    )  # 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

    description: Mapped[str] = mapped_column(Text, nullable=False)
    standard_remediation: Mapped[str] = mapped_column(Text, nullable=False)
    iec_standard_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # e.g. 'IEC 61724-1'
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        Index("ix_fault_catalog_cat_active", "category", "is_active"),
    )
