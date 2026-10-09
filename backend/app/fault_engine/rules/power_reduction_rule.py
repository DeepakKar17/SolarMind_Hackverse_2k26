"""
SolarMind Unexpected Power Reduction Detection Rule.

Evaluates instantaneous and timeseries generation against the calibrated expected generation
baseline to catch unexpected performance degradation when sky conditions are clear.
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


class UnexpectedPowerReductionRule(BaseDetectionRule):
    """Rule 7: Detects unexpected power deficit against expected production baseline."""

    @property
    def rule_id(self) -> str:
        return "RULE_POWER_DROP_001"

    @property
    def name(self) -> str:
        return "Expected Generation Baseline Deficit Detection"

    @property
    def category(self) -> DetectionCategory:
        return DetectionCategory.UNEXPECTED_POWER_REDUCTION

    @property
    def priority(self) -> int:
        return 70

    def evaluate(self, snapshot: TelemetrySnapshot) -> Optional[DiagnosisResult]:
        if snapshot.expected_power_kw is None or snapshot.ac_power_kw is None:
            return None

        inputs_used: List[str] = ["ac_power_kw", "expected_power_kw"]
        missing_inputs: List[str] = []
        evidence_list: List[DiagnosticEvidence] = []

        if snapshot.poa_irradiance_wm2 is not None:
            inputs_used.append("poa_irradiance_wm2")
        else:
            missing_inputs.append("poa_irradiance_wm2")

        expected = max(0.0, snapshot.expected_power_kw)
        actual = max(0.0, snapshot.ac_power_kw)

        if expected < 0.5:
            return None  # Baseline is minimal (early morning / sunset)

        # Compute deficit ratio
        deficit_kw = expected - actual
        deficit_pct = (deficit_kw / expected) * 100.0 if expected > 0 else 0.0

        # Check if actual power is significantly below expected (>35% deficit)
        if deficit_pct >= 35.0:
            evidence_list.append(
                DiagnosticEvidence(
                    metric_name="expected_vs_actual_power_kw",
                    observed_value=f"{round(actual, 2)} kW",
                    expected_range_or_baseline=f"{round(expected, 2)} kW (Deficit: {round(deficit_pct, 1)}%)",
                    unit="kW",
                    explanation=f"Plant is producing {round(actual, 2)} kW, which is {round(deficit_pct, 1)}% below the expected solar baseline of {round(expected, 2)} kW.",
                    supporting_factors={"expected_power_kw": expected, "actual_power_kw": actual, "poa_irradiance_wm2": snapshot.poa_irradiance_wm2},
                )
            )

            # Confidence is higher if irradiance confirms sunny conditions
            confidence = 0.88 if (snapshot.poa_irradiance_wm2 and snapshot.poa_irradiance_wm2 > 500.0) else 0.72
            confidence_meaning = (
                "Mathematical ratio of actual output to expected generation model baseline. "
                "Higher confidence when verified by on-site/satellite irradiance sensors."
            )

            energy_loss, financial_loss = self.calculate_energy_and_financial_loss(snapshot)

            return DiagnosisResult(
                diagnosis_id=self.generate_diagnosis_id("DIAG-PWR-DROP"),
                category=DetectionCategory.UNEXPECTED_POWER_REDUCTION,
                severity=SeverityLevel.HIGH if deficit_pct > 60.0 else SeverityLevel.WARNING,
                probable_cause="Partial array underperformance, isolated string failure, heavy dust/soiling accumulation, or localized shading.",
                root_cause_summary=f"Unexpected {round(deficit_pct, 0)}% power output reduction vs expected baseline",
                evidence=evidence_list,
                inputs_used=inputs_used,
                missing_inputs=missing_inputs,
                rule_identifier=self.rule_id,
                score_or_confidence=confidence,
                confidence_meaning=confidence_meaning,
                recommended_next_inspection=InspectionRecommendation(
                    title="Perform String-Level Output & Visual Module Inspection",
                    action_steps=[
                        "Measure operating current of individual strings using a DC clamp meter.",
                        "Inspect solar panel surface for dust layer, bird droppings, or foliage overgrowth.",
                        "Check for hot spots or discolored solar cells using a thermal imaging camera.",
                    ],
                    priority="HIGH" if deficit_pct > 60.0 else "MEDIUM",
                    safety_precautions=["Do not walk on solar modules."],
                    tools_required=["DC clamp meter", "Thermal camera / Pyranometer"],
                ),
                energy_impact_kwh=energy_loss,
                financial_impact_inr=financial_loss,
                is_suspicion_only=False,
            )

        return None
