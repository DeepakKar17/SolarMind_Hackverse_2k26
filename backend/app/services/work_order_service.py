"""SolarMind WorkOrder Service.

Manages maintenance ticket lifecycles, technician field inspections, checklist execution,
audit trails, and post-repair electrical generation recovery verification.
"""

from datetime import date, datetime, timedelta, timezone
import json
import logging
from typing import Any, Dict, List, Optional, Set
import uuid
from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.errors import EntityNotFoundError
from app.models.diagnosis import Diagnosis
from app.models.inverter import Inverter
from app.models.plant import Plant
from app.models.pv_asset import PVAsset
from app.models.telemetry import Telemetry
from app.models.user import User
from app.models.work_order import WorkOrder
from app.models.work_order_status_history import WorkOrderStatusHistory
from app.services.audit_service import log_audit_event
from app.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderInspectionSubmit,
    WorkOrderStatusHistoryResponse,
    WorkOrderUpdate,
    WorkOrderVerificationRequest,
    WorkOrderVerificationResponse,
)
from app.services.expected_generation_service import expected_generation_service

logger = logging.getLogger("solarmind.services.work_order")

VALID_WORK_ORDER_STATUSES: Set[str] = {
    "OPEN",
    "PENDING",  # Alias for OPEN
    "ASSIGNED",
    "IN_PROGRESS",
    "COMPLETED_PENDING_VERIFICATION",
    "COMPLETED",  # Alias for COMPLETED_PENDING_VERIFICATION
    "VERIFIED",
    "CLOSED",
    "CANCELLED",
}

# Directed state transition matrix
ALLOWED_WORK_ORDER_TRANSITIONS: Dict[str, Set[str]] = {
    "OPEN": {"ASSIGNED", "IN_PROGRESS", "CANCELLED", "OPEN"},
    "PENDING": {"ASSIGNED", "IN_PROGRESS", "CANCELLED", "PENDING", "OPEN"},
    "ASSIGNED": {"IN_PROGRESS", "OPEN", "PENDING", "CANCELLED", "ASSIGNED"},
    "IN_PROGRESS": {"COMPLETED_PENDING_VERIFICATION", "COMPLETED", "ASSIGNED", "CANCELLED", "IN_PROGRESS"},
    "COMPLETED_PENDING_VERIFICATION": {"VERIFIED", "IN_PROGRESS", "CLOSED", "COMPLETED_PENDING_VERIFICATION"},
    "COMPLETED": {"VERIFIED", "IN_PROGRESS", "CLOSED", "COMPLETED", "COMPLETED_PENDING_VERIFICATION"},
    "VERIFIED": {"CLOSED", "IN_PROGRESS", "VERIFIED"},
    "CLOSED": {"IN_PROGRESS", "CLOSED"},
    "CANCELLED": {"OPEN", "PENDING", "CANCELLED"},
}

DEFAULT_INSPECTION_CHECKLIST = [
    {"item": "Visual inspection of PV module surfaces for cracks, burns, or heavy soiling", "checked": False, "notes": None},
    {"item": "Inspect MC4 connectors, DC cabling, and conduit integrity", "checked": False, "notes": None},
    {"item": "Measure and record DC string Open-Circuit Voltage (Voc) and Operating Current (Isc)", "checked": False, "notes": None},
    {"item": "Inspect AC isolator switch, distribution breaker (MCB), and surge protection", "checked": False, "notes": None},
    {"item": "Check inverter heatsink ventilation, fan operation, and error code log", "checked": False, "notes": None},
    {"item": "Perform post-repair electrical functional test and verify grid synchronization", "checked": False, "notes": None},
]


