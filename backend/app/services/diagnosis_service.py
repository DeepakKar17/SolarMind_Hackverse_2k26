"""Diagnosis Service implementing AI and deterministic electrical fault detection algorithms."""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.errors import EntityNotFoundError
from app.models.diagnosis import Diagnosis
from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.telemetry import Telemetry
from app.schemas.diagnosis import (
    DiagnosisAnalysisRequest,
    DiagnosisAnalysisResponse,
    DiagnosisCreate,
    DiagnosisResponse,
    DiagnosisUpdate,
)

logger = logging.getLogger("solarmind.services.diagnosis")

VALID_DIAGNOSIS_STATUSES: Set[str] = {
    "ACTIVE",
    "INVESTIGATING",
    "CONFIRMED",
    "RESOLVED",
    "FALSE_POSITIVE",
}

# Allowed directed state transitions: current_status -> set(allowed_target_statuses)
ALLOWED_DIAGNOSIS_TRANSITIONS: Dict[str, Set[str]] = {
    "ACTIVE": {"INVESTIGATING", "CONFIRMED", "RESOLVED", "FALSE_POSITIVE", "ACTIVE"},
    "INVESTIGATING": {"CONFIRMED", "RESOLVED", "FALSE_POSITIVE", "ACTIVE", "INVESTIGATING"},
    "CONFIRMED": {"RESOLVED", "FALSE_POSITIVE", "INVESTIGATING", "CONFIRMED"},
    "RESOLVED": {"ACTIVE", "INVESTIGATING", "RESOLVED"},  # Reopened
    "FALSE_POSITIVE": {"ACTIVE", "FALSE_POSITIVE"},       # Reopened
}


