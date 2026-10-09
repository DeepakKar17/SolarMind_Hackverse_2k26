"""
SolarMind Insufficient Evidence & Unknown Cause Fallback Rule.

Evaluates ambiguous, contradictory, or data-sparse telemetry where no specific
physics rule can make a high-confidence determination.
Prevents making unfounded assumptions or false accusations of equipment failure.
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


class InsufficientEvidenceRule(BaseDetectionRule):
    """Rule 9: Handles ambiguous telemetry, contradictory signals, or insufficient sensor coverage."""

    @property
    def rule_id(self) -> str:
        return "RULE_INSUFFICIENT_EVID_001"

    @property
    def name(self) -> str:
        return "Ambiguous Telemetry & Insufficient Evidence Fallback"

    @property
    def category(self) -> DetectionCategory:
        return DetectionCategory.UNKNOWN_INSUFFICIENT_EVIDENCE

    @property
    def priority(self) -> int:
        return 999  # Lowest priority: catch-all fallback

    def evaluate(self, snapshot: TelemetrySnapshot) -> Optional[DiagnosisResult]:
        inputs_used: List[str] = []
        missing_inputs: List[str] = []
        evidence_list: List[DiagnosticEvidence] = []

        # Check what is present vs missing
        fields = [
            ("ac_power_kw", snapshot.ac_power_kw),
            ("dc_voltage_v", snapshot.dc_voltage_v),
            ("dc_current_a", snapshot.dc_current_a),
            ("ac_voltage_v", snapshot.ac_voltage_v),
            ("poa_irradiance_wm2", snapshot.poa_irradiance_wm2),
            ("internal_temp_c", snapshot.internal_temp_c),
            ("expected_power_kw", snapshot.expected_power_kw),
        ]

        for name, val in fields:
            if val is not None:
                inputs_used.append(name)
            else:
                missing_inputs.append(name)

        # Check contradictory evidence: e.g. High irradiance sensor reported, but AC power is null/missing
        is_contradictory = False
        if snapshot.poa_irradiance_wm2 and snapshot.poa_irradiance_wm2 > 600.0 and snapshot.ac_power_kw is None:
            is_contradictory = True
            evidence_list.append(
                DiagnosticEvidence(
                    metric_name="irradiance_vs_power_completeness",
                    observed_value=f"Irradiance={snapshot.poa_irradiance_wm2} W/m², AC Power=None",
                    expected_range_or_baseline="Simultaneous electrical measurements",
                    unit=None,
                    explanation="Environmental irradiance is present, but inverter electrical output telemetry is completely missing.",
                )
            )

        if not evidence_list:
            evidence_list.append(
                DiagnosticEvidence(
                    metric_name="telemetry_sufficiency_ratio",
                    observed_value=f"{len(inputs_used)} / {len(fields)} metrics available",
                    expected_range_or_baseline="At least 5 core metrics",
                    unit=None,
                    explanation=f"Telemetry lacks critical sensor inputs ({', '.join(missing_inputs)}) necessary for definitive root-cause classification.",
                )
            )

        confidence = 0.30
        confidence_meaning = (
            "Confidence is intentionally capped at 0.30 (Inconclusive) to avoid false positive hardware fault accusations when sensor evidence is incomplete."
        )

        return DiagnosisResult(
            diagnosis_id=self.generate_diagnosis_id("DIAG-INSUFFICIENT"),
            category=DetectionCategory.UNKNOWN_INSUFFICIENT_EVIDENCE,
            severity=SeverityLevel.INFO,
            probable_cause=f"Insufficient sensor telemetry to isolate specific root cause. Missing inputs: {', '.join(missing_inputs)}.",
            root_cause_summary="Inconclusive diagnosis due to incomplete or contradictory telemetry",
            evidence=evidence_list,
            inputs_used=inputs_used,
            missing_inputs=missing_inputs,
            rule_identifier=self.rule_id,
            score_or_confidence=confidence,
            confidence_meaning=confidence_meaning,
            recommended_next_inspection=InspectionRecommendation(
                title="Verify Telemetry Sensor Configuration & Monitor Next Daylight Cycle",
                action_steps=[
                    "Check data logger sensor channel mapping and baud rate configuration.",
                    "Ensure pyranometer or weather API integration is active.",
                    "Review plant telemetry during the next full sunny operating day.",
                ],
                priority="LOW",
                safety_precautions=["No immediate electrical intervention required."],
                tools_required=["SolarMind Admin Settings Portal"],
            ),
            energy_impact_kwh=None,
            financial_impact_inr=None,
            is_suspicion_only=True,
        )
