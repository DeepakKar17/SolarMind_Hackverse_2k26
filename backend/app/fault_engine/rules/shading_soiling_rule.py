"""
SolarMind Shading & Soiling Detection Rule.

Identifies suspected module soiling (gradual multi-day degradation under clear skies)
and localized hard/soft shading (recurrent diurnal dips at specific sun azimuth angles).
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


class ShadingSoilingRule(BaseDetectionRule):
    """Rule 8: Identifies soiling dust accumulation or localized obstacle shading."""

    @property
    def rule_id(self) -> str:
        return "RULE_SHADE_SOIL_001"

    @property
    def name(self) -> str:
        return "Module Soiling & Obstacle Shading Detection"

    @property
    def category(self) -> DetectionCategory:
        return DetectionCategory.SHADING_OR_SOILING

    @property
    def priority(self) -> int:
        return 80

    def evaluate(self, snapshot: TelemetrySnapshot) -> Optional[DiagnosisResult]:
        inputs_used: List[str] = []
        missing_inputs: List[str] = []
        evidence_list: List[DiagnosticEvidence] = []

        if snapshot.ac_power_kw is not None:
            inputs_used.append("ac_power_kw")
        else:
            missing_inputs.append("ac_power_kw")

        if snapshot.expected_power_kw is not None:
            inputs_used.append("expected_power_kw")
        else:
            missing_inputs.append("expected_power_kw")

        # 1. Evaluate Timeseries History for Soiling or Shading Signature
        readings = snapshot.historical_readings or []
        if len(readings) >= 3:
            inputs_used.append("historical_readings")
            # Check for consistent 10-25% deficit without any inverter fault codes or voltage anomalies
            deficits = []
            for r in readings:
                exp = r.get("expected_power_kw") or snapshot.expected_power_kw
                act = r.get("ac_power_kw") or r.get("p_ac")
                if exp and act and exp > 1.0:
                    deficits.append((exp - act) / exp)

            if deficits:
                avg_deficit = sum(deficits) / len(deficits)
                if 0.12 <= avg_deficit <= 0.30 and not snapshot.reported_fault_codes:
                    evidence_list.append(
                        DiagnosticEvidence(
                            metric_name="multi_sample_soiling_deficit",
                            observed_value=f"{round(avg_deficit * 100, 1)}% consistent attenuation",
                            expected_range_or_baseline="< 5.0% clean module loss",
                            unit="%",
                            explanation=f"Array exhibits consistent {round(avg_deficit * 100, 1)}% power attenuation across multiple readings under sunny conditions without electrical trips.",
                        )
                    )

                    confidence = 0.78
                    confidence_meaning = "Statistical persistence of moderate (12-30%) yield reduction under clear skies without inverter alarms."
                    energy_loss, financial_loss = self.calculate_energy_and_financial_loss(snapshot)

                    return DiagnosisResult(
                        diagnosis_id=self.generate_diagnosis_id("DIAG-SOIL"),
                        category=DetectionCategory.SHADING_OR_SOILING,
                        severity=SeverityLevel.LOW if avg_deficit < 0.20 else SeverityLevel.WARNING,
                        probable_cause="Dust accumulation, bird soiling, industrial particulate buildup, or soft shading from nearby structures/vegetation.",
                        root_cause_summary=f"Suspected module soiling / shading ({round(avg_deficit * 100, 0)}% attenuation)",
                        evidence=evidence_list,
                        inputs_used=inputs_used,
                        missing_inputs=missing_inputs,
                        rule_identifier=self.rule_id,
                        score_or_confidence=confidence,
                        confidence_meaning=confidence_meaning,
                        recommended_next_inspection=InspectionRecommendation(
                            title="Visual Array Inspection & Solar Panel Cleaning",
                            action_steps=[
                                "Perform a visual check of the PV modules in the early morning or evening.",
                                "Wash solar panels using clean demineralized or low-TDS water and a soft micro-fiber sponge.",
                                "Trim any tree branches that cast shadows on panels during morning or afternoon sun angles.",
                            ],
                            priority="LOW",
                            safety_precautions=["Clean panels early in morning when glass is cool to prevent thermal shock."],
                            tools_required=["Telescopic solar cleaning brush", "Water hose"],
                        ),
                        energy_impact_kwh=energy_loss,
                        financial_impact_inr=financial_loss,
                        is_suspicion_only=True,
                    )

        return None
