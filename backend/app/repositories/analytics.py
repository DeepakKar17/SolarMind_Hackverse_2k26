"""Analytics Repository providing database aggregations for reporting and generation trends."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.diagnosis import Diagnosis
from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.telemetry import Telemetry
from app.models.work_order import WorkOrder
from app.schemas.analytics import (
    AnalyticsDashboardResponse,
    AnalyticsTimeseriesPoint,
    FaultCategorySummary,
    MaintenanceSlaMetrics,
)


class AnalyticsRepository:
    """Repository executing statistical and historical time-series aggregations."""

    def get_dashboard_summary(
        self,
        db: Session,
        *,
        plant_id: Optional[int] = None,
        start_time: datetime,
        end_time: datetime,
    ) -> AnalyticsDashboardResponse:
        """Compute aggregated dashboard analytics over a specified time window."""
        from app.services.analytics_service import analytics_service

        return analytics_service.get_summary(
            db,
            plant_id=plant_id,
            start_time=start_time,
            end_time=end_time,
        )


analytics_repository = AnalyticsRepository()
