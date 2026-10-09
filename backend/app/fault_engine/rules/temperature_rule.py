"""
SolarMind Temperature & Thermal Derating Detection Rule.

Evaluates internal inverter heatsink temperature, module operating temperature,
and ambient temperature to identify thermal throttling, overheating, and cooling fan failures.
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


class AbnormalTemperatureRule(BaseDetectionRule):
    """Rule 4: Detects abnormal inverter/module temperatures and thermal derating."""

    @property
    def rule_id(self) -> str:
        return "RULE_TEMP_001"

    @property
    def name(self) -> str:
        return "Thermal Limits & Heatsink Derating Detection"

    @property
    def category(self) -> DetectionCategory:
        return DetectionCategory.ABNORMAL_TEMPERATURE

    @property
    def priority(self) -> int:
        return 40

    def evaluate(self, snapshot: TelemetrySnapshot) -> Optional[DiagnosisResult]:
        inputs_used: List[str] = []
        missing_inputs: List[str] = []
        evidence_list: List[DiagnosticEvidence] = []

        if snapshot.internal_temp_c is not None:
            inputs_used.append("internal_temp_c")
        else:
            missing_inputs.append("internal_temp_c")

        if snapshot.ambient_temp_c is not None:
            inputs_used.append("ambient_temp_c")
        else:
            missing_inputs.append("ambient_temp_c")

        if snapshot.module_temp_c is not None:
            inputs_used.append("module_temp_c")
        else:
            missing_inputs.append("module_temp_c")

        t_internal = snapshot.internal_temp_c
        t_ambient = snapshot.ambient_temp_c

        # If internal temperature is completely missing, rule cannot execute
        if t_internal is None:
            return None

        is_critical_overtemp = t_internal >= 85.0
        is_thermal_derating = t_internal >= 70.0

        if is_critical_overtemp:
            evidence_list.append(
                DiagnosticEvidence(
                    metric_name="internal_temp_c",
                    observed_value=t_internal,
                    expected_range_or_baseline="< 65.0 °C under standard operation",
                    unit="°C",
                    explanation=f"Inverter internal heatsink reached critical {t_internal}°C, approaching shutdown limit.",
                    supporting_factors={"ambient_temp_c": t_ambient},
                )
            )
        elif is_thermal_derating:
            evidence_list.append(
                DiagnosticEvidence(
                    metric_name="internal_temp_c",
                    observed_value=t_internal,
                    expected_range_or_baseline="< 65.0 °C",
                    unit="°C",
                    explanation=f"Inverter heatsink at {t_internal}°C is triggering power output thermal derating to protect power transistors.",
                    supporting_factors={"ambient_temp_c": t_ambient},
                )
            )

        # Check extreme delta between internal and ambient if ambient is provided
        if t_ambient is not None and (t_internal - t_ambient) > 45.0:
            evidence_list.append(
                DiagnosticEvidence(
                    metric_name="temperature_delta_internal_vs_ambient",
                    observed_value=round(t_internal - t_ambient, 1),
                    expected_range_or_baseline="< 35.0 °C differential",
                    unit="°C",
                    explanation=f"Heatsink is running {round(t_internal - t_ambient, 1)}°C above ambient air, indicating restricted airflow or cooling fan failure.",
                )
            )

        if not evidence_list:
            return None

        confidence = 0.92 if is_critical_overtemp else 0.85
        confidence_meaning = (
            "Confidence derived directly from onboard calibrated RTD/thermistor temperature telemetry. "
            "High confidence when heatsink temperatures exceed 70°C."
        )

        energy_loss, financial_loss = self.calculate_energy_and_financial_loss(snapshot)

        return DiagnosisResult(
            diagnosis_id=self.generate_diagnosis_id("DIAG-TEMP"),
            category=DetectionCategory.ABNORMAL_TEMPERATURE,
            severity=SeverityLevel.CRITICAL if is_critical_overtemp else SeverityLevel.WARNING,
            probable_cause="Restricted ventilation, clogged heatsink cooling fins, external cooling fan failure, or direct intense solar exposure on inverter chassis.",
            root_cause_summary=f"Inverter thermal {'overheating critical hazard' if is_critical_overtemp else 'derating active'} ({t_internal}°C)",
            evidence=evidence_list,
            inputs_used=inputs_used,
            missing_inputs=missing_inputs,
            rule_identifier=self.rule_id,
            score_or_confidence=confidence,
            confidence_meaning=confidence_meaning,
            recommended_next_inspection=InspectionRecommendation(
                title="Inspect Inverter Ventilation & Clean Heatsink Fins",
                action_steps=[
                    "Check for dust, leaves, or animal nesting in inverter heatsink fins.",
                    "Verify internal/external cooling fans spin freely when commanded.",
                    "Ensure at least 300mm unobstructed clearance on top, bottom, and sides of inverter.",
                    "If inverter is in direct afternoon sunlight, install a UV/thermal protective canopy.",
                ],
                priority="HIGH" if is_critical_overtemp else "MEDIUM",
                safety_precautions=["Do not spray pressurized water directly onto electrical enclosures or fan grilles."],
                tools_required=["Compressed air duster", "Infrared thermometer"],
            ),
            energy_impact_kwh=energy_loss,
            financial_impact_inr=financial_loss,
            is_suspicion_only=False,
        )
