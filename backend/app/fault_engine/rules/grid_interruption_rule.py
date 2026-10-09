"""
SolarMind Grid Interruption & Power-Cut Detection Rule.

Identifies AC utility grid collapse, under/over-voltage events, frequency excursion,
and utility outages to distinguish external utility events from plant hardware faults.
"""

from typing import List, Optional

from app.fault_engine.base_rule import BaseDetectionRule
from app.fault_engine.schemas import (
    DetectionCategory,
    DiagnosisResult,
    DiagnosticEvidence,
    InspectionRecommendation,
    SeverityLevel,
    TelemetrySnapshot,
)


class GridInterruptionRule(BaseDetectionRule):
    """Rule 2: Detects external AC supply interruptions and grid voltage/frequency collapse."""

    @property
    def rule_id(self) -> str:
        return "RULE_GRID_INTERRUPT_001"

    @property
    def name(self) -> str:
        return "AC Grid Outage & Frequency Excursion Detection"

    @property
    def category(self) -> DetectionCategory:
        return DetectionCategory.GRID_INTERRUPTION

    @property
    def priority(self) -> int:
        return 20  # Priority 20: External grid failure precedes inverter internal diagnostics

    def evaluate(self, snapshot: TelemetrySnapshot) -> Optional[DiagnosisResult]:
        inputs_used: List[str] = []
        missing_inputs: List[str] = []
        evidence_list: List[DiagnosticEvidence] = []

        # Track available vs missing inputs
        if snapshot.ac_voltage_v is not None:
            inputs_used.append("ac_voltage_v")
        else:
            missing_inputs.append("ac_voltage_v")

        if snapshot.dc_voltage_v is not None:
            inputs_used.append("dc_voltage_v")
        else:
            missing_inputs.append("dc_voltage_v")

        if snapshot.grid_frequency_hz is not None:
            inputs_used.append("grid_frequency_hz")
        else:
            missing_inputs.append("grid_frequency_hz")

        v_ac = snapshot.ac_voltage_v
        v_dc = snapshot.dc_voltage_v
        p_ac = snapshot.ac_power_kw or 0.0
        freq = snapshot.grid_frequency_hz

        is_grid_collapsed = False
        is_frequency_out = False

        # 1. Check AC Voltage Collapse with DC Voltage Present
        if v_ac is not None and v_ac < 30.0 and (v_dc is not None and v_dc > 80.0):
            is_grid_collapsed = True
            evidence_list.append(
                DiagnosticEvidence(
                    metric_name="ac_voltage_v",
                    observed_value=v_ac,
                    expected_range_or_baseline="207.0 - 253.0 V (230V ±10%)",
                    unit="V",
                    explanation=f"AC line voltage collapsed to {v_ac}V while DC array voltage ({v_dc}V) confirms sunlight is available.",
                    supporting_factors={"dc_voltage_v": v_dc, "ac_power_kw": p_ac},
                )
            )
        elif v_ac is not None and (v_ac < 180.0 or v_ac > 270.0):
            is_grid_collapsed = True
            evidence_list.append(
                DiagnosticEvidence(
                    metric_name="ac_voltage_v",
                    observed_value=v_ac,
                    expected_range_or_baseline="207.0 - 253.0 V",
                    unit="V",
                    explanation=f"Grid voltage {v_ac}V exceeded statutory tolerance window causing inverter anti-islanding trip.",
                )
            )

        # 2. Check Frequency Excursion (for 50Hz nominal grid)
        if freq is not None and (freq < 47.5 or freq > 52.0) and freq > 0.0:
            is_frequency_out = True
            evidence_list.append(
                DiagnosticEvidence(
                    metric_name="grid_frequency_hz",
                    observed_value=freq,
                    expected_range_or_baseline="49.5 - 50.5 Hz",
                    unit="Hz",
                    explanation=f"Grid frequency deviated to {freq}Hz beyond anti-islanding trip threshold.",
                )
            )

        # 3. Check Inverter Status string for grid keywords
        if snapshot.inverter_status and any(k in snapshot.inverter_status.lower() for k in ["grid_lost", "grid_fault", "ac_absent", "islanding"]):
            evidence_list.append(
                DiagnosticEvidence(
                    metric_name="inverter_status",
                    observed_value=snapshot.inverter_status,
                    expected_range_or_baseline="NORMAL / GENERATING",
                    unit=None,
                    explanation=f"Inverter reported internal state '{snapshot.inverter_status}'.",
                )
            )

        if not evidence_list:
            return None

        # Confidence: High if direct V_ac collapse + V_dc present; medium if only status flag
        confidence = 0.95 if is_grid_collapsed else (0.85 if is_frequency_out else 0.70)
        confidence_meaning = (
            "Probability based on electrical AC voltage/frequency measurements. Score 0.95 indicates confirmed physical utility disconnection or grid trip."
        )

        energy_loss, financial_loss = self.calculate_energy_and_financial_loss(snapshot)

        return DiagnosisResult(
            diagnosis_id=self.generate_diagnosis_id("DIAG-GRID"),
            category=DetectionCategory.GRID_INTERRUPTION,
            severity=SeverityLevel.HIGH if is_grid_collapsed else SeverityLevel.WARNING,
            probable_cause="Utility power cut, neighborhood distribution outage, or tripped AC isolator/MCB breaker.",
            root_cause_summary="AC utility grid interruption suspected from voltage/frequency collapse.",
            evidence=evidence_list,
            inputs_used=inputs_used,
            missing_inputs=missing_inputs,
            rule_identifier=self.rule_id,
            score_or_confidence=confidence,
            confidence_meaning=confidence_meaning,
            recommended_next_inspection=InspectionRecommendation(
                title="Verify AC Main Breaker & Utility Supply Status",
                action_steps=[
                    "Check if household appliances / grid power is active on the same electrical phase.",
                    "Inspect the solar AC miniature circuit breaker (MCB) and residual current device (RCD) in the distribution board.",
                    "If MCB is tripped, inspect AC wiring for loose connections before re-engaging.",
                ],
                priority="HIGH",
                safety_precautions=["Do not touch exposed AC terminals. Ensure hands are dry before inspecting breaker panel."],
                tools_required=["AC Voltage Detector Pen / Digital True-RMS Multimeter"],
            ),
            energy_impact_kwh=energy_loss,
            financial_impact_inr=financial_loss,
            is_suspicion_only=False,
        )
