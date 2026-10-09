"""
SolarMind Low or Absent Generation Detection Rule.

Evaluates plant power output against solar elevation, time of day, and irradiance.
Guarantees that low generation during night, twilight, or thick cloud cover is NOT falsely
diagnosed as an electrical hardware fault.
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


class LowGenerationRule(BaseDetectionRule):
    """Rule 6: Identifies low/absent production during high solar irradiance windows."""

    @property
    def rule_id(self) -> str:
        return "RULE_LOW_GEN_001"

    @property
    def name(self) -> str:
        return "Daylight Generation Deficit & Zero Production Rule"

    @property
    def category(self) -> DetectionCategory:
        return DetectionCategory.LOW_OR_ABSENT_GENERATION

    @property
    def priority(self) -> int:
        return 60

    def evaluate(self, snapshot: TelemetrySnapshot) -> Optional[DiagnosisResult]:
        inputs_used: List[str] = ["installed_capacity_kwp"]
        missing_inputs: List[str] = []
        evidence_list: List[DiagnosticEvidence] = []

        if snapshot.ac_power_kw is not None:
            inputs_used.append("ac_power_kw")
        else:
            missing_inputs.append("ac_power_kw")

        if snapshot.poa_irradiance_wm2 is not None:
            inputs_used.append("poa_irradiance_wm2")
        else:
            missing_inputs.append("poa_irradiance_wm2")

        if snapshot.solar_elevation_deg is not None:
            inputs_used.append("solar_elevation_deg")
        else:
            missing_inputs.append("solar_elevation_deg")

        p_ac = snapshot.ac_power_kw
        irr = snapshot.poa_irradiance_wm2
        sun_elev = snapshot.solar_elevation_deg
        cap_kwp = snapshot.installed_capacity_kwp

        # SAFEGUARD 1: Nighttime / low sun elevation -> NO FAULT
        if sun_elev is not None and sun_elev < 5.0:
            return None  # Sun is below horizon / twilight; low generation is physics-expected

        # SAFEGUARD 2: Low Irradiance (overcast / rain) -> If power is low but irradiance is also low, NO HARDWARE FAULT
        if irr is not None and irr < 120.0:
            return None  # Thick overcast; low power is fully explained by solar irradiance deficit

        if p_ac is None:
            return None

        # Condition 1: High sun / irradiance present, but absolute ZERO generation
        if (irr is not None and irr > 400.0) or (sun_elev is not None and sun_elev > 25.0):
            if p_ac < 0.05:  # Zero generation in full sun
                evidence_list.append(
                    DiagnosticEvidence(
                        metric_name="ac_power_kw",
                        observed_value=p_ac,
                        expected_range_or_baseline=f"> {round(cap_kwp * 0.4, 2)} kW (under {irr or 'peak sun'} W/m²)",
                        unit="kW",
                        explanation=f"Plant is producing 0.0 kW during clear daylight (solar elevation={sun_elev or 'high'}°, irradiance={irr or 'sunny'} W/m²).",
                        supporting_factors={"solar_elevation_deg": sun_elev, "poa_irradiance_wm2": irr, "capacity_kwp": cap_kwp},
                    )
                )

                confidence = 0.92
                confidence_meaning = "Confirmed zero power generation despite validated solar irradiance. Critical production deficit."
                energy_loss, financial_loss = self.calculate_energy_and_financial_loss(snapshot)

                return DiagnosisResult(
                    diagnosis_id=self.generate_diagnosis_id("DIAG-ZERO-GEN"),
                    category=DetectionCategory.LOW_OR_ABSENT_GENERATION,
                    severity=SeverityLevel.CRITICAL,
                    probable_cause="Inverter shutdown, tripped DC switch/fuse, AC grid disconnect, or anti-islanding trip.",
                    root_cause_summary="Zero solar generation during high sun window",
                    evidence=evidence_list,
                    inputs_used=inputs_used,
                    missing_inputs=missing_inputs,
                    rule_identifier=self.rule_id,
                    score_or_confidence=confidence,
                    confidence_meaning=confidence_meaning,
                    recommended_next_inspection=InspectionRecommendation(
                        title="Complete On-Site Solar Generation Chain Inspection",
                        action_steps=[
                            "Check inverter front panel display or LED status indicator.",
                            "Verify DC rotary switch is ON.",
                            "Verify AC solar circuit breaker in main switchboard is ON.",
                            "Measure DC input voltage at inverter terminals.",
                        ],
                        priority="IMMEDIATE",
                        safety_precautions=["High voltage hazard. Use insulated PPE tools."],
                        tools_required=["Multimeter", "Safety gloves"],
                    ),
                    energy_impact_kwh=energy_loss,
                    financial_impact_inr=financial_loss,
                    is_suspicion_only=False,
                )

        return None
