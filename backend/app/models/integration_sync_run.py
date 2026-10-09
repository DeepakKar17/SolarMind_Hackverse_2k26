"""IntegrationSyncRun ORM Model for SolarMind.

Tracks scheduled and on-demand synchronization runs for hardware OpenAPI connectors
(Deye Cloud, Sungrow iSolarCloud, Huawei FusionSolar, and MQTT Broker).
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, utc_now

if TYPE_CHECKING:
    from app.models.integration_config import IntegrationConfig


class IntegrationSyncRun(Base):
    """Execution run record for external hardware cloud syncs."""

    __tablename__ = "integration_sync_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    integration_id: Mapped[str] = mapped_column(
        String(60), ForeignKey("integration_configs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)

    records_ingested: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="SUCCESS", nullable=False, index=True)  # 'SUCCESS' | 'FAILED' | 'PARTIAL'
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    # Relationships
    integration: Mapped["IntegrationConfig"] = relationship("IntegrationConfig", backref="sync_runs")

    __table_args__ = (
        Index("ix_sync_run_integ_time", "integration_id", "timestamp"),
    )
