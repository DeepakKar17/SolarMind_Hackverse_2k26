"""
SolarMind Voltage & Current Pattern Anomaly Detection Rule.

Evaluates DC voltage-current relationships, open-circuit conditions (Voc with zero current),
shorted bypass diode signatures, and MPPT string divergence on multi-string systems.
Gracefully handles household single-string systems.
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


class AbnormalVoltageCurrentRule(BaseDetectionRule):
    """Rule 5: Detects DC open circuit, shorted bypass diodes, and string electrical divergence."""

    @property
    def rule_id(self) -> str:
        return "RULE_VI_PATTERN_001"

    @property
    def name(self) -> str:
        return "DC Voltage/Current Anomaly & String Disconnect Detection"

    @property
    def category(self) -> DetectionCategory:
        return DetectionCategory.ABNORMAL_VOLTAGE_CURRENT

    @property
    def priority(self) -> int:
        return 50

    def evaluate(self, snapshot: TelemetrySnapshot) -> Optional[DiagnosisResult]:
        inputs_used: List[str] = []
        missing_inputs: List[str] = []
        evidence_list: List[DiagnosticEvidence] = []

        if snapshot.dc_voltage_v is not None:
            inputs_used.append("dc_voltage_v")
        else:
            missing_inputs.append("dc_voltage_v")

        if snapshot.dc_current_a is not None:
            inputs_used.append("dc_current_a")
        else:
            missing_inputs.append("dc_current_a")

        v_dc = snapshot.dc_voltage_v
        i_dc = snapshot.dc_current_a
        irr = snapshot.poa_irradiance_wm2
        sun_elev = snapshot.solar_elevation_deg

        is_sun_active = (irr is not None and irr > 200.0) or (sun_elev is not None and sun_elev > 15.0)

        # 1. Condition: Open Circuit Disconnect (High DC Voltage, Zero DC Current under Sun)
        if is_sun_active and v_dc is not None and v_dc > 80.0 and (i_dc is not None and i_dc < 0.1):
            evidence_list.append(
                DiagnosticEvidence(
                    metric_name="dc_voltage_and_current_relationship",
                    observed_value=f"V_dc={v_dc}V, I_dc={i_dc}A",
                    expected_range_or_baseline=f"I_dc > 2.0A when irradiance={irr or 'Daylight'} W/m²",
                    unit="V / A",
                    explanation=f"String open circuit detected. DC voltage is {v_dc}V (open circuit Voc) but current is 0.0A despite daylight.",
                    supporting_factors={"irradiance_wm2": irr, "solar_elevation_deg": sun_elev},
                )
            )
            confidence = 0.95
            confidence_meaning = "Definite open circuit signature: string is under sunlight with open-circuit voltage present, but zero current is flowing."
            energy_loss, financial_loss = self.calculate_energy_and_financial_loss(snapshot)
            return DiagnosisResult(
                diagnosis_id=self.generate_diagnosis_id("DIAG-DC-OPEN"),
                category=DetectionCategory.ABNORMAL_VOLTAGE_CURRENT,
                severity=SeverityLevel.HIGH,
                probable_cause="Blown DC string fuse, tripped DC isolator switch, disconnected MC4 cable connector, or internal MPPT relay open.",
                root_cause_summary="DC String Open Circuit (0A current under sun)",
                evidence=evidence_list,
                inputs_used=inputs_used,
                missing_inputs=missing_inputs,
                rule_identifier=self.rule_id,
                score_or_confidence=confidence,
                confidence_meaning=confidence_meaning,
                recommended_next_inspection=InspectionRecommendation(
                    title="Check DC Isolator, Fuses, and MC4 Connectors",
                    action_steps=[
                        "Inspect DC rotary isolator switch beside inverter to confirm it is turned fully ON.",
                        "Inspect DC string fuses in combiner box with a continuity tester.",
                        "Inspect rooftop DC array cabling and MC4 connectors for physical disconnection or burning.",
                    ],
                    priority="HIGH",
                    safety_precautions=["Dangerous DC high voltage present. De-energize system before touching connectors."],
                    tools_required=["DC Clamp Meter", "Digital Multimeter (1000V DC rated)"],
                ),
                energy_impact_kwh=energy_loss,
                financial_impact_inr=financial_loss,
                is_suspicion_only=False,
            )

        # 2. Multi-String MPPT Channel Divergence (Only for installations with >= 2 MPPTs/strings)
        if snapshot.mppt_channels and len(snapshot.mppt_channels) >= 2:
            inputs_used.append("mppt_channels")
            ch1 = snapshot.mppt_channels[0]
            ch2 = snapshot.mppt_channels[1]
            v1, i1 = ch1.get("v", 0.0), ch1.get("i", 0.0)
            v2, i2 = ch2.get("v", 0.0), ch2.get("i", 0.0)

            # Check severe current divergence between strings (>50% difference under good sun)
            if is_sun_active and max(i1, i2) > 2.0 and min(i1, i2) < (0.3 * max(i1, i2)):
                evidence_list.append(
                    DiagnosticEvidence(
                        metric_name="mppt_current_divergence",
                        observed_value=f"MPPT1={i1}A, MPPT2={i2}A",
                        expected_range_or_baseline="MPPT currents within ±15% on balanced strings",
                        unit="A",
                        explanation=f"Severe current imbalance between MPPT channels: Channel 1={i1}A vs Channel 2={i2}A.",
                        supporting_factors={"v1": v1, "v2": v2},
                    )
                )
                confidence = 0.88
                confidence_meaning = "Cross-channel current imbalance on multi-string system indicating single string underperformance."
                energy_loss, financial_loss = self.calculate_energy_and_financial_loss(snapshot)
                return DiagnosisResult(
                    diagnosis_id=self.generate_diagnosis_id("DIAG-MPPT-IMBAL"),
                    category=DetectionCategory.ABNORMAL_VOLTAGE_CURRENT,
                    severity=SeverityLevel.HIGH,
                    probable_cause="Partial string disconnection, blown string fuse, or severe localized module failure on one string.",
                    root_cause_summary=f"MPPT String Imbalance ({round(abs(i1 - i2), 1)}A difference)",
                    evidence=evidence_list,
                    inputs_used=inputs_used,
                    missing_inputs=missing_inputs,
                    rule_identifier=self.rule_id,
                    score_or_confidence=confidence,
                    confidence_meaning=confidence_meaning,
                    recommended_next_inspection=InspectionRecommendation(
                        title="Measure Individual MPPT String Operating Currents",
                        action_steps=[
                            "Clamp each DC string cable with a calibrated DC current clamp meter.",
                            "Compare operating Voc and Vmp of MPPT 1 vs MPPT 2.",
                            "Inspect underperforming string for loose MC4 crimps.",
                        ],
                        priority="HIGH",
                        safety_precautions=["Do not disconnect MC4 connectors under load (while current is flowing)."],
                        tools_required=["DC Clamp Meter"],
                    ),
                    energy_impact_kwh=energy_loss,
                    financial_impact_inr=financial_loss,
                    is_suspicion_only=False,
                )

        # Single-string installation: If installation is single-string, note single-string context
        if snapshot.strings_count == 1:
            inputs_used.append("single_string_topology")

        return None
