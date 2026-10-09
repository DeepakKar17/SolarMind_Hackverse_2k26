"""SolarMind Why-Low Diagnostic Workflow Engine.

Executes a strict, defensible 10-step evaluation pipeline to diagnose low solar generation
without making unfounded assumptions or falsely flagging healthy inverters.
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
from app.models.pv_asset import PVAsset
from app.models.telemetry import Telemetry
from app.models.weather_record import WeatherRecord
from app.schemas.why_low import (
    WhyLowDiagnosticRequest,
    WhyLowDiagnosticResponse,
)
from app.services.expected_generation_service import expected_generation_service

logger = logging.getLogger("solarmind.services.why_low")

# Operational Constants
TELEMETRY_STALENESS_MAX_MINUTES = 120.0  # 2 hours staleness threshold during day
MIN_DAYLIGHT_ELEVATION_DEG = 5.0
LOW_IRRADIANCE_THRESHOLD_WM2 = 250.0
HIGH_IRRADIANCE_THRESHOLD_WM2 = 500.0
HIGH_TEMP_THRESHOLD_C = 72.0
GRID_COLLAPSE_VOLTAGE_V = 15.0
DC_VOLTAGE_PRESENT_V = 50.0
STRING_IMBALANCE_MIN_RATIO = 0.20


class WhyLowService:
    """Evaluates why solar generation is low through a deterministic 10-step pipeline."""

    def diagnose_why_low(
        self,
        db: Session,
        request: WhyLowDiagnosticRequest,
    ) -> WhyLowDiagnosticResponse:
        """Execute the Why-Low diagnostic workflow for a plant or inverter."""
        # 0. Plant & Inverter Resolution
        plant = db.get(Plant, request.plant_id)
        if not plant:
            raise EntityNotFoundError("Plant", request.plant_id)

        target_inverter: Optional[Inverter] = None
        if request.inverter_id:
            target_inverter = db.get(Inverter, request.inverter_id)
            if not target_inverter or target_inverter.plant_id != plant.id:
                raise EntityNotFoundError("Inverter", request.inverter_id)

        # Capacity resolution
        if target_inverter:
            capacity_kwp = target_inverter.rated_ac_power_kw
        else:
            capacity_kwp = plant.installed_capacity_kwp

        # Target evaluation timestamp
        eval_time = request.timestamp
        if eval_time is None:
            # Look up latest telemetry timestamp or default to now
            latest_tel_stmt = (
                select(Telemetry)
                .join(Inverter)
                .where(Inverter.plant_id == plant.id)
                .order_by(desc(Telemetry.timestamp))
                .limit(1)
            )
            latest_tel = db.scalars(latest_tel_stmt).first()
            if latest_tel and latest_tel.timestamp:
                eval_time = latest_tel.timestamp
            else:
                eval_time = datetime.now(timezone.utc)

        # Ensure naive UTC for comparisons
        if eval_time.tzinfo is not None:
            eval_time_utc = eval_time.astimezone(timezone.utc).replace(tzinfo=None)
        else:
            eval_time_utc = eval_time

        # Query recent telemetry within lookback window
        lookback_start = eval_time_utc - timedelta(hours=request.lookback_hours)
        tel_query = select(Telemetry).join(Inverter).where(
            Inverter.plant_id == plant.id,
            Telemetry.timestamp >= lookback_start,
            Telemetry.timestamp <= eval_time_utc,
        )
        if target_inverter:
            tel_query = tel_query.where(Telemetry.inverter_id == target_inverter.id)

        telemetry_samples = list(db.scalars(tel_query.order_by(desc(Telemetry.timestamp))).all())

        # Query latest weather record near eval_time
        weather_stmt = (
            select(WeatherRecord)
            .where(
                WeatherRecord.plant_id == plant.id,
                WeatherRecord.timestamp <= eval_time_utc,
                WeatherRecord.timestamp >= eval_time_utc - timedelta(hours=2),
            )
            .order_by(desc(WeatherRecord.timestamp))
            .limit(1)
        )
        weather_record = db.scalars(weather_stmt).first()

        # Query active outage events
        outage_stmt = select(OutageEvent).where(
            OutageEvent.plant_id == plant.id,
            OutageEvent.start_time <= eval_time_utc,
            (OutageEvent.end_time.is_(None) | (OutageEvent.end_time >= eval_time_utc)),
        )
        active_outages = list(db.scalars(outage_stmt).all())

        # Query active alerts for plant/inverter
        alert_stmt = select(Alert).where(
            Alert.plant_id == plant.id,
            Alert.status == "ACTIVE",
            Alert.event_timestamp <= eval_time_utc,
        )
        if target_inverter:
            alert_stmt = alert_stmt.where(Alert.inverter_id == target_inverter.id)
        active_alerts = list(db.scalars(alert_stmt).all())

        # Query PV assets
        pv_asset_query = select(PVAsset).join(Inverter).where(Inverter.plant_id == plant.id)
        if target_inverter:
            pv_asset_query = pv_asset_query.where(PVAsset.inverter_id == target_inverter.id)
        pv_assets = list(db.scalars(pv_asset_query).all())

        # Compute solar position & clear-sky baseline
        lat = plant.latitude or 20.2961
        lon = plant.longitude or 85.8245
        solar_pos = expected_generation_service.calculate_solar_position(
            timestamp=eval_time_utc,
            latitude=lat,
            longitude=lon,
        )

        # -------------------------------------------------------------
        # STEP 1: Validate data quality and freshness
        # -------------------------------------------------------------
        if not telemetry_samples:
            expected_calc = expected_generation_service.estimate_expected_power(
                installed_capacity_kwp=capacity_kwp,
                timestamp=eval_time_utc,
                latitude=lat,
                longitude=lon,
            )
            return WhyLowDiagnosticResponse(
                plant_id=plant.id,
                inverter_id=target_inverter.id if target_inverter else None,
                timestamp=eval_time_utc,
                observed_power_kw=0.0,
                expected_power_kw=expected_calc.expected_power_kw,
                baseline_method=expected_calc.baseline_method,
                yield_gap_kw=expected_calc.expected_power_kw,
                yield_gap_pct=100.0 if expected_calc.expected_power_kw > 0 else 0.0,
                candidate_cause="DATA_QUALITY_OR_STALENESS",
                candidate_cause_title="No Telemetry Data Stream Available",
                severity="WARNING",
                is_fault=False,
                supporting_evidence=[
                    f"No telemetry records found for plant within lookback window of {request.lookback_hours} hours.",
                    f"Evaluated timestamp: {eval_time_utc.isoformat()} UTC.",
                ],
                contradictory_evidence=[],
                confidence_score=0.98,
                rule_score=1.0,
                score_meaning="Deterministic verification: zero telemetry records in database.",
                data_coverage=0.0,
                evaluation_step_reached=1,
                recommended_next_check="Check data logger communication gateway power, RS485/Modbus cabling, and internet link.",
                solar_position=solar_pos,
                raw_measurements={"sample_count": 0},
            )

        latest_tel = telemetry_samples[0]
        tel_age_minutes = (eval_time_utc - latest_tel.timestamp).total_seconds() / 60.0

        # Staleness check during daytime
        is_daytime = solar_pos.solar_elevation_deg >= MIN_DAYLIGHT_ELEVATION_DEG
        if is_daytime and tel_age_minutes > TELEMETRY_STALENESS_MAX_MINUTES:
            expected_calc = expected_generation_service.estimate_expected_power(
                installed_capacity_kwp=capacity_kwp,
                timestamp=eval_time_utc,
                latitude=lat,
                longitude=lon,
            )
            return WhyLowDiagnosticResponse(
                plant_id=plant.id,
                inverter_id=target_inverter.id if target_inverter else None,
                timestamp=eval_time_utc,
                observed_power_kw=float(latest_tel.p_ac or 0.0),
                expected_power_kw=expected_calc.expected_power_kw,
                baseline_method=expected_calc.baseline_method,
                yield_gap_kw=max(0.0, expected_calc.expected_power_kw - float(latest_tel.p_ac or 0.0)),
                yield_gap_pct=100.0,
                candidate_cause="DATA_QUALITY_OR_STALENESS",
                candidate_cause_title="Telemetry Stream is Stale During Daylight",
                severity="WARNING",
                is_fault=False,
                supporting_evidence=[
                    f"Latest telemetry reading is {tel_age_minutes:.1f} minutes old (threshold: {TELEMETRY_STALENESS_MAX_MINUTES:.0f} min).",
                    f"Sun is active (elevation: {solar_pos.solar_elevation_deg:.1f}°).",
                ],
                contradictory_evidence=[],
                confidence_score=0.95,
                rule_score=0.95,
                score_meaning="Time differential between evaluation timestamp and latest telemetry exceeds maximum staleness boundary.",
                data_coverage=0.2,
                evaluation_step_reached=1,
                recommended_next_check="Verify data logger WiFi/Ethernet connection and check telemetry ingestion queue.",
                solar_position=solar_pos,
                raw_measurements={"latest_telemetry_timestamp": latest_tel.timestamp.isoformat()},
            )

        # Corrupt data quality check
        if latest_tel.data_quality_flag in ("SUSPICIOUS", "MISSING_MEASUREMENTS") or (
            latest_tel.p_ac is not None and latest_tel.p_ac < 0.0
        ):
            expected_calc = expected_generation_service.estimate_expected_power(
                installed_capacity_kwp=capacity_kwp,
                timestamp=eval_time_utc,
                latitude=lat,
                longitude=lon,
            )
            return WhyLowDiagnosticResponse(
                plant_id=plant.id,
                inverter_id=target_inverter.id if target_inverter else None,
                timestamp=eval_time_utc,
                observed_power_kw=max(0.0, float(latest_tel.p_ac or 0.0)),
                expected_power_kw=expected_calc.expected_power_kw,
                baseline_method=expected_calc.baseline_method,
                yield_gap_kw=expected_calc.expected_power_kw,
                yield_gap_pct=100.0,
                candidate_cause="DATA_QUALITY_OR_STALENESS",
                candidate_cause_title="Corrupt or Suspicious Sensor Measurements",
                severity="MEDIUM",
                is_fault=False,
                supporting_evidence=[
                    f"Telemetry record flagged as '{latest_tel.data_quality_flag}'.",
                    f"Raw AC power: {latest_tel.p_ac} kW.",
                ],
                contradictory_evidence=[],
                confidence_score=0.92,
                rule_score=0.92,
                score_meaning="Sensor measurement validation detected invalid flag or out-of-bounds negative values.",
                data_coverage=0.3,
                evaluation_step_reached=1,
                recommended_next_check="Inspect CT current clamp polarity, transducer calibration, and Modbus register mapping.",
                solar_position=solar_pos,
                raw_measurements={"data_quality_flag": latest_tel.data_quality_flag},
            )

        # Extract measurements for remaining steps
        p_observed = float(latest_tel.p_ac or 0.0)
        v_dc = float(latest_tel.v_dc or 0.0)
        i_dc = float(latest_tel.i_dc or 0.0)
        v_ac = float(latest_tel.v_ac or 0.0) if latest_tel.v_ac is not None else None
        freq_hz = float(latest_tel.frequency_hz) if latest_tel.frequency_hz is not None else None
        poa_irr = float(latest_tel.poa_irradiance_wm2) if latest_tel.poa_irradiance_wm2 is not None else None
        inv_temp = float(latest_tel.temperature_c) if latest_tel.temperature_c is not None else None
        amb_temp = float(latest_tel.ambient_temp_c) if latest_tel.ambient_temp_c is not None else None

        if poa_irr is None and weather_record and weather_record.poa_irradiance_wm2 is not None:
            poa_irr = float(weather_record.poa_irradiance_wm2)
        if amb_temp is None and weather_record and weather_record.ambient_temperature_c is not None:
            amb_temp = float(weather_record.ambient_temperature_c)

        cloud_pct = float(weather_record.cloud_cover_pct) if weather_record and weather_record.cloud_cover_pct is not None else None

        # Build healthy historical points for baseline comparison
        healthy_historical: List[Tuple[datetime, float]] = [
            (t.timestamp, float(t.p_ac or 0.0))
            for t in telemetry_samples
            if t.data_quality_flag == "VALID" and (t.p_ac or 0.0) > 0.0
        ]

        # Calculate Expected Generation using most specific physical baseline
        expected_calc = expected_generation_service.estimate_expected_power(
            installed_capacity_kwp=capacity_kwp,
            timestamp=eval_time_utc,
            latitude=lat,
            longitude=lon,
            poa_irradiance_wm2=poa_irr,
            temperature_c=inv_temp,
            ambient_temp_c=amb_temp,
            cloud_cover_pct=cloud_pct,
            historical_healthy_points=healthy_historical,
        )
        p_expected = expected_calc.expected_power_kw
        baseline_method = expected_calc.baseline_method

        yield_gap_kw = max(0.0, round(p_expected - p_observed, 3))
        yield_gap_pct = round((yield_gap_kw / p_expected) * 100.0, 1) if p_expected > 0.0 else 0.0

        # Data coverage metric calculation
        expected_fields = [latest_tel.p_ac, latest_tel.v_dc, latest_tel.i_dc, latest_tel.v_ac, latest_tel.poa_irradiance_wm2, latest_tel.temperature_c]
        valid_fields_count = sum(1 for f in expected_fields if f is not None)
        data_coverage_ratio = round(valid_fields_count / len(expected_fields), 2)

        # -------------------------------------------------------------
        # STEP 2: Check whether production is expected at solar position
        # -------------------------------------------------------------
        if solar_pos.solar_elevation_deg < MIN_DAYLIGHT_ELEVATION_DEG or not solar_pos.is_daylight:
            if p_observed <= 0.05:
                return WhyLowDiagnosticResponse(
                    plant_id=plant.id,
                    inverter_id=target_inverter.id if target_inverter else None,
                    timestamp=eval_time_utc,
                    observed_power_kw=p_observed,
                    expected_power_kw=0.0,
                    baseline_method="NIGHT_ZERO_SOLAR_BASELINE",
                    yield_gap_kw=0.0,
                    yield_gap_pct=0.0,
                    candidate_cause="NIGHT_TIME_OR_LOW_SUN",
                    candidate_cause_title="Normal Night-Time or Low Solar Elevation",
                    severity="NORMAL",
                    is_fault=False,
                    supporting_evidence=[
                        f"Solar elevation is {solar_pos.solar_elevation_deg:.1f}° (below daylight threshold of {MIN_DAYLIGHT_ELEVATION_DEG}°).",
                        f"Solar zenith angle: {solar_pos.solar_zenith_deg:.1f}°.",
                        f"Theoretical clear-sky irradiance is {solar_pos.clear_sky_irradiance_wm2:.1f} W/m².",
                        f"Observed AC power ({p_observed:.2f} kW) correctly matches zero expected generation.",
                    ],
                    contradictory_evidence=[],
                    confidence_score=0.99,
                    rule_score=1.0,
                    score_meaning="Solar position algorithm confirms the sun is below the operational horizon; zero generation is normal.",
                    data_coverage=data_coverage_ratio,
                    evaluation_step_reached=2,
                    recommended_next_check="Normal solar absence. Generation will resume automatically after sunrise when solar elevation exceeds 5°.",
                    solar_position=solar_pos,
                    raw_measurements={
                        "p_ac_kw": p_observed,
                        "v_dc_v": v_dc,
                        "solar_elevation_deg": solar_pos.solar_elevation_deg,
                    },
                )

        # -------------------------------------------------------------
        # STEP 3: Assess weather-related reduction
        # -------------------------------------------------------------
        # If POA irradiance is low or cloud cover is heavy and generation aligns with available light
        if poa_irr is not None and poa_irr < LOW_IRRADIANCE_THRESHOLD_WM2:
            # Expected power at this low irradiance
            irr_proportional_expected = capacity_kwp * (poa_irr / 1000.0) * 0.90
            if p_observed >= (irr_proportional_expected * 0.65):
                return WhyLowDiagnosticResponse(
                    plant_id=plant.id,
                    inverter_id=target_inverter.id if target_inverter else None,
                    timestamp=eval_time_utc,
                    observed_power_kw=p_observed,
                    expected_power_kw=p_expected,
                    baseline_method=baseline_method,
                    yield_gap_kw=yield_gap_kw,
                    yield_gap_pct=yield_gap_pct,
                    candidate_cause="WEATHER_RELATED_REDUCTION",
                    candidate_cause_title="Overcast Weather & Cloud Attenuation",
                    severity="LOW",
                    is_fault=False,
                    supporting_evidence=[
                        f"Measured plane-of-array irradiance is low: {poa_irr:.0f} W/m² (threshold: <{LOW_IRRADIANCE_THRESHOLD_WM2:.0f} W/m²).",
                        f"Cloud cover: {cloud_pct:.0f}%." if cloud_pct is not None else "Dense cloud cover recorded.",
                        f"Observed generation ({p_observed:.2f} kW) is proportional to available sunlight.",
                    ],
                    contradictory_evidence=[],
                    confidence_score=0.92,
                    rule_score=0.92,
                    score_meaning="High physical correlation: power reduction is directly attributable to measured cloud attenuation.",
                    data_coverage=data_coverage_ratio,
                    evaluation_step_reached=3,
                    recommended_next_check="Monitor generation when clear-sky conditions return; system is operating normally for current weather.",
                    solar_position=solar_pos,
                    raw_measurements={"poa_irradiance_wm2": poa_irr, "cloud_cover_pct": cloud_pct, "p_ac_kw": p_observed},
                )

        elif cloud_pct is not None and cloud_pct >= 70.0 and p_observed <= (capacity_kwp * 0.35):
            return WhyLowDiagnosticResponse(
                plant_id=plant.id,
                inverter_id=target_inverter.id if target_inverter else None,
                timestamp=eval_time_utc,
                observed_power_kw=p_observed,
                expected_power_kw=p_expected,
                baseline_method=baseline_method,
                yield_gap_kw=yield_gap_kw,
                yield_gap_pct=yield_gap_pct,
                candidate_cause="WEATHER_RELATED_REDUCTION",
                candidate_cause_title="Heavy Cloud Cover Weather Attenuation",
                severity="LOW",
                is_fault=False,
                supporting_evidence=[
                    f"Weather station reports {cloud_pct:.0f}% cloud cover.",
                    f"Observed generation ({p_observed:.2f} kW) is throttled by atmospheric cloud obstruction.",
                ],
                contradictory_evidence=[],
                confidence_score=0.88,
                rule_score=0.88,
                score_meaning="Meteorological weather records indicate heavy cloud cover explaining power reduction.",
                data_coverage=data_coverage_ratio,
                evaluation_step_reached=3,
                recommended_next_check="Check generation once sky clears; no physical equipment defect indicated.",
                solar_position=solar_pos,
                raw_measurements={"cloud_cover_pct": cloud_pct, "p_ac_kw": p_observed},
            )

        # -------------------------------------------------------------
        # STEP 4: Check grid availability and outage evidence
        # -------------------------------------------------------------
        # If AC voltage collapsed or active outage event while DC voltage is energized
        is_grid_collapsed = (v_ac is not None and v_ac < GRID_COLLAPSE_VOLTAGE_V) or (
            freq_hz is not None and freq_hz < 40.0
        )
        has_outage_event = len(active_outages) > 0

        if (is_grid_collapsed or has_outage_event) and (v_dc >= DC_VOLTAGE_PRESENT_V or p_observed == 0.0):
            outage_reason = active_outages[0].reason if active_outages else "AC grid voltage missing"
            return WhyLowDiagnosticResponse(
                plant_id=plant.id,
                inverter_id=target_inverter.id if target_inverter else None,
                timestamp=eval_time_utc,
                observed_power_kw=p_observed,
                expected_power_kw=p_expected,
                baseline_method=baseline_method,
                yield_gap_kw=yield_gap_kw,
                yield_gap_pct=yield_gap_pct,
                candidate_cause="GRID_OUTAGE_OR_DISCONNECTION",
                candidate_cause_title="Utility Grid Outage or AC Breaker Trip",
                severity="CRITICAL",
                is_fault=True,
                supporting_evidence=[
                    f"AC grid voltage collapsed to {v_ac:.1f} V (threshold: <{GRID_COLLAPSE_VOLTAGE_V:.0f} V)." if v_ac is not None else "Active grid outage recorded in plant log.",
                    f"DC array voltage is present ({v_dc:.1f} V), proving solar PV strings are illuminated and energized.",
                    f"Outage record: {outage_reason}.",
                ],
                contradictory_evidence=[],
                confidence_score=0.98,
                rule_score=0.98,
                score_meaning="AC electrical measurements confirm inverter cannot export power due to grid disconnection or tripped AC breaker.",
                data_coverage=data_coverage_ratio,
                evaluation_step_reached=4,
                recommended_next_check="Verify utility power supply, inspect main AC distribution breaker (MCB), and check AC isolator contactor.",
                solar_position=solar_pos,
                raw_measurements={"v_ac_v": v_ac, "v_dc_v": v_dc, "frequency_hz": freq_hz, "p_ac_kw": p_observed},
            )

        # -------------------------------------------------------------
        # STEP 5: Inspect documented inverter alerts
        # -------------------------------------------------------------
        critical_alerts = [a for a in active_alerts if a.severity in ("CRITICAL", "HIGH", "WARNING")]
        if critical_alerts:
            top_alert = critical_alerts[0]
            return WhyLowDiagnosticResponse(
                plant_id=plant.id,
                inverter_id=target_inverter.id if target_inverter else top_alert.inverter_id,
                timestamp=eval_time_utc,
                observed_power_kw=p_observed,
                expected_power_kw=p_expected,
                baseline_method=baseline_method,
                yield_gap_kw=yield_gap_kw,
                yield_gap_pct=yield_gap_pct,
                candidate_cause="INVERTER_HARDWARE_ALERT",
                candidate_cause_title=f"Inverter Protection Event ({top_alert.code})",
                severity=top_alert.severity,
                is_fault=True,
                supporting_evidence=[
                    f"Active hardware alert documented: [{top_alert.code}] '{top_alert.message}'.",
                    f"Alert source: {top_alert.source}, severity: {top_alert.severity}.",
                    f"Recorded at: {top_alert.event_timestamp.isoformat()}.",
                ],
                contradictory_evidence=[],
                confidence_score=0.96,
                rule_score=0.96,
                score_meaning="Direct hardware protection fault code documented by inverter supervisory controller.",
                data_coverage=data_coverage_ratio,
                evaluation_step_reached=5,
                recommended_next_check=top_alert.actionable_guidance or "Inspect inverter LCD error log, measure DC insulation resistance (Megger test), and verify surge arresters.",
                solar_position=solar_pos,
                raw_measurements={"alert_code": top_alert.code, "alert_id": top_alert.id, "p_ac_kw": p_observed},
            )

        # -------------------------------------------------------------
        # STEP 6: Evaluate temperature-related limits
        # -------------------------------------------------------------
        if inv_temp is not None and inv_temp >= HIGH_TEMP_THRESHOLD_C:
            if yield_gap_pct >= 15.0 and p_observed > 0.0:
                return WhyLowDiagnosticResponse(
                    plant_id=plant.id,
                    inverter_id=target_inverter.id if target_inverter else None,
                    timestamp=eval_time_utc,
                    observed_power_kw=p_observed,
                    expected_power_kw=p_expected,
                    baseline_method=baseline_method,
                    yield_gap_kw=yield_gap_kw,
                    yield_gap_pct=yield_gap_pct,
                    candidate_cause="THERMAL_DERATING_OR_CLIPPING",
                    candidate_cause_title="Inverter Thermal Over-Temperature Derating",
                    severity="HIGH",
                    is_fault=True,
                    supporting_evidence=[
                        f"Inverter internal heatsink temperature reached {inv_temp:.1f}°C (threshold: {HIGH_TEMP_THRESHOLD_C:.0f}°C).",
                        f"Power output throttled to {p_observed:.2f} kW vs expected {p_expected:.2f} kW ({yield_gap_pct:.1f}% reduction).",
                    ],
                    contradictory_evidence=[],
                    confidence_score=0.94,
                    rule_score=0.94,
                    score_meaning="Internal temperature exceeds manufacturer safe operating threshold, causing automated power throttling.",
                    data_coverage=data_coverage_ratio,
                    evaluation_step_reached=6,
                    recommended_next_check="Inspect external heatsink cooling fans, clean dust filters, ensure 30cm enclosure ventilation clearance, and check sunshade baffle.",
                    solar_position=solar_pos,
                    raw_measurements={"temperature_c": inv_temp, "p_ac_kw": p_observed, "expected_power_kw": p_expected},
                )

        # -------------------------------------------------------------
        # STEP 7: Compare MPPT channels / Strings when multiple exist
        # -------------------------------------------------------------
        # Check string-level discrepancies
        string_telemetries = [
            t for t in telemetry_samples[:10]
            if t.pv_asset_id is not None and t.timestamp == latest_tel.timestamp
        ]

        if len(string_telemetries) >= 2:
            currents = [float(t.i_dc or 0.0) for t in string_telemetries]
            max_i = max(currents)
            min_i = min(currents)
            if max_i > 2.0 and min_i < 0.3:
                # High current on one string, near-zero on another
                inactive_asset = [t for t in string_telemetries if float(t.i_dc or 0.0) < 0.3][0]
                return WhyLowDiagnosticResponse(
                    plant_id=plant.id,
                    inverter_id=target_inverter.id if target_inverter else None,
                    timestamp=eval_time_utc,
                    observed_power_kw=p_observed,
                    expected_power_kw=p_expected,
                    baseline_method=baseline_method,
                    yield_gap_kw=yield_gap_kw,
                    yield_gap_pct=yield_gap_pct,
                    candidate_cause="MPPT_OR_STRING_DISCONNECTION",
                    candidate_cause_title="DC String Open Circuit or Blown Fuse",
                    severity="HIGH",
                    is_fault=True,
                    supporting_evidence=[
                        f"Current mismatch across strings: Active={max_i:.2f} A vs Inactive={min_i:.2f} A.",
                        f"Affected PV asset: {inactive_asset.pv_asset_id}.",
                        f"Open-circuit voltage on inactive string: {inactive_asset.v_dc or 0.0:.1f} V.",
                    ],
                    contradictory_evidence=[],
                    confidence_score=0.95,
                    rule_score=0.95,
                    score_meaning="Severe current discrepancy between parallel strings with DC voltage present confirms string open circuit.",
                    data_coverage=data_coverage_ratio,
                    evaluation_step_reached=7,
                    recommended_next_check="Test DC string fuse continuity in combiner box, inspect MC4 connectors, and verify DC string isolator switch.",
                    solar_position=solar_pos,
                    raw_measurements={"max_current_a": max_i, "min_current_a": min_i, "affected_asset": inactive_asset.pv_asset_id},
                )

        # Single string / inverter level current vs voltage check
        if poa_irr is not None and poa_irr > 400.0 and v_dc > DC_VOLTAGE_PRESENT_V and i_dc < 0.2 and p_observed < (capacity_kwp * 0.1):
            return WhyLowDiagnosticResponse(
                plant_id=plant.id,
                inverter_id=target_inverter.id if target_inverter else None,
                timestamp=eval_time_utc,
                observed_power_kw=p_observed,
                expected_power_kw=p_expected,
                baseline_method=baseline_method,
                yield_gap_kw=yield_gap_kw,
                yield_gap_pct=yield_gap_pct,
                candidate_cause="MPPT_OR_STRING_DISCONNECTION",
                candidate_cause_title="DC String Open Circuit / Combiner Disconnection",
                severity="HIGH",
                is_fault=True,
                supporting_evidence=[
                    f"Zero DC current recorded ({i_dc:.2f} A) under strong irradiance ({poa_irr:.0f} W/m²).",
                    f"DC array open-circuit voltage is intact ({v_dc:.1f} V).",
                ],
                contradictory_evidence=[],
                confidence_score=0.95,
                rule_score=0.95,
                score_meaning="Open-circuit DC voltage present without current flow indicates an open circuit at combiner or inverter DC switch.",
                data_coverage=data_coverage_ratio,
                evaluation_step_reached=7,
                recommended_next_check="Check DC string fuses with multimeter, verify combiner box rotary switch, and test MC4 connectors.",
                solar_position=solar_pos,
                raw_measurements={"i_dc_a": i_dc, "v_dc_v": v_dc, "poa_irradiance_wm2": poa_irr},
            )

        # -------------------------------------------------------------
        # STEP 8: Evaluate shading or soiling evidence
        # -------------------------------------------------------------
        if poa_irr is not None and poa_irr >= HIGH_IRRADIANCE_THRESHOLD_WM2 and yield_gap_pct >= 20.0 and yield_gap_pct <= 55.0 and p_observed > 0.0:
            # Check voltage pattern: depressed voltage indicates partial shading / diode conduction
            if v_dc > 0.0 and v_dc < 220.0:  # Depressed voltage
                return WhyLowDiagnosticResponse(
                    plant_id=plant.id,
                    inverter_id=target_inverter.id if target_inverter else None,
                    timestamp=eval_time_utc,
                    observed_power_kw=p_observed,
                    expected_power_kw=p_expected,
                    baseline_method=baseline_method,
                    yield_gap_kw=yield_gap_kw,
                    yield_gap_pct=yield_gap_pct,
                    candidate_cause="PARTIAL_SHADING",
                    candidate_cause_title="Partial Array Shading / Bypass Diode Activation",
                    severity="MEDIUM",
                    is_fault=False,
                    supporting_evidence=[
                        f"Irradiance is high ({poa_irr:.0f} W/m²) but power is {yield_gap_pct:.1f}% below clear-sky expectation.",
                        f"DC operating voltage ({v_dc:.1f} V) is depressed, characteristic of bypass diode activation.",
                    ],
                    contradictory_evidence=[],
                    confidence_score=0.88,
                    rule_score=0.88,
                    score_meaning="Voltage degradation signature matches partial array shading causing bypass diode conduction.",
                    data_coverage=data_coverage_ratio,
                    evaluation_step_reached=8,
                    recommended_next_check="Inspect array for nearby tree branches, utility poles, chimney shadows, or building parapet obstructions.",
                    solar_position=solar_pos,
                    raw_measurements={"v_dc_v": v_dc, "poa_irradiance_wm2": poa_irr, "p_ac_kw": p_observed},
                )
            else:
                # Normal voltage with uniform current loss indicates surface dust / soiling
                return WhyLowDiagnosticResponse(
                    plant_id=plant.id,
                    inverter_id=target_inverter.id if target_inverter else None,
                    timestamp=eval_time_utc,
                    observed_power_kw=p_observed,
                    expected_power_kw=p_expected,
                    baseline_method=baseline_method,
                    yield_gap_kw=yield_gap_kw,
                    yield_gap_pct=yield_gap_pct,
                    candidate_cause="SURFACE_SOILING",
                    candidate_cause_title="Module Surface Dust & Soiling Attenuation",
                    severity="MEDIUM",
                    is_fault=False,
                    supporting_evidence=[
                        f"Power output ({p_observed:.2f} kW) is {yield_gap_pct:.1f}% below clear-sky model at {poa_irr:.0f} W/m² irradiance.",
                        f"DC operating voltage is stable ({v_dc:.1f} V), confirming current attenuation rather than diode shading.",
                    ],
                    contradictory_evidence=[],
                    confidence_score=0.86,
                    rule_score=0.86,
                    score_meaning="Uniform power deficit under high irradiance with stable DC voltage indicates particle soiling on module glass.",
                    data_coverage=data_coverage_ratio,
                    evaluation_step_reached=8,
                    recommended_next_check="Schedule solar module surface cleaning cycle with demineralized water and soft brush.",
                    solar_position=solar_pos,
                    raw_measurements={"v_dc_v": v_dc, "poa_irradiance_wm2": poa_irr, "p_ac_kw": p_observed},
                )

        # -------------------------------------------------------------
        # STEP 9: Compare historical operating patterns
        # -------------------------------------------------------------
        if baseline_method == "HISTORICAL_CALIBRATED_BENCHMARK" and yield_gap_pct >= 30.0 and p_observed > 0.0:
            return WhyLowDiagnosticResponse(
                plant_id=plant.id,
                inverter_id=target_inverter.id if target_inverter else None,
                timestamp=eval_time_utc,
                observed_power_kw=p_observed,
                expected_power_kw=p_expected,
                baseline_method=baseline_method,
                yield_gap_kw=yield_gap_kw,
                yield_gap_pct=yield_gap_pct,
                candidate_cause="HISTORICAL_PERFORMANCE_DIVERGENCE",
                candidate_cause_title="Unexplained Divergence from Calibrated Historical Benchmark",
                severity="MEDIUM",
                is_fault=True,
                supporting_evidence=[
                    f"Current generation ({p_observed:.2f} kW) is {yield_gap_pct:.1f}% below the plant's 90th percentile historical benchmark ({p_expected:.2f} kW).",
                    f"Evaluated at identical solar time with healthy historical reference samples.",
                ],
                contradictory_evidence=["No specific hardware protection alert or open circuit signature recorded."],
                confidence_score=0.82,
                rule_score=0.82,
                score_meaning="Statistically significant divergence from proven healthy historical operating envelope.",
                data_coverage=data_coverage_ratio,
                evaluation_step_reached=9,
                recommended_next_check="Perform module IV curve tracing, string open-circuit voltage tests, and infrared thermal imaging to isolate cell defects.",
                solar_position=solar_pos,
                raw_measurements={"p_ac_kw": p_observed, "historical_p90_kw": p_expected},
            )

        # Check if generation is normal (within 10% of expected)
        if yield_gap_pct < 15.0:
            return WhyLowDiagnosticResponse(
                plant_id=plant.id,
                inverter_id=target_inverter.id if target_inverter else None,
                timestamp=eval_time_utc,
                observed_power_kw=p_observed,
                expected_power_kw=p_expected,
                baseline_method=baseline_method,
                yield_gap_kw=yield_gap_kw,
                yield_gap_pct=yield_gap_pct,
                candidate_cause="NORMAL_OPERATION",
                candidate_cause_title="System Operating Normally at Full Capacity",
                severity="NORMAL",
                is_fault=False,
                supporting_evidence=[
                    f"Observed AC power ({p_observed:.2f} kW) is within optimal operational range of expected power ({p_expected:.2f} kW).",
                    f"Performance yield gap: {yield_gap_pct:.1f}%.",
                ],
                contradictory_evidence=[],
                confidence_score=0.98,
                rule_score=1.0,
                score_meaning="Observed power output matches or exceeds expected physical generation baseline.",
                data_coverage=data_coverage_ratio,
                evaluation_step_reached=10,
                recommended_next_check="No maintenance action required; plant is operating within optimal parameters.",
                solar_position=solar_pos,
                raw_measurements={"p_ac_kw": p_observed, "expected_power_kw": p_expected},
            )

        # -------------------------------------------------------------
        # STEP 10: Return unknown or insufficient evidence when no cause is adequately supported
        # -------------------------------------------------------------
        contradictory_reasons: List[str] = []
        if poa_irr is None:
            contradictory_reasons.append("Plane-of-array (POA) solar irradiance sensor is unavailable on site.")
        if inv_temp is None and amb_temp is None:
            contradictory_reasons.append("Cell/ambient temperature sensors are unavailable.")
        if not active_alerts:
            contradictory_reasons.append("No inverter error codes or protection trips were logged.")

        return WhyLowDiagnosticResponse(
            plant_id=plant.id,
            inverter_id=target_inverter.id if target_inverter else None,
            timestamp=eval_time_utc,
            observed_power_kw=p_observed,
            expected_power_kw=p_expected,
            baseline_method=baseline_method,
            yield_gap_kw=yield_gap_kw,
            yield_gap_pct=yield_gap_pct,
            candidate_cause="INSUFFICIENT_EVIDENCE_OR_UNKNOWN",
            candidate_cause_title="Insufficient Sensor Evidence for Definite Diagnosis",
            severity="LOW",
            is_fault=False,
            supporting_evidence=[
                f"Observed generation ({p_observed:.2f} kW) is lower than theoretical clear-sky baseline ({p_expected:.2f} kW) by {yield_gap_pct:.1f}%.",
                "Telemetry stream is valid but lacks environmental or high-resolution string sensors to isolate root cause.",
            ],
            contradictory_evidence=contradictory_reasons,
            confidence_score=0.45,
            rule_score=None,
            score_meaning="Low confidence due to missing pyranometer/temperature telemetry; refusing to guess physical cause without factual proof.",
            data_coverage=data_coverage_ratio,
            evaluation_step_reached=10,
            recommended_next_check="Install on-site POA pyranometer, collect module temperature data, or conduct manual visual inspection.",
            solar_position=solar_pos,
            raw_measurements={"p_ac_kw": p_observed, "expected_power_kw": p_expected, "data_coverage": data_coverage_ratio},
        )


why_low_service = WhyLowService()
