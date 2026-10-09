"""
SolarMind Inverter Hardware & Alarm Code Detection Rule.

Evaluates inverter error codes and hardware alarms against verified manufacturer catalogs.
Explicitly flags unrecognized OEM codes as unresolved without guessing.
"""

from typing import List, Optional

from app.fault_engine.base_rule import BaseDetectionRule
from app.fault_engine.manufacturer_catalog import lookup_fault_code
from app.services.fault_knowledge_service import fault_knowledge_service
from app.fault_engine.schemas import (
    DetectionCategory,
    DiagnosisResult,
    DiagnosticEvidence,
    InspectionRecommendation,
    SeverityLevel,
    TelemetrySnapshot,
)


class InverterFaultRule(BaseDetectionRule):
    """Rule 3: Evaluates inverter alarms and manufacturer-specific diagnostic codes."""

    @property
    def rule_id(self) -> str:
        return "RULE_INV_FAULT_001"

    @property
    def name(self) -> str:
        return "Inverter Manufacturer Fault Code & Hardware Alarm Rule"

    @property
    def category(self) -> DetectionCategory:
        return DetectionCategory.INVERTER_FAULT

    @property
    def priority(self) -> int:
        return 30  # Priority 30: Direct hardware alarms from inverter microcontroller

    def evaluate(self, snapshot: TelemetrySnapshot) -> Optional[DiagnosisResult]:
        if not snapshot.reported_fault_codes and not snapshot.inverter_status:
            return None

        inputs_used: List[str] = ["reported_fault_codes", "inverter_status"]
        missing_inputs: List[str] = []
        evidence_list: List[DiagnosticEvidence] = []

        if snapshot.inverter_manufacturer:
            inputs_used.append("inverter_manufacturer")
        else:
            missing_inputs.append("inverter_manufacturer")

        # 1. Process Reported Fault Codes
        recognized_faults = []
        unresolved_codes = []

        for code in snapshot.reported_fault_codes:
            lookup_res = fault_knowledge_service.lookup(snapshot.inverter_manufacturer, code, model=snapshot.inverter_model)
            if lookup_res.is_known and lookup_res.documented_fact:
                fact = lookup_res.documented_fact
                interp = lookup_res.solarmind_interpretation
                recognized_faults.append((fact, interp))
                evidence_list.append(
                    DiagnosticEvidence(
                        metric_name=f"fault_code_{code}",
                        observed_value=f"{snapshot.inverter_manufacturer or 'Unknown'} Code: {code}",
                        expected_range_or_baseline="No active fault codes (0 / Normal)",
                        unit=None,
                        explanation=f"Manufacturer documented fault: {fact.documented_name}. {fact.documented_description}",
                        supporting_factors={
                            "source_document": lookup_res.source_metadata.source_document if lookup_res.source_metadata else "OEM Manual",
                            "page_reference": lookup_res.source_metadata.page_reference if lookup_res.source_metadata else "N/A",
                            "hazard_warning": fact.manufacturer_hazard_warning,
                        },
                    )
                )
            else:
                unresolved_codes.append(code)
                evidence_list.append(
                    DiagnosticEvidence(
                        metric_name=f"unresolved_fault_code_{code}",
                        observed_value=f"Code: {code} (OEM: {snapshot.inverter_manufacturer or 'Unspecified'})",
                        expected_range_or_baseline="Documented OEM Fault Code",
                        unit=None,
                        explanation=f"Inverter reported code '{code}' which is not in the verified {snapshot.inverter_manufacturer or 'OEM'} catalog. Code is marked unresolved.",
                    )
                )

        # 2. Check Inverter Status if codes were empty but status is error
        if not evidence_list and snapshot.inverter_status:
            st_lower = snapshot.inverter_status.lower()
            if any(k in st_lower for k in ["fault", "error", "alarm", "tripped", "hardware_failure"]):
                evidence_list.append(
                    DiagnosticEvidence(
                        metric_name="inverter_status",
                        observed_value=snapshot.inverter_status,
                        expected_range_or_baseline="NORMAL / RUNNING",
                        unit=None,
                        explanation=f"Inverter reported internal error state: '{snapshot.inverter_status}'.",
                    )
                )

        if not evidence_list:
            return None

        # Build Diagnosis according to whether codes were OEM-recognized or unresolved
        if recognized_faults:
            top_fact, top_interp = recognized_faults[0]
            cat_str = top_interp.category if top_interp else "INVERTER_FAULT"
            category = DetectionCategory(cat_str) if cat_str in DetectionCategory.__members__ else DetectionCategory.INVERTER_FAULT
            sev_str = top_interp.inferred_severity if top_interp else "HIGH"
            severity = SeverityLevel(sev_str) if sev_str in SeverityLevel.__members__ else SeverityLevel.HIGH

            probable_cause = top_fact.documented_description
            root_cause_summary = f"{snapshot.inverter_manufacturer or 'Inverter'} hardware alarm: {top_fact.documented_name} ({top_fact.code})"
            confidence = 0.98
            confidence_meaning = "Confirmed direct match in verified manufacturer fault catalog. High precision."

            action_steps = [s.strip() for s in top_fact.documented_troubleshooting.split("\n") if s.strip()]
            precautions = [top_fact.manufacturer_hazard_warning] if top_fact.manufacturer_hazard_warning else ["Observe electrical safety precautions."]

            rec = InspectionRecommendation(
                title=f"Resolve {top_fact.manufacturer} Fault {top_fact.code}: {top_fact.documented_name}",
                action_steps=action_steps,
                priority="IMMEDIATE" if "DANGER" in (top_fact.manufacturer_hazard_warning or "") else "HIGH",
                safety_precautions=precautions,
                tools_required=["True-RMS Multimeter", "Insulation Tester (if ground fault)"],
            )
            is_suspicion = False
        else:
            # Unresolved codes or generic status
            category = DetectionCategory.INVERTER_FAULT
            severity = SeverityLevel.WARNING
            probable_cause = f"Inverter signaled unmapped fault code(s) [{', '.join(unresolved_codes)}]. Requires OEM manual consultation."
            root_cause_summary = f"Unresolved inverter alarm [{', '.join(unresolved_codes)}]"
            confidence = 0.60
            confidence_meaning = "Alarm state detected from telemetry, but exact OEM code definition is unverified. Diagnostic hypothesis requires manual confirmation."
            rec = InspectionRecommendation(
                title="Consult Inverter User Manual for Unresolved Error Code",
                action_steps=[
                    f"Check {snapshot.inverter_manufacturer or 'inverter'} user manual for fault code(s): {', '.join(unresolved_codes)}.",
                    "Record LED flash sequence or display screen message.",
                    "Contact authorized service center with inverter model number and serial.",
                ],
                priority="MEDIUM",
                safety_precautions=["Do not attempt internal circuit board repairs."],
                tools_required=["OEM user manual", "Smartphone camera"],
            )
            is_suspicion = True

        energy_loss, financial_loss = self.calculate_energy_and_financial_loss(snapshot)

        return DiagnosisResult(
            diagnosis_id=self.generate_diagnosis_id("DIAG-INV"),
            category=category,
            severity=severity,
            probable_cause=probable_cause,
            root_cause_summary=root_cause_summary,
            evidence=evidence_list,
            inputs_used=inputs_used,
            missing_inputs=missing_inputs,
            rule_identifier=self.rule_id,
            score_or_confidence=confidence,
            confidence_meaning=confidence_meaning,
            recommended_next_inspection=rec,
            energy_impact_kwh=energy_loss,
            financial_impact_inr=financial_loss,
            is_suspicion_only=is_suspicion,
        )
