"""SolarMind Grid Interruption and Outage Event Service.

Evaluates AC voltage, grid frequency, inverter status, documented alerts, and daylight
telemetry gaps to record defensible grid outage timelines and quantify lost solar yield.
"""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.errors import EntityNotFoundError
from app.models.alert import Alert
from app.models.inverter import Inverter
from app.models.outage_event import OutageEvent
from app.models.plant import Plant
from app.models.telemetry import Telemetry
from app.schemas.outage import (
    OutageDetectionRequest,
    OutageDetectionResponse,
    OutageEventCreate,
    OutageEventResponse,
    OutageEventUpdate,
)
from app.services.expected_generation_service import expected_generation_service

logger = logging.getLogger("solarmind.services.outage")

GRID_COLLAPSE_VOLTAGE_THRESHOLD_V = 15.0
GRID_UNDERVOLTAGE_SAG_THRESHOLD_V = 170.0
DC_ARRAY_ILLUMINATED_THRESHOLD_V = 50.0
MIN_DAYLIGHT_SOLAR_ELEVATION_DEG = 10.0
MAX_TELEMETRY_GAP_MINUTES_BEFORE_SUSPECTED_OUTAGE = 60.0


class OutageService:
    """Service detecting, consolidating, and managing grid power interruption events."""

    def list_outages(
        self,
        db: Session,
        *,
        plant_id: Optional[int] = None,
        inverter_id: Optional[str] = None,
        status: Optional[str] = None,
        event_type: Optional[str] = None,
        resolved: Optional[bool] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        offset: int = 0,
        limit: int = 50,
    ) -> List[OutageEvent]:
        """List outage events with optional multi-attribute filtering."""
        query = select(OutageEvent)

        if plant_id:
            query = query.where(OutageEvent.plant_id == plant_id)
        if inverter_id:
            query = query.where(OutageEvent.inverter_id == inverter_id)
        if status:
            query = query.where(OutageEvent.status == status.strip().upper())
        if event_type:
            query = query.where(OutageEvent.event_type == event_type.strip().upper())
        if resolved is not None:
            query = query.where(OutageEvent.resolved == resolved)
        if start_time:
            query = query.where(OutageEvent.start_time >= start_time)
        if end_time:
            query = query.where(OutageEvent.start_time <= end_time)

        query = query.order_by(desc(OutageEvent.start_time)).offset(offset).limit(limit)
        return list(db.scalars(query).all())

    def get_outage(self, db: Session, outage_id: int) -> OutageEvent:
        """Get a single outage event by ID."""
        event = db.get(OutageEvent, outage_id)
        if not event:
            raise EntityNotFoundError("OutageEvent", outage_id)
        return event

    def create_outage(self, db: Session, create_in: OutageEventCreate) -> OutageEvent:
        """Manually record a grid outage event."""
        plant = db.get(Plant, create_in.plant_id)
        if not plant:
            raise EntityNotFoundError("Plant", create_in.plant_id)

        start_utc = create_in.start_time.replace(tzinfo=None) if create_in.start_time.tzinfo else create_in.start_time
        end_utc = (create_in.end_time.replace(tzinfo=None) if create_in.end_time.tzinfo else create_in.end_time) if create_in.end_time else None

        duration = create_in.duration_minutes
        if duration is None and end_utc:
            duration = round((end_utc - start_utc).total_seconds() / 60.0, 1)

        event = OutageEvent(
            plant_id=plant.id,
            inverter_id=create_in.inverter_id,
            event_type=create_in.event_type.strip().upper(),
            status=create_in.status.strip().upper(),
            start_time=start_utc,
            end_time=end_utc,
            duration_minutes=duration,
            estimated_lost_energy_kwh=create_in.estimated_lost_energy_kwh,
            estimated_financial_loss_inr=create_in.estimated_financial_loss_inr,
            reason=create_in.reason,
            evidence=create_in.evidence,
            detection_limitations=create_in.detection_limitations,
            resolved=create_in.resolved,
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    def update_outage(self, db: Session, outage_id: int, update_in: OutageEventUpdate) -> OutageEvent:
        """Update or resolve an existing outage event."""
        event = db.get(OutageEvent, outage_id)
        if not event:
            raise EntityNotFoundError("OutageEvent", outage_id)

        update_dict = update_in.model_dump(exclude_unset=True)

        if "end_time" in update_dict and update_dict["end_time"]:
            end_val = update_dict["end_time"]
            end_utc = end_val.replace(tzinfo=None) if end_val.tzinfo else end_val
            event.end_time = end_utc
            if event.start_time:
                event.duration_minutes = round((end_utc - event.start_time).total_seconds() / 60.0, 1)

        for field, value in update_dict.items():
            if field != "end_time":
                setattr(event, field, value)

        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    def detect_grid_outages(
        self,
        db: Session,
        request: OutageDetectionRequest,
    ) -> OutageDetectionResponse:
        """Evaluate raw telemetry, AC voltage drops, and comms gaps to discover and quantify grid outage timelines."""
        plant = db.get(Plant, request.plant_id)
        if not plant:
            raise EntityNotFoundError("Plant", request.plant_id)

        # Inverters to evaluate
        inv_query = select(Inverter).where(Inverter.plant_id == plant.id)
        if request.inverter_id:
            inv_query = inv_query.where(Inverter.id == request.inverter_id)
        inverters = list(db.scalars(inv_query).all())

        if request.inverter_id and not inverters:
            raise EntityNotFoundError("Inverter", request.inverter_id)

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        end_time = (request.end_time.replace(tzinfo=None) if request.end_time.tzinfo else request.end_time) if request.end_time else now
        start_time = (request.start_time.replace(tzinfo=None) if request.start_time.tzinfo else request.start_time) if request.start_time else (end_time - timedelta(hours=request.lookback_hours))

        tariff_rate = plant.tariff_rate_inr or 7.50
        lat = plant.latitude or 20.2961
        lon = plant.longitude or 85.8245

        total_telemetry_samples = 0
        detected_outages: List[OutageEvent] = []

        # Existing active/recorded outages to prevent duplicate insertion
        existing_outage_stmt = select(OutageEvent).where(
            OutageEvent.plant_id == plant.id,
            OutageEvent.start_time >= start_time - timedelta(hours=1),
            OutageEvent.start_time <= end_time,
        )
        existing_outages = list(db.scalars(existing_outage_stmt).all())
        existing_starts = {o.start_time for o in existing_outages}

        for inv in inverters:
            # Query telemetry in chronological order
            tel_stmt = (
                select(Telemetry)
                .where(
                    Telemetry.inverter_id == inv.id,
                    Telemetry.timestamp >= start_time,
                    Telemetry.timestamp <= end_time,
                )
                .order_by(Telemetry.timestamp.asc())
            )
            samples = list(db.scalars(tel_stmt).all())
            total_telemetry_samples += len(samples)

            if not samples:
                continue

            # Query alerts
            alerts_stmt = select(Alert).where(
                Alert.inverter_id == inv.id,
                Alert.event_timestamp >= start_time,
                Alert.event_timestamp <= end_time,
            )
            alerts = list(db.scalars(alerts_stmt).all())

            # Sliding window evaluation to group contiguous outage periods
            current_outage_start: Optional[datetime] = None
            current_outage_type: str = "GRID_OUTAGE"
            current_outage_status: str = "CONFIRMED"
            current_evidence: Dict[str, Any] = {}
            current_limitations: List[str] = []
            current_samples_in_outage: List[Telemetry] = []

            for i, tel in enumerate(samples):
                v_ac = float(tel.v_ac) if tel.v_ac is not None else None
                v_dc = float(tel.v_dc) if tel.v_dc is not None else 0.0
                freq = float(tel.frequency_hz) if tel.frequency_hz is not None else None
                p_ac = float(tel.p_ac) if tel.p_ac is not None else 0.0

                # Calculate solar position at this sample
                solar_pos = expected_generation_service.calculate_solar_position(
                    timestamp=tel.timestamp,
                    latitude=lat,
                    longitude=lon,
                )
                is_sun_up = solar_pos.solar_elevation_deg >= MIN_DAYLIGHT_SOLAR_ELEVATION_DEG

                # Check gap between previous sample
                gap_minutes = 0.0
                if i > 0:
                    prev_ts = samples[i - 1].timestamp
                    gap_minutes = (tel.timestamp - prev_ts).total_seconds() / 60.0

                # 1. Daylight Telemetry Gap Condition (Comms/AC Power Interruption Suspected)
                if gap_minutes >= MAX_TELEMETRY_GAP_MINUTES_BEFORE_SUSPECTED_OUTAGE and is_sun_up:
                    prev_sample = samples[i - 1]
                    gap_start = prev_sample.timestamp
                    gap_end = tel.timestamp
                    gap_duration = gap_minutes

                    if gap_start not in existing_starts:
                        # Estimate lost energy across the gap
                        calc = expected_generation_service.estimate_expected_power(
                            installed_capacity_kwp=inv.rated_ac_power_kw,
                            timestamp=gap_start,
                            latitude=lat,
                            longitude=lon,
                        )
                        gap_loss_kwh = round((calc.expected_power_kw * (gap_duration / 60.0)) * 0.85, 2)

                        outage_ev = OutageEvent(
                            plant_id=plant.id,
                            inverter_id=inv.id,
                            event_type="TELEMETRY_GAP_SUSPECTED",
                            status="SUSPECTED",
                            start_time=gap_start,
                            end_time=gap_end,
                            duration_minutes=round(gap_duration, 1),
                            estimated_lost_energy_kwh=gap_loss_kwh,
                            estimated_financial_loss_inr=round(gap_loss_kwh * tariff_rate, 2),
                            reason="Telemetry gap during daylight hours suggests power-cut or communication gateway loss.",
                            evidence={
                                "gap_duration_minutes": gap_duration,
                                "solar_elevation_deg": solar_pos.solar_elevation_deg,
                                "pre_gap_power_kw": float(prev_sample.p_ac or 0.0),
                            },
                            detection_limitations=[
                                "AC supply interruption suspected; data logger is offline and physical MCB status cannot be confirmed remotely.",
                                "Duration and lost yield are estimated from the last received reading before telemetry resumption.",
                            ],
                            resolved=True,
                        )
                        detected_outages.append(outage_ev)
                        existing_starts.add(gap_start)

                # 2. Confirmed Outage: AC Voltage Collapsed (<15V) while DC is energized or daylight
                is_grid_collapsed = (v_ac is not None and v_ac < GRID_COLLAPSE_VOLTAGE_THRESHOLD_V)
                is_undervoltage_sag = (v_ac is not None and GRID_COLLAPSE_VOLTAGE_THRESHOLD_V <= v_ac < GRID_UNDERVOLTAGE_SAG_THRESHOLD_V)
                is_freq_trip = (freq is not None and (freq < 45.0 or freq > 55.0))

                is_in_outage = (is_grid_collapsed or is_undervoltage_sag or is_freq_trip) and (v_dc >= DC_ARRAY_ILLUMINATED_THRESHOLD_V or is_sun_up or p_ac == 0.0)

                if is_in_outage:
                    if current_outage_start is None:
                        current_outage_start = tel.timestamp
                        if is_grid_collapsed:
                            current_outage_type = "GRID_OUTAGE"
                            current_outage_status = "CONFIRMED"
                            current_evidence = {
                                "v_ac_v": v_ac,
                                "v_dc_v": v_dc,
                                "p_ac_kw": p_ac,
                                "frequency_hz": freq,
                                "trigger": "AC grid voltage collapsed to <15V with solar DC array energized",
                            }
                            current_limitations = [
                                "Confirmed AC grid loss at inverter terminals.",
                            ]
                        elif is_undervoltage_sag:
                            current_outage_type = "UNDERVOLTAGE_SAG"
                            current_outage_status = "SUSPECTED"
                            current_evidence = {
                                "v_ac_v": v_ac,
                                "p_ac_kw": p_ac,
                                "trigger": "Severe grid voltage sag below inverter operational threshold",
                            }
                            current_limitations = [
                                "Grid supply interruption suspected; voltage dipped below standard operating window.",
                            ]
                        elif is_freq_trip:
                            current_outage_type = "FREQUENCY_TRIP"
                            current_outage_status = "CONFIRMED"
                            current_evidence = {
                                "frequency_hz": freq,
                                "p_ac_kw": p_ac,
                                "trigger": "Utility grid frequency instability triggered anti-islanding trip",
                            }
                            current_limitations = []

                    current_samples_in_outage.append(tel)

                else:
                    # Normal voltage restored -> close current outage interval
                    if current_outage_start is not None:
                        outage_end = tel.timestamp
                        duration_mins = (outage_end - current_outage_start).total_seconds() / 60.0

                        if current_outage_start not in existing_starts:
                            calc = expected_generation_service.estimate_expected_power(
                                installed_capacity_kwp=inv.rated_ac_power_kw,
                                timestamp=current_outage_start,
                                latitude=lat,
                                longitude=lon,
                            )
                            lost_kwh = round((calc.expected_power_kw * (duration_mins / 60.0)) * 0.90, 2)

                            outage_ev = OutageEvent(
                                plant_id=plant.id,
                                inverter_id=inv.id,
                                event_type=current_outage_type,
                                status=current_outage_status,
                                start_time=current_outage_start,
                                end_time=outage_end,
                                duration_minutes=round(duration_mins, 1),
                                estimated_lost_energy_kwh=lost_kwh,
                                estimated_financial_loss_inr=round(lost_kwh * tariff_rate, 2),
                                reason=f"{current_outage_type} detected on inverter {inv.id}.",
                                evidence=current_evidence,
                                detection_limitations=current_limitations,
                                resolved=True,
                            )
                            detected_outages.append(outage_ev)
                            existing_starts.add(current_outage_start)

                        current_outage_start = None
                        current_samples_in_outage = []

            # Check if outage is ongoing at the end of the evaluation window
            if current_outage_start is not None:
                duration_mins = (end_time - current_outage_start).total_seconds() / 60.0
                if current_outage_start not in existing_starts:
                    calc = expected_generation_service.estimate_expected_power(
                        installed_capacity_kwp=inv.rated_ac_power_kw,
                        timestamp=current_outage_start,
                        latitude=lat,
                        longitude=lon,
                    )
                    lost_kwh = round((calc.expected_power_kw * (duration_mins / 60.0)) * 0.90, 2)

                    ongoing_ev = OutageEvent(
                        plant_id=plant.id,
                        inverter_id=inv.id,
                        event_type=current_outage_type,
                        status=current_outage_status,
                        start_time=current_outage_start,
                        end_time=None,  # Incomplete / Ongoing outage
                        duration_minutes=round(duration_mins, 1),
                        estimated_lost_energy_kwh=lost_kwh,
                        estimated_financial_loss_inr=round(lost_kwh * tariff_rate, 2),
                        reason=f"Active ongoing {current_outage_type} on inverter {inv.id}.",
                        evidence=current_evidence,
                        detection_limitations=current_limitations + ["Outage is ongoing; end time and final lost yield will be updated once grid restores."],
                        resolved=False,
                    )
                    detected_outages.append(ongoing_ev)
                    existing_starts.add(current_outage_start)

        # Persist to database if requested
        created_count = 0
        if request.auto_persist and detected_outages:
            db.add_all(detected_outages)
            db.commit()
            created_count = len(detected_outages)
            for d in detected_outages:
                db.refresh(d)

        response_items = [OutageEventResponse.model_validate(d) for d in detected_outages]

        return OutageDetectionResponse(
            plant_id=plant.id,
            inverters_evaluated=len(inverters),
            telemetry_records_evaluated=total_telemetry_samples,
            outages_detected=len(detected_outages),
            new_outages_created=created_count,
            events=response_items,
            summary_notes=(
                f"Evaluated {total_telemetry_samples} telemetry samples across {len(inverters)} inverter(s). "
                f"Discovered {len(detected_outages)} grid interruption intervals."
            ),
        )


outage_service = OutageService()