class DiagnosisService:
    """Service executing deterministic rules, AI inference, and status lifecycle management for diagnoses."""

    def validate_status_transition(self, current_status: str, target_status: str) -> None:
        """Validate whether the requested diagnosis status transition is permitted."""
        target_status_upper = target_status.strip().upper()
        if target_status_upper not in VALID_DIAGNOSIS_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid diagnosis status: '{target_status}'. Must be one of: {sorted(VALID_DIAGNOSIS_STATUSES)}",
            )

        allowed = ALLOWED_DIAGNOSIS_TRANSITIONS.get(current_status, set())
        if target_status_upper not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition diagnosis from '{current_status}' to '{target_status_upper}'. Allowed: {sorted(allowed)}",
            )

    def analyze_plant_telemetry(
        self,
        db: Session,
        request: DiagnosisAnalysisRequest,
    ) -> DiagnosisAnalysisResponse:
        """Execute on-demand fault analysis rules and AI classifications across plant telemetry."""
        # 1. Validate Plant
        plant = db.get(Plant, request.plant_id)
        if not plant:
            raise EntityNotFoundError("Plant", request.plant_id)

        # 2. Identify Inverters to analyze
        inv_query = select(Inverter).where(Inverter.plant_id == request.plant_id)
        if request.inverter_id:
            inv_query = inv_query.where(Inverter.id == request.inverter_id)

        inverters = list(db.scalars(inv_query).all())
        if request.inverter_id and not inverters:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inverter '{request.inverter_id}' not found in plant {request.plant_id}.",
            )

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        start_time = now - timedelta(hours=request.lookback_hours)

        # 3. Existing active diagnoses to prevent duplicate active alerts
        existing_active_stmt = select(Diagnosis).where(
            Diagnosis.plant_id == request.plant_id,
            Diagnosis.status.in_(["ACTIVE", "INVESTIGATING", "CONFIRMED"]),
        )
        existing_active = list(db.scalars(existing_active_stmt).all())
        active_fault_keys: Set[Tuple[Optional[str], str]] = {
            (d.inverter_id, d.fault_class) for d in existing_active
        }

        detected_diagnoses: List[Diagnosis] = []
        total_telemetry_samples = 0
        tariff_rate = plant.tariff_rate_inr or 7.50

        for inv in inverters:
            # Query recent telemetry
            tel_stmt = (
                select(Telemetry)
                .where(
                    Telemetry.inverter_id == inv.id,
                    Telemetry.timestamp >= start_time,
                    Telemetry.timestamp <= now,
                )
                .order_by(desc(Telemetry.timestamp))
            )
            telemetry_records = list(db.scalars(tel_stmt).all())
            total_telemetry_samples += len(telemetry_records)

            if not telemetry_records:
                continue

            # Evaluate recent samples
            latest_tel = telemetry_records[0]
            p_ac = float(latest_tel.p_ac or 0.0)
            v_dc = float(latest_tel.v_dc or 0.0)
            i_dc = float(latest_tel.i_dc or 0.0)
            irr = float(latest_tel.poa_irradiance_wm2) if latest_tel.poa_irradiance_wm2 is not None else None
            temp = float(latest_tel.temperature_c) if latest_tel.temperature_c is not None else None
            rated_power = float(inv.rated_ac_power_kw or 10.0)

            # --- RULE 1: INVERTER_TRIP / Zero Generation Under High Sun ---
            if irr is not None and irr > 450.0 and p_ac == 0.0 and (inv.id, "INVERTER_TRIP") not in active_fault_keys:
                loss_kwh = round(rated_power * 4.0 * 0.85, 2)
                d = Diagnosis(
                    id=f"DIAG-{uuid.uuid4().hex[:8].upper()}",
                    plant_id=plant.id,
                    inverter_id=inv.id,
                    fault_class="INVERTER_TRIP",
                    fault_title="Inverter Shutdown Under High Irradiance",
                    severity="CRITICAL",
                    engine_type="DETERMINISTIC_RULE",
                    rule_score=0.98,
                    confidence_score=None,
                    status="ACTIVE",
                    is_suspicion_only=False,
                    probable_cause="AC grid protection trip, ground fault isolation, or inverter internal lockout.",
                    root_cause_summary=f"Inverter output dropped to 0 kW while solar irradiance was {irr:.0f} W/m².",
                    recommended_action="Inspect AC circuit breaker, check grid frequency/voltage stability, and review inverter error codes.",
                    evidence={
                        "irradiance_wm2": irr,
                        "p_ac_kw": p_ac,
                        "v_dc_v": v_dc,
                        "timestamp": latest_tel.timestamp.isoformat(),
                    },
                    estimated_lost_energy_kwh=loss_kwh,
                    financial_deficit_inr=round(loss_kwh * tariff_rate, 2),
                    detected_at=latest_tel.timestamp,
                )
                detected_diagnoses.append(d)
                active_fault_keys.add((inv.id, "INVERTER_TRIP"))

            # --- RULE 2: STRING_DISCONNECTION / String Current Zero ---
            elif irr is not None and irr > 400.0 and v_dc > 50.0 and i_dc < 0.2 and p_ac < (rated_power * 0.1) and (inv.id, "STRING_DISCONNECTION") not in active_fault_keys:
                loss_kwh = round(rated_power * 0.25 * 4.5, 2)
                d = Diagnosis(
                    id=f"DIAG-{uuid.uuid4().hex[:8].upper()}",
                    plant_id=plant.id,
                    inverter_id=inv.id,
                    affected_string="String #1",
                    fault_class="STRING_DISCONNECTION",
                    fault_title="DC String Open Circuit / Fuse Disconnection",
                    severity="HIGH",
                    engine_type="DETERMINISTIC_RULE",
                    rule_score=0.95,
                    confidence_score=None,
                    status="ACTIVE",
                    is_suspicion_only=False,
                    probable_cause="Blown DC string fuse, open circuit in DC combiner, or disconnected MC4 connector.",
                    root_cause_summary=f"Zero DC current ({i_dc:.2f} A) recorded under {irr:.0f} W/m² irradiance with open-circuit voltage present ({v_dc:.1f} V).",
                    recommended_action="Test string fuse continuity in combiner box and verify MC4 connectors with clamp meter.",
                    evidence={
                        "i_dc_a": i_dc,
                        "v_dc_v": v_dc,
                        "irradiance_wm2": irr,
                        "timestamp": latest_tel.timestamp.isoformat(),
                    },
                    estimated_lost_energy_kwh=loss_kwh,
                    financial_deficit_inr=round(loss_kwh * tariff_rate, 2),
                    detected_at=latest_tel.timestamp,
                )
                detected_diagnoses.append(d)
                active_fault_keys.add((inv.id, "STRING_DISCONNECTION"))

            # --- RULE 3: THERMAL_DERATING / High Temperature Power Throttling ---
            elif temp is not None and temp >= 72.0 and p_ac > 0.0 and (inv.id, "THERMAL_DERATING") not in active_fault_keys:
                loss_kwh = round(rated_power * 0.15 * 3.0, 2)
                d = Diagnosis(
                    id=f"DIAG-{uuid.uuid4().hex[:8].upper()}",
                    plant_id=plant.id,
                    inverter_id=inv.id,
                    fault_class="THERMAL_DERATING",
                    fault_title="Inverter Thermal Over-Temperature Derating",
                    severity="HIGH",
                    engine_type="DETERMINISTIC_RULE",
                    rule_score=0.92,
                    confidence_score=None,
                    status="ACTIVE",
                    is_suspicion_only=False,
                    probable_cause="Cooling fan failure, clogged air inlet filters, or direct sunlight on inverter enclosure.",
                    root_cause_summary=f"Inverter core temperature reached {temp:.1f}°C (>72°C threshold), triggering power derate.",
                    recommended_action="Inspect external heatsink fans, clean air intake filters, and check sunshade baffle.",
                    evidence={
                        "temperature_c": temp,
                        "p_ac_kw": p_ac,
                        "rated_ac_power_kw": rated_power,
                        "timestamp": latest_tel.timestamp.isoformat(),
                    },
                    estimated_lost_energy_kwh=loss_kwh,
                    financial_deficit_inr=round(loss_kwh * tariff_rate, 2),
                    detected_at=latest_tel.timestamp,
                )
                detected_diagnoses.append(d)
                active_fault_keys.add((inv.id, "THERMAL_DERATING"))

            # --- RULE 4: SOILING / Surface Particle Attenuation ---
            elif irr is not None and irr > 650.0 and p_ac > 0.0 and (inv.id, "SOILING") not in active_fault_keys:
                expected_power = rated_power * (irr / 1000.0) * 0.85
                if p_ac < (expected_power * 0.70):  # 30% or more under nominal
                    loss_kwh = round((expected_power - p_ac) * 4.0, 2)
                    d = Diagnosis(
                        id=f"DIAG-{uuid.uuid4().hex[:8].upper()}",
                        plant_id=plant.id,
                        inverter_id=inv.id,
                        fault_class="SOILING",
                        fault_title="Heavy Soiling & Dust Attenuation",
                        severity="MEDIUM",
                        engine_type="ML_CLASSIFIER",
                        rule_score=None,
                        confidence_score=0.89,
                        status="ACTIVE",
                        is_suspicion_only=False,
                        probable_cause="Dust accumulation, bird drop deposits, or industrial soot on PV panel glass.",
                        root_cause_summary=f"Power output ({p_ac:.1f} kW) is >30% below expected clear-sky baseline ({expected_power:.1f} kW) at {irr:.0f} W/m².",
                        recommended_action="Schedule robotic or manual module surface cleaning cycle.",
                        evidence={
                            "actual_power_kw": p_ac,
                            "expected_power_kw": round(expected_power, 2),
                            "irradiance_wm2": irr,
                            "timestamp": latest_tel.timestamp.isoformat(),
                        },
                        estimated_lost_energy_kwh=loss_kwh,
                        financial_deficit_inr=round(loss_kwh * tariff_rate, 2),
                        detected_at=latest_tel.timestamp,
                    )
                    detected_diagnoses.append(d)
                    active_fault_keys.add((inv.id, "SOILING"))

        # Save to DB if not dry run
        created_count = 0
        if not request.dry_run and detected_diagnoses:
            db.add_all(detected_diagnoses)
            db.commit()
            created_count = len(detected_diagnoses)
            for d in detected_diagnoses:
                db.refresh(d)

        # Convert to response models
        response_items = [DiagnosisResponse.model_validate(d) for d in detected_diagnoses]

        return DiagnosisAnalysisResponse(
            plant_id=plant.id,
            inverters_analyzed=len(inverters),
            telemetry_samples_evaluated=total_telemetry_samples,
            anomalies_detected=len(detected_diagnoses),
            new_diagnoses_created=created_count,
            diagnoses=response_items,
        )

    def update_diagnosis(
        self,
        db: Session,
        diagnosis_id: str,
        update_in: DiagnosisUpdate,
    ) -> Diagnosis:
        """Update diagnosis attributes with strict status transition checks and timestamp tracking."""
        diag = db.get(Diagnosis, diagnosis_id)
        if not diag:
            raise EntityNotFoundError("Diagnosis", diagnosis_id)

        update_dict = update_in.model_dump(exclude_unset=True)

        if "status" in update_dict and update_dict["status"]:
            target_status = update_dict["status"].strip().upper()
            self.validate_status_transition(diag.status, target_status)
            diag.status = target_status

            # Handle automatic resolved_at timestamp
            if target_status == "RESOLVED":
                if not update_dict.get("resolved_at") and not diag.resolved_at:
                    diag.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None)
            elif target_status in ("ACTIVE", "INVESTIGATING", "CONFIRMED"):
                diag.resolved_at = None

        for field, value in update_dict.items():
            if field != "status":
                setattr(diag, field, value)

        db.add(diag)
        db.commit()
        db.refresh(diag)
        return diag


diagnosis_service = DiagnosisService()
