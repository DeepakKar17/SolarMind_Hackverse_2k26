"""
SolarMind Alert Generation & Safety Notification Service.

Coordinates automated alert creation from diagnosis events, deduplication of active
alarms, safety-grounded maintenance recommendations, and work order transitions.
Strictly prohibits instructing users to open energized equipment or bypass protections.
"""

from datetime import datetime, timezone, timedelta
import logging
from typing import Any, Dict, List, Optional
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.diagnosis import Diagnosis
from app.models.work_order import WorkOrder
from app.repositories.alert import alert_repository
from app.repositories.work_order import work_order_repository
from app.schemas.alert import AlertCreate
from app.schemas.work_order import WorkOrderCreate

logger = logging.getLogger("solarmind.services.alert_generation")

ELECTRICAL_SAFETY_PRECAUTIONS = [
    "DANGER: High DC voltage (>600V) may remain present even when inverter is disconnected.",
    "Do not open energized inverter enclosures, junction boxes, or AC distribution panels.",
    "Always disconnect and lock out AC and DC disconnect switches before any physical inspection.",
    "Wait at least 5 minutes after disconnection for internal DC bus capacitors to discharge.",
    "Refer all internal hardware repairs and electrical testing to qualified licensed personnel.",
]


class AlertGenerationService:
    """Service generating alerts, safety-grounded guidance, and work orders from diagnoses."""

    def generate_alert_from_diagnosis(
        self,
        db: Session,
        diagnosis: Diagnosis,
        source: str = "RULE_ENGINE",
    ) -> Optional[Alert]:
        """
        Creates an active Alert from a diagnosed anomaly.
        Prevents duplicate active alerts for the same plant, asset, and fault class.
        """
        # 1. Deduplication check for active alerts on same asset and fault
        existing = db.scalars(
            select(Alert).where(
                Alert.plant_id == diagnosis.plant_id,
                Alert.code == diagnosis.fault_class,
                Alert.status == "ACTIVE",
                Alert.acknowledged == False,
            )
        ).first()

        if existing:
            logger.info("Duplicate alert prevented for plant #%s code %s", diagnosis.plant_id, diagnosis.fault_class)
            return existing

        # 2. Build Safety-Grounded Actionable Guidance
        guidance = self._generate_safe_guidance(diagnosis)

        # 3. Create Alert Record
        alert_id = f"ALT-{uuid4().hex[:8].upper()}"
        alert_in = AlertCreate(
            id=alert_id,
            plant_id=diagnosis.plant_id,
            inverter_id=diagnosis.inverter_id,
            pv_asset_id=diagnosis.pv_asset_id,
            string_id=diagnosis.affected_string,
            severity=diagnosis.severity,
            code=diagnosis.fault_class,
            source=source,
            message=f"{diagnosis.fault_title}: {diagnosis.root_cause_summary}",
            status="ACTIVE",
            event_timestamp=diagnosis.detected_at,
            related_diagnosis_id=diagnosis.id,
            estimated_daily_loss_kwh=diagnosis.estimated_lost_energy_kwh,
            actionable_guidance=guidance,
        )

        created = alert_repository.create(db, obj_in=alert_in)
        db.commit()
        db.refresh(created)
        logger.info("Generated alert %s for diagnosis %s (severity %s)", alert_id, diagnosis.id, diagnosis.severity)
        return created

    def create_work_order_from_diagnosis(
        self,
        db: Session,
        diagnosis: Diagnosis,
        created_by: str,
        technician_id: Optional[str] = None,
        priority: Optional[str] = None,
        due_days: int = 2,
    ) -> WorkOrder:
        """
        Generates a formal WorkOrder from a confirmed or active Diagnosis.
        Includes safety precautions and structured inspection steps.
        """
        wo_id = f"WO-{uuid4().hex[:8].upper()}"
        due_date = datetime.now(timezone.utc) + timedelta(days=due_days)

        # Build Structured Inspection Checklist & Safety Instructions
        checklist = self._build_inspection_steps(diagnosis)
        structured_checklist = [{"item": s, "checked": False, "notes": None} for s in checklist]
        safety_text = "\n".join(f"• {p}" for p in ELECTRICAL_SAFETY_PRECAUTIONS)
        full_instructions = f"SAFETY PRECAUTIONS:\n{safety_text}\n\nTECHNICAL INSTRUCTIONS:\n{diagnosis.probable_cause}"

        # Map Severity to Work Order Priority
        sev = diagnosis.severity.upper()
        if priority:
            wo_priority = priority
        elif "CRITICAL" in sev:
            wo_priority = "CRITICAL"
        elif "HIGH" in sev:
            wo_priority = "HIGH"
        elif "LOW" in sev:
            wo_priority = "LOW"
        else:
            wo_priority = "MEDIUM"

        now_utc = datetime.now(timezone.utc)
        sched_date = now_utc.date()
        due_d = (now_utc + timedelta(days=due_days)).date()

        wo_in = WorkOrderCreate(
            id=wo_id,
            plant_id=diagnosis.plant_id,
            inverter_id=diagnosis.inverter_id,
            pv_asset_id=diagnosis.pv_asset_id,
            diagnosis_id=diagnosis.id,
            title=f"Resolve: {diagnosis.fault_title}",
            priority=wo_priority,
            status="ASSIGNED" if technician_id else "OPEN",
            assigned_to=technician_id or "Unassigned Technician",
            scheduled_date=sched_date,
            due_date=due_d,
            instructions=full_instructions,
            checklist=structured_checklist,
            notes=f"Auto-generated work order by {created_by} for root cause: {diagnosis.root_cause_summary}",
        )

        wo = work_order_repository.create(db, obj_in=wo_in)
        db.commit()
        db.refresh(wo)
        logger.info("Created work order %s from diagnosis %s", wo_id, diagnosis.id)
        return wo

    def _generate_safe_guidance(self, diagnosis: Diagnosis) -> str:
        """Generates safety-first maintenance instructions without recommending hazardous DIY operations."""
        sev = diagnosis.severity.upper()
        base_action = diagnosis.recommended_action or "Inspect affected equipment according to manufacturer protocols."

        if "CRITICAL" in sev or "GROUND" in diagnosis.fault_class or "VOLTAGE" in diagnosis.fault_class:
            return (
                f"IMMEDIATE SAFETY NOTICE: {base_action}\n"
                f"Do not open energized panels. Disconnect AC/DC switches and wait 5 minutes before inspection. "
                f"Contact certified technicians."
            )
        return f"Recommended Action: {base_action} Follow standard safety and lock-out procedures."

    def _build_inspection_steps(self, diagnosis: Diagnosis) -> List[str]:
        """Builds structured field technician steps based on diagnosis category."""
        steps = [
            "Verify site safety: Ensure solar disconnect switches are opened and locked out.",
            "Inspect physical exterior for visible damage, scorch marks, or loose conduits.",
        ]

        fc = diagnosis.fault_class.upper()
        if "STRING" in fc or "OPEN_CIRCUIT" in fc or "DISCONNECTION" in fc:
            steps.extend([
                "Check DC string connectors (MC4) for disconnects or corrosion.",
                "Measure string open-circuit voltage (Voc) with True-RMS meter.",
                "Measure operating DC current with clamp meter.",
            ])
        elif "GROUND" in fc or "INSULATION" in fc or "ISO" in fc:
            steps.extend([
                "Perform 1000V DC insulation resistance (megger) test from DC+ to PE and DC- to PE.",
                "Inspect array junction boxes and conduit entries for water ingress.",
            ])
        elif "THERMAL" in fc or "OVERHEAT" in fc:
            steps.extend([
                "Check inverter external heatsink fins and fan vents for dust blockage.",
                "Verify inverter cooling fans spin freely without mechanical obstruction.",
                "Measure ambient temperature and clearance distance around chassis.",
            ])
        elif "GRID" in fc or "OUTAGE" in fc:
            steps.extend([
                "Measure AC line-to-line voltages (L1-L2, L2-L3, L3-L1) at distribution board.",
                "Verify AC circuit breaker and utility supply status.",
            ])
        else:
            steps.append("Perform full electrical and visual inspection as per OEM manual.")

        steps.append("Record all measured values, take before/after photos, and submit verification report.")
        return steps


# Global singleton instance
alert_generation_service = AlertGenerationService()