class WorkOrderService:
    """Service handling maintenance ticket lifecycle, technician actions, and recovery verification."""

    def normalize_status(self, raw_status: str) -> str:
        """Map legacy status aliases to standard canonical status names."""
        s = raw_status.strip().upper()
        if s == "PENDING":
            return "OPEN"
        if s == "COMPLETED":
            return "COMPLETED_PENDING_VERIFICATION"
        return s

    def validate_status_transition(self, current_status: str, target_status: str) -> str:
        """Validate allowed status transition according to work order state machine."""
        target_upper = target_status.strip().upper()
        current_upper = current_status.strip().upper()

        if target_upper not in VALID_WORK_ORDER_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid work order status: '{target_status}'. Allowed: {sorted(VALID_WORK_ORDER_STATUSES)}",
            )

        allowed = ALLOWED_WORK_ORDER_TRANSITIONS.get(current_upper, set())
        if target_upper not in allowed and self.normalize_status(target_upper) not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition work order from '{current_status}' to '{target_status}'. Allowed transitions: {sorted(allowed)}",
            )

        return target_upper

    def create_work_order(
        self,
        db: Session,
        obj_in: WorkOrderCreate,
        current_user: Optional[User] = None,
    ) -> WorkOrder:
        """Create a new work order ticket with strict relational and date validation."""
        # 1. Validate Plant
        plant = db.get(Plant, obj_in.plant_id)
        if not plant:
            raise EntityNotFoundError("Plant", obj_in.plant_id)

        # 2. Validate Inverter (if provided)
        if obj_in.inverter_id:
            inverter = db.get(Inverter, obj_in.inverter_id)
            if not inverter:
                raise EntityNotFoundError("Inverter", obj_in.inverter_id)
            if inverter.plant_id != obj_in.plant_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Inverter '{obj_in.inverter_id}' belongs to plant {inverter.plant_id}, not plant {obj_in.plant_id}.",
                )

        # 3. Validate PV Asset (if provided)
        if obj_in.pv_asset_id:
            pv_asset = db.get(PVAsset, obj_in.pv_asset_id)
            if not pv_asset:
                raise EntityNotFoundError("PVAsset", obj_in.pv_asset_id)

        # 4. Validate Diagnosis (if provided)
        diagnosis: Optional[Diagnosis] = None
        if obj_in.diagnosis_id:
            diagnosis = db.get(Diagnosis, obj_in.diagnosis_id)
            if not diagnosis:
                raise EntityNotFoundError("Diagnosis", obj_in.diagnosis_id)
            if diagnosis.plant_id != obj_in.plant_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Diagnosis '{obj_in.diagnosis_id}' belongs to plant {diagnosis.plant_id}, not plant {obj_in.plant_id}.",
                )

        # 5. Validate Dates
        if obj_in.due_date and obj_in.due_date < obj_in.scheduled_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"due_date ({obj_in.due_date}) cannot be earlier than scheduled_date ({obj_in.scheduled_date}).",
            )

        # 6. Check for ID collision
        existing = db.get(WorkOrder, obj_in.id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"WorkOrder with identifier '{obj_in.id}' already exists.",
            )

        status_val = obj_in.status.strip().upper() if obj_in.status else "OPEN"
        if status_val not in VALID_WORK_ORDER_STATUSES:
            status_val = "OPEN"

        # Apply default checklist template if omitted
        checklist_items = obj_in.checklist if obj_in.checklist else DEFAULT_INSPECTION_CHECKLIST

        try:
            work_order = WorkOrder(
                id=obj_in.id,
                plant_id=obj_in.plant_id,
                inverter_id=obj_in.inverter_id,
                pv_asset_id=obj_in.pv_asset_id,
                diagnosis_id=obj_in.diagnosis_id,
                title=obj_in.title,
                priority=obj_in.priority.strip().upper(),
                assigned_to=obj_in.assigned_to,
                service_provider=obj_in.service_provider,
                instructions=obj_in.instructions,
                scheduled_date=obj_in.scheduled_date,
                due_date=obj_in.due_date,
                cost_inr=obj_in.cost_inr,
                status=status_val,
                checklist=checklist_items,
                fault_observations=obj_in.fault_observations,
                repair_action=obj_in.repair_action,
                parts_replaced=obj_in.parts_replaced,
                before_photo_id=obj_in.before_photo_id,
                after_photo_id=obj_in.after_photo_id,
                requires_follow_up=obj_in.requires_follow_up,
                follow_up_notes=obj_in.follow_up_notes,
                verification_status="PENDING",
                notes=obj_in.notes,
            )
            db.add(work_order)

            # Record initial status history
            history = WorkOrderStatusHistory(
                work_order_id=work_order.id,
                from_status=None,
                to_status=status_val,
                changed_by_id=current_user.id if current_user else None,
                changed_by_email=current_user.email if current_user else "system@solarmind.ai",
                notes=f"Work order created with initial status '{status_val}'.",
            )
            db.add(history)

            # If created from an active diagnosis, move diagnosis to INVESTIGATING
            if diagnosis and diagnosis.status == "ACTIVE":
                diagnosis.status = "INVESTIGATING"
                db.add(diagnosis)

            # Record audit event
            log_audit_event(
                db=db,
                actor=current_user,
                action="CREATE_WORK_ORDER",
                target_type="WorkOrder",
                target_id=work_order.id,
                details=json.dumps({"title": work_order.title, "assigned_to": work_order.assigned_to, "plant_id": work_order.plant_id}),
            )

            db.commit()
            db.refresh(work_order)
            return work_order
        except Exception as err:
            db.rollback()
            logger.error("Failed to persist WorkOrder '%s': %s", obj_in.id, err)
            raise

    def update_work_order(
        self,
        db: Session,
        work_order_id: str,
        update_in: WorkOrderUpdate,
        current_user: Optional[User] = None,
    ) -> WorkOrder:
        """Update work order attributes and status with strict state machine validation."""
        work_order = db.get(WorkOrder, work_order_id)
        if not work_order:
            raise EntityNotFoundError("WorkOrder", work_order_id)

        update_dict = update_in.model_dump(exclude_unset=True)

        # Status transition handling
        if "status" in update_dict and update_dict["status"]:
            target_status = self.validate_status_transition(work_order.status, update_dict["status"])
            prev_status = work_order.status
            work_order.status = target_status

            # Handle completion timestamp & diagnosis resolution
            if target_status in ("COMPLETED", "COMPLETED_PENDING_VERIFICATION", "VERIFIED"):
                if not update_dict.get("completed_date") and not work_order.completed_date:
                    work_order.completed_date = date.today()

            if target_status in ("COMPLETED", "VERIFIED", "CLOSED") and work_order.diagnosis_id:
                diag = db.get(Diagnosis, work_order.diagnosis_id)
                if diag and diag.status != "RESOLVED":
                    diag.status = "RESOLVED"
                    diag.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None)
                    db.add(diag)

            # Record status history
            history = WorkOrderStatusHistory(
                work_order_id=work_order.id,
                from_status=prev_status,
                to_status=target_status,
                changed_by_id=current_user.id if current_user else None,
                changed_by_email=current_user.email if current_user else "system@solarmind.ai",
                notes=update_dict.get("notes") or f"Status changed from '{prev_status}' to '{target_status}'.",
            )
            db.add(history)

            # Record audit event
            log_audit_event(
                db=db,
                actor=current_user,
                action="UPDATE_WORK_ORDER_STATUS",
                target_type="WorkOrder",
                target_id=work_order.id,
                details=json.dumps({"from_status": prev_status, "to_status": target_status}),
            )

        # Date validation
        sched_date = update_dict.get("scheduled_date", work_order.scheduled_date)
        due_date = update_dict.get("due_date", work_order.due_date)
        if sched_date and due_date and due_date < sched_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"due_date ({due_date}) cannot be earlier than scheduled_date ({sched_date}).",
            )

        for field, value in update_dict.items():
            if field != "status":
                setattr(work_order, field, value)

        try:
            db.add(work_order)
            db.commit()
            db.refresh(work_order)
            return work_order
        except Exception as err:
            db.rollback()
            logger.error("Failed to update WorkOrder '%s': %s", work_order_id, err)
            raise

    def submit_technician_inspection(
        self,
        db: Session,
        work_order_id: str,
        submit_in: WorkOrderInspectionSubmit,
        current_user: Optional[User] = None,
    ) -> WorkOrder:
        """Submit technician on-site inspection findings, checklist, and repair actions."""
        work_order = db.get(WorkOrder, work_order_id)
        if not work_order:
            raise EntityNotFoundError("WorkOrder", work_order_id)

        # Update checklist & repair findings
        if submit_in.checklist is not None:
            work_order.checklist = submit_in.checklist
        if submit_in.fault_observations:
            work_order.fault_observations = submit_in.fault_observations
        if submit_in.repair_action:
            work_order.repair_action = submit_in.repair_action
        if submit_in.parts_replaced is not None:
            work_order.parts_replaced = submit_in.parts_replaced
        if submit_in.before_photo_id:
            work_order.before_photo_id = submit_in.before_photo_id
        if submit_in.after_photo_id:
            work_order.after_photo_id = submit_in.after_photo_id
        if submit_in.duration_hours is not None:
            work_order.duration_hours = submit_in.duration_hours
        if submit_in.cost_inr is not None:
            work_order.cost_inr = submit_in.cost_inr
        work_order.requires_follow_up = submit_in.requires_follow_up
        if submit_in.follow_up_notes:
            work_order.follow_up_notes = submit_in.follow_up_notes
        if submit_in.resolution_notes:
            work_order.resolution_notes = submit_in.resolution_notes

        prev_status = work_order.status
        if submit_in.mark_completed:
            target_status = "COMPLETED_PENDING_VERIFICATION"
            self.validate_status_transition(work_order.status, target_status)
            work_order.status = target_status
            work_order.completed_date = date.today()

            # Record status history
            history = WorkOrderStatusHistory(
                work_order_id=work_order.id,
                from_status=prev_status,
                to_status=target_status,
                changed_by_id=current_user.id if current_user else None,
                changed_by_email=current_user.email if current_user else "technician@solarmind.ai",
                notes="Technician completed field repair; submitted for post-repair recovery verification.",
            )
            db.add(history)

        # Record audit event
        log_audit_event(
            db=db,
            actor=current_user,
            action="SUBMIT_INSPECTION",
            target_type="WorkOrder",
            target_id=work_order.id,
            details=json.dumps({"mark_completed": submit_in.mark_completed, "parts_replaced": submit_in.parts_replaced}),
        )

        db.add(work_order)
        db.commit()
        db.refresh(work_order)
        return work_order

    def verify_recovery(
        self,
        db: Session,
        work_order_id: str,
        request: WorkOrderVerificationRequest,
        current_user: Optional[User] = None,
    ) -> WorkOrderVerificationResponse:
        """Evaluate electrical generation recovery after repair against expected physical baseline."""
        work_order = db.get(WorkOrder, work_order_id)
        if not work_order:
            raise EntityNotFoundError("WorkOrder", work_order_id)

        plant = db.get(Plant, work_order.plant_id)
        if not plant:
            raise EntityNotFoundError("Plant", work_order.plant_id)

        inverter: Optional[Inverter] = None
        if work_order.inverter_id:
            inverter = db.get(Inverter, work_order.inverter_id)

        capacity_kwp = inverter.rated_ac_power_kw if inverter else plant.installed_capacity_kwp
        lat = plant.latitude or 20.2961
        lon = plant.longitude or 85.8245

        # Verification window boundaries
        if request.reference_time:
            ref = request.reference_time.replace(tzinfo=None) if request.reference_time.tzinfo else request.reference_time
        else:
            ref = datetime.now(timezone.utc).replace(tzinfo=None)
        window_hours = request.verification_window_hours
        post_repair_start = ref - timedelta(hours=window_hours)
        pre_repair_start = post_repair_start - timedelta(hours=window_hours)

        # Query Post-Repair Telemetry
        tel_query = select(Telemetry).where(
            Telemetry.timestamp >= post_repair_start,
            Telemetry.timestamp <= ref,
        )
        if work_order.inverter_id:
            tel_query = tel_query.where(Telemetry.inverter_id == work_order.inverter_id)
        elif plant.inverters:
            tel_query = tel_query.where(Telemetry.inverter_id.in_([inv.id for inv in plant.inverters]))

        post_samples = list(db.scalars(tel_query.order_by(Telemetry.timestamp.asc())).all())

        # Filter for daylight telemetry samples (solar elevation >= 10°)
        daylight_post_samples: List[Telemetry] = []
        expected_powers: List[float] = []

        for tel in post_samples:
            solar_pos = expected_generation_service.calculate_solar_position(
                timestamp=tel.timestamp,
                latitude=lat,
                longitude=lon,
            )
            if solar_pos.solar_elevation_deg >= 10.0 and tel.data_quality_flag == "VALID":
                daylight_post_samples.append(tel)
                exp_calc = expected_generation_service.estimate_expected_power(
                    installed_capacity_kwp=capacity_kwp,
                    timestamp=tel.timestamp,
                    latitude=lat,
                    longitude=lon,
                    poa_irradiance_wm2=tel.poa_irradiance_wm2,
                    temperature_c=tel.temperature_c,
                    ambient_temp_c=tel.ambient_temp_c,
                )
                expected_powers.append(exp_calc.expected_power_kw)

        # 1. Check for Insufficient Data (e.g. at night, during heavy storm with no samples, or <3 samples)
        if len(daylight_post_samples) < 3 or not expected_powers or sum(expected_powers) <= 0.1:
            verification_status = "INSUFFICIENT_DATA"
            work_order.verification_status = verification_status
            work_order.verification_details = {
                "daylight_samples_count": len(daylight_post_samples),
                "total_samples_evaluated": len(post_samples),
                "window_hours": window_hours,
                "reason": "Insufficient daylight telemetry samples in post-repair verification window.",
            }
            db.add(work_order)
            db.commit()

            return WorkOrderVerificationResponse(
                work_order_id=work_order.id,
                plant_id=plant.id,
                inverter_id=work_order.inverter_id,
                verification_status=verification_status,
                is_verified=False,
                actual_post_repair_power_kw=None,
                expected_baseline_power_kw=None,
                pre_repair_power_kw=None,
                recovery_ratio_pct=None,
                weather_context={"daylight_samples": len(daylight_post_samples)},
                summary="Insufficient daylight telemetry available in post-repair verification window to evaluate electrical recovery.",
                recommendation="Allow at least 2 daylight hours with solar elevation >10° before executing post-repair recovery verification.",
                verified_at=datetime.now(timezone.utc),
            )

        # Query Pre-Repair Telemetry for baseline comparison
        pre_tel_query = select(Telemetry).where(
            Telemetry.timestamp >= pre_repair_start,
            Telemetry.timestamp < post_repair_start,
        )
        if work_order.inverter_id:
            pre_tel_query = pre_tel_query.where(Telemetry.inverter_id == work_order.inverter_id)
        elif plant.inverters:
            pre_tel_query = pre_tel_query.where(Telemetry.inverter_id.in_([inv.id for inv in plant.inverters]))

        pre_samples = list(db.scalars(pre_tel_query).all())
        pre_act_powers = [float(t.p_ac or 0.0) for t in pre_samples if t.data_quality_flag == "VALID"]
        avg_pre_power = (sum(pre_act_powers) / len(pre_act_powers)) if pre_act_powers else 0.0

        # Post-repair statistics
        post_act_powers = [float(t.p_ac or 0.0) for t in daylight_post_samples]
        avg_post_actual = sum(post_act_powers) / len(post_act_powers)
        avg_post_expected = sum(expected_powers) / len(expected_powers)

        recovery_ratio = avg_post_actual / avg_post_expected if avg_post_expected > 0.0 else 0.0
        recovery_pct = round(min(100.0, max(0.0, recovery_ratio * 100.0)), 1)

        # 2. Evaluate Recovery Performance
        is_verified = False
        prev_status = work_order.status

        if recovery_ratio >= 0.85:
            verification_status = "VERIFIED_FULL_RECOVERY"
            is_verified = True
            work_order.status = "VERIFIED"
            if request.auto_close_on_success:
                work_order.status = "CLOSED"

            # If diagnosis was linked, resolve it
            if work_order.diagnosis_id:
                diag = db.get(Diagnosis, work_order.diagnosis_id)
                if diag and diag.status != "RESOLVED":
                    diag.status = "RESOLVED"
                    diag.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None)
                    db.add(diag)

            summary = f"Full electrical recovery confirmed: generation ({avg_post_actual:.2f} kW) matches {recovery_pct:.1f}% of physical clear-sky/weather expectation ({avg_post_expected:.2f} kW)."
            recommendation = "Repair successfully verified. Work order marked as VERIFIED."

        elif recovery_ratio >= 0.55 and avg_post_actual > (avg_pre_power * 1.25):
            verification_status = "PARTIAL_RECOVERY"
            is_verified = False
            summary = f"Partial recovery observed: post-repair generation ({avg_post_actual:.2f} kW) improved over pre-repair ({avg_pre_power:.2f} kW) but reaches only {recovery_pct:.1f}% of expected baseline ({avg_post_expected:.2f} kW)."
            recommendation = "Monitor system over subsequent solar noon cycle; if deficit persists, schedule follow-up string inspection."

        else:
            verification_status = "INCONCLUSIVE"
            is_verified = False
            summary = f"Inconclusive recovery: generation ({avg_post_actual:.2f} kW) remains severely depressed below expected baseline ({avg_post_expected:.2f} kW) with recovery ratio {recovery_pct:.1f}%."
            recommendation = "Reject completion: re-open work order to IN_PROGRESS and dispatch technician for reinspection."

        work_order.verification_status = verification_status
        work_order.verification_details = {
            "actual_post_repair_power_kw": round(avg_post_actual, 2),
            "expected_baseline_power_kw": round(avg_post_expected, 2),
            "pre_repair_power_kw": round(avg_pre_power, 2),
            "recovery_ratio_pct": recovery_pct,
            "daylight_samples_count": len(daylight_post_samples),
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }

        # Record status history
        history = WorkOrderStatusHistory(
            work_order_id=work_order.id,
            from_status=prev_status,
            to_status=work_order.status,
            changed_by_id=current_user.id if current_user else None,
            changed_by_email=current_user.email if current_user else "verifier@solarmind.ai",
            notes=f"Recovery verification executed: {verification_status} ({recovery_pct:.1f}% recovery).",
        )
        db.add(history)

        # Record audit event
        log_audit_event(
            db=db,
            actor=current_user,
            action="VERIFY_WORK_ORDER",
            target_type="WorkOrder",
            target_id=work_order.id,
            details=json.dumps({"verification_status": verification_status, "recovery_ratio_pct": recovery_pct}),
        )

        db.add(work_order)
        db.commit()
        db.refresh(work_order)

        return WorkOrderVerificationResponse(
            work_order_id=work_order.id,
            plant_id=plant.id,
            inverter_id=work_order.inverter_id,
            verification_status=verification_status,
            is_verified=is_verified,
            actual_post_repair_power_kw=round(avg_post_actual, 2),
            expected_baseline_power_kw=round(avg_post_expected, 2),
            pre_repair_power_kw=round(avg_pre_power, 2),
            recovery_ratio_pct=recovery_pct,
            weather_context={"daylight_samples_count": len(daylight_post_samples)},
            summary=summary,
            recommendation=recommendation,
            verified_at=datetime.now(timezone.utc),
        )

    def get_status_history(self, db: Session, work_order_id: str) -> List[WorkOrderStatusHistory]:
        """Retrieve the immutable audit history of status transitions for a work order."""
        wo = db.get(WorkOrder, work_order_id)
        if not wo:
            raise EntityNotFoundError("WorkOrder", work_order_id)

        stmt = (
            select(WorkOrderStatusHistory)
            .where(WorkOrderStatusHistory.work_order_id == work_order_id)
            .order_by(WorkOrderStatusHistory.timestamp.asc())
        )
        return list(db.scalars(stmt).all())


work_order_service = WorkOrderService()
