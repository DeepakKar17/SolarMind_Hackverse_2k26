"""SolarMind Integration Synchronization Service.

Orchestrates data synchronization between external hardware providers (Deye, Sungrow, Simulator)
and SolarMind's database, handling deduplication, atomic transaction recording, and compliance audit logs.
"""

import logging
import time
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.base import BaseInverterProvider, NormalizedTelemetry, SyncRunSummary
from app.models.inverter import Inverter
from app.models.integration_config import IntegrationConfig
from app.models.integration_sync_run import IntegrationSyncRun
from app.models.telemetry import Telemetry
from app.services.audit_service import log_audit_event

logger = logging.getLogger("solarmind.integrations.sync")


class IntegrationSyncService:
    """Coordinates telemetry ingestion runs with duplicate prevention and audit logging."""

    async def sync_inverter_telemetry(
        self,
        db: Session,
        provider: BaseInverterProvider,
        inverter: Inverter,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> SyncRunSummary:
        """Fetch telemetry from provider for an inverter and persist deduplicated records."""
        start_clock = time.perf_counter()
        started_at = datetime.now(timezone.utc)
        integration_id = provider.provider_id

        # 1. Fetch points from provider
        points: List[NormalizedTelemetry] = []
        error_msg: Optional[str] = None
        try:
            if start_time and end_time:
                points = await provider.get_historical_telemetry(
                    device_sn=inverter.serial_number or inverter.id,
                    start_time=start_time,
                    end_time=end_time,
                )
            else:
                single_point = await provider.get_latest_telemetry(inverter.serial_number or inverter.id)
                if single_point:
                    points = [single_point]
        except Exception as exc:
            error_msg = str(exc)
            logger.error("Failed to query telemetry from provider %s: %s", provider.provider_name, exc)

        # 2. Ingest and deduplicate
        ingested = 0
        failed = 0
        for pt in points:
            # Check duplicate in DB
            existing = db.scalar(
                select(Telemetry.id).where(
                    Telemetry.inverter_id == inverter.id,
                    Telemetry.timestamp == pt.timestamp,
                )
            )
            if existing:
                continue

            try:
                # p_ac in NormalizedTelemetry is in Watts, convert to kW if needed for Telemetry model
                p_ac_kw = pt.p_ac / 1000.0 if pt.p_ac > 50.0 else pt.p_ac
                p_dc_kw = pt.p_dc1 / 1000.0 if pt.p_dc1 > 50.0 else pt.p_dc1

                record = Telemetry(
                    inverter_id=inverter.id,
                    timestamp=pt.timestamp,
                    v_dc=pt.v_dc1,
                    i_dc=pt.i_dc1,
                    p_dc=p_dc_kw,
                    v_ac=pt.v_ac,
                    i_ac=pt.i_ac,
                    p_ac=p_ac_kw,
                    frequency_hz=pt.grid_frequency_hz,
                    temperature_c=pt.temperature_c,
                    daily_yield_kwh=pt.daily_yield_kwh,
                    total_yield_kwh=pt.total_yield_kwh,
                    data_source="SIMULATED" if pt.is_simulated else "OPENAPI_DEYE",
                    data_quality_flag="VALID",
                )
                db.add(record)
                ingested += 1
            except Exception as exc:
                failed += 1
                logger.warning("Failed to insert telemetry point for inverter %s: %s", inverter.id, exc)

        # 3. Update inverter status and last_telemetry_at
        if points:
            latest_ts = max(p.timestamp for p in points)
            inverter.last_telemetry_at = latest_ts
            inverter.status = "NORMAL"
            db.add(inverter)

        duration_ms = int((time.perf_counter() - start_clock) * 1000.0)
        completed_at = datetime.now(timezone.utc)
        status_str = "SUCCESS" if not error_msg and failed == 0 else ("PARTIAL" if ingested > 0 else "FAILED")

        # 4. Record IntegrationSyncRun if IntegrationConfig exists
        integ_config = db.get(IntegrationConfig, integration_id)
        if integ_config:
            sync_run = IntegrationSyncRun(
                integration_id=integ_config.id,
                provider=provider.provider_name,
                records_ingested=ingested,
                records_failed=failed,
                status=status_str,
                duration_ms=duration_ms,
                error_message=error_msg,
                timestamp=completed_at,
            )
            db.add(sync_run)
            if status_str in ("SUCCESS", "PARTIAL"):
                integ_config.last_successful_sync = completed_at
                integ_config.last_error = None
                integ_config.status = "CONNECTED"
            else:
                integ_config.last_error = error_msg
                integ_config.status = "ERROR"
            db.add(integ_config)

        # 5. Log audit event
        log_audit_event(
            db=db,
            actor=None,
            action="INTEGRATION_SYNC",
            target_type="INTEGRATION",
            target_id=integration_id,
            details=f"Provider {provider.provider_name} synced for inverter {inverter.id}. Ingested {ingested} records.",
            status=status_str,
        )

        db.commit()

        return SyncRunSummary(
            integration_id=integration_id,
            provider=provider.provider_name,
            status=status_str,
            records_ingested=ingested,
            errors_count=failed + (1 if error_msg else 0),
            duration_seconds=duration_ms / 1000.0,
            started_at=started_at,
            completed_at=completed_at,
            details=f"Ingested {ingested} points for inverter {inverter.id}" + (f" (Error: {error_msg})" if error_msg else ""),
        )


integration_sync_service = IntegrationSyncService()
