"""
Comprehensive Test Suite for SolarMind Modular & Explainable Fault Detection Engine.

Tests covering:
- Normal healthy operation (no false positives)
- Daylight vs Night / Twilight vs Cloud cover safeguards (no false alarms)
- Missing, stale, and corrupted telemetry detection
- Grid outage and AC supply collapse detection
- Manufacturer-specific verified fault codes (Deye, SMA, Fronius, Growatt)
- Unrecognized / unsupported fault codes (marked unresolved, no guessing)
- Thermal derating and heatsink overheating
- DC open circuit (Voc with zero current)
- Single-string household systems vs Multi-string MPPT imbalances
- Expected generation baseline deficit detection
- Multi-day soiling and obstacle shading detection
- Contradictory evidence and fallback to insufficient evidence
- Energy and financial loss impact calculation rules
- Custom rule registration and priority execution in RuleRegistry
"""

from datetime import datetime, timedelta, timezone
import pytest

from app.fault_engine import (
    DetectionCategory,
    FaultDetectionEngine,
    RuleRegistry,
    SeverityLevel,
    TelemetrySnapshot,
    fault_detection_engine,
    lookup_fault_code,
)
from app.fault_engine.base_rule import BaseDetectionRule
from app.fault_engine.schemas import DiagnosisResult, DiagnosticEvidence, InspectionRecommendation


def test_normal_healthy_operation_no_false_positive():
    """Verify that a healthy solar system under full sunlight generates no spurious fault diagnoses."""
    now = datetime.now(timezone.utc)
    snapshot = TelemetrySnapshot(
        plant_id=1,
        inverter_id="INV-01",
        timestamp=now,
        dc_voltage_v=340.0,
        dc_current_a=8.2,
        dc_power_kw=2.78,
        ac_voltage_v=230.5,
        ac_current_a=11.8,
        ac_power_kw=2.72,
        grid_frequency_hz=50.02,
        internal_temp_c=48.5,
        ambient_temp_c=28.0,
        poa_irradiance_wm2=780.0,
        solar_elevation_deg=45.0,
        daily_yield_kwh=16.5,
        installed_capacity_kwp=3.0,
        expected_power_kw=2.75,
        inverter_status="NORMAL",
        reported_fault_codes=[],
        data_quality_flag="VALID",
        strings_count=1,
    )

    results = fault_detection_engine.diagnose_all(snapshot)
    # Under healthy conditions, only the fallback might run if all rules return None
    # Let's check that no high/critical hardware fault is diagnosed
    for res in results:
        assert res.category not in [
            DetectionCategory.INVERTER_FAULT,
            DetectionCategory.GRID_INTERRUPTION,
            DetectionCategory.ABNORMAL_VOLTAGE_CURRENT,
            DetectionCategory.ABNORMAL_TEMPERATURE,
            DetectionCategory.LOW_OR_ABSENT_GENERATION,
            DetectionCategory.UNEXPECTED_POWER_REDUCTION,
        ]


def test_night_and_twilight_safeguard_no_false_alarm():
    """Verify that zero power output during night or low sun (<5 deg) is NEVER flagged as a fault."""
    now = datetime.now(timezone.utc)
    night_snapshot = TelemetrySnapshot(
        plant_id=1,
        inverter_id="INV-01",
        timestamp=now,
        dc_voltage_v=5.0,
        dc_current_a=0.0,
        dc_power_kw=0.0,
        ac_voltage_v=230.0,
        ac_current_a=0.0,
        ac_power_kw=0.0,
        grid_frequency_hz=50.0,
        solar_elevation_deg=-15.0,  # Nighttime
        poa_irradiance_wm2=0.0,
        installed_capacity_kwp=5.0,
        expected_power_kw=0.0,
    )

    results = fault_detection_engine.diagnose_all(night_snapshot)
    for res in results:
        assert res.category != DetectionCategory.LOW_OR_ABSENT_GENERATION


def test_heavy_overcast_cloud_safeguard_no_hardware_fault():
    """Verify that low power during thick rain/cloud cover (<120 W/m2) is not flagged as an electrical fault."""
    now = datetime.now(timezone.utc)
    cloudy_snapshot = TelemetrySnapshot(
        plant_id=1,
        inverter_id="INV-01",
        timestamp=now,
        dc_voltage_v=180.0,
        dc_current_a=0.8,
        dc_power_kw=0.14,
        ac_voltage_v=231.0,
        ac_current_a=0.6,
        ac_power_kw=0.13,
        solar_elevation_deg=35.0,
        poa_irradiance_wm2=85.0,  # Heavy rain / dark clouds
        installed_capacity_kwp=5.0,
        expected_power_kw=0.15,
    )

    results = fault_detection_engine.diagnose_all(cloudy_snapshot)
    for res in results:
        assert res.category != DetectionCategory.LOW_OR_ABSENT_GENERATION
        assert res.category != DetectionCategory.UNEXPECTED_POWER_REDUCTION


def test_stale_and_missing_telemetry_detection():
    """Verify that stale telemetry (>2 hours old during daylight) triggers TELEMETRY_QUALITY."""
    stale_time = datetime.now(timezone.utc) - timedelta(hours=3, minutes=15)
    stale_snapshot = TelemetrySnapshot(
        plant_id=2,
        inverter_id="INV-STALE-01",
        timestamp=stale_time,
        ac_power_kw=1.5,
        poa_irradiance_wm2=650.0,
        solar_elevation_deg=40.0,
        data_quality_flag="VALID",
    )

    diag = fault_detection_engine.diagnose_primary(stale_snapshot)
    assert diag.category == DetectionCategory.TELEMETRY_QUALITY
    assert diag.rule_identifier == "RULE_TEL_QUALITY_001"
    assert diag.severity in [SeverityLevel.WARNING, SeverityLevel.HIGH]
    assert diag.score_or_confidence >= 0.90
    assert any("telemetry_freshness_age_minutes" in ev.metric_name for ev in diag.evidence)


def test_grid_outage_detection():
    """Verify that AC voltage collapse (V_ac < 30V) while DC voltage is present flags GRID_INTERRUPTION."""
    now = datetime.now(timezone.utc)
    grid_cut_snapshot = TelemetrySnapshot(
        plant_id=3,
        inverter_id="INV-GRID-01",
        timestamp=now,
        dc_voltage_v=320.0,
        dc_current_a=0.0,
        ac_voltage_v=0.0,  # Grid cut
        ac_power_kw=0.0,
        grid_frequency_hz=0.0,
        poa_irradiance_wm2=700.0,
        solar_elevation_deg=50.0,
        installed_capacity_kwp=5.0,
        expected_power_kw=4.2,
        tariff_rate_inr=8.00,
    )

    diag = fault_detection_engine.diagnose_primary(grid_cut_snapshot)
    assert diag.category == DetectionCategory.GRID_INTERRUPTION
    assert diag.rule_identifier == "RULE_GRID_INTERRUPT_001"
    assert diag.severity == SeverityLevel.HIGH
    assert diag.energy_impact_kwh == 4.2
    assert diag.financial_impact_inr == 33.60  # 4.2 * 8.00


def test_verified_deye_fault_code():
    """Verify that recognized Deye error code F24 correctly flags PV array ground isolation fault."""
    now = datetime.now(timezone.utc)
    deye_snapshot = TelemetrySnapshot(
        plant_id=4,
        inverter_id="INV-DEYE-01",
        timestamp=now,
        inverter_manufacturer="Deye",
        reported_fault_codes=["F24"],
        inverter_status="FAULT",
    )

    diag = fault_detection_engine.diagnose_primary(deye_snapshot)
    assert diag.category == DetectionCategory.ABNORMAL_VOLTAGE_CURRENT
    assert diag.rule_identifier == "RULE_INV_FAULT_001"
    assert diag.severity == SeverityLevel.CRITICAL
    assert diag.score_or_confidence >= 0.95
    assert "Insulation" in diag.root_cause_summary or "Ground" in diag.root_cause_summary


def test_unrecognized_fault_code_marked_unresolved():
    """Verify that unsupported/unrecognized fault codes are marked as unresolved with no guessing."""
    now = datetime.now(timezone.utc)
    unknown_snapshot = TelemetrySnapshot(
        plant_id=5,
        inverter_id="INV-UNKNOWN-01",
        timestamp=now,
        inverter_manufacturer="CustomInverterCo",
        reported_fault_codes=["ERR_9999_MYSTERY"],
        inverter_status="ALARM",
    )

    diag = fault_detection_engine.diagnose_primary(unknown_snapshot)
    assert diag.category == DetectionCategory.INVERTER_FAULT
    assert diag.is_suspicion_only is True
    assert diag.score_or_confidence == 0.60
    assert "ERR_9999_MYSTERY" in diag.root_cause_summary
    assert any("unresolved_fault_code" in ev.metric_name for ev in diag.evidence)


def test_thermal_overheating_detection():
    """Verify that internal heatsink temperature exceeding 70 deg C triggers ABNORMAL_TEMPERATURE."""
    now = datetime.now(timezone.utc)
    hot_snapshot = TelemetrySnapshot(
        plant_id=6,
        inverter_id="INV-HOT-01",
        timestamp=now,
        internal_temp_c=78.5,
        ambient_temp_c=36.0,
        ac_power_kw=3.0,
        installed_capacity_kwp=5.0,
        expected_power_kw=4.5,
    )

    diag = fault_detection_engine.diagnose_primary(hot_snapshot)
    assert diag.category == DetectionCategory.ABNORMAL_TEMPERATURE
    assert diag.rule_identifier == "RULE_TEMP_001"
    assert diag.severity in [SeverityLevel.WARNING, SeverityLevel.HIGH]
    assert diag.score_or_confidence >= 0.85
    assert "78.5" in diag.root_cause_summary


def test_dc_open_circuit_voc_with_zero_current():
    """Verify that DC open circuit (Voc > 80V, I = 0A) under clear sun triggers ABNORMAL_VOLTAGE_CURRENT."""
    now = datetime.now(timezone.utc)
    open_snapshot = TelemetrySnapshot(
        plant_id=7,
        inverter_id="INV-OPEN-01",
        timestamp=now,
        dc_voltage_v=365.0,
        dc_current_a=0.0,  # Open circuit
        ac_power_kw=0.0,
        poa_irradiance_wm2=750.0,
        solar_elevation_deg=45.0,
        installed_capacity_kwp=4.0,
        expected_power_kw=3.5,
    )

    diag = fault_detection_engine.diagnose_primary(open_snapshot)
    assert diag.category == DetectionCategory.ABNORMAL_VOLTAGE_CURRENT
    assert diag.rule_identifier == "RULE_VI_PATTERN_001"
    assert diag.severity == SeverityLevel.HIGH
    assert "Open Circuit" in diag.root_cause_summary


def test_single_string_system_handles_without_errors():
    """Verify that household single-string systems (strings_count=1) do NOT fail or trigger false MPPT imbalances."""
    now = datetime.now(timezone.utc)
    single_string_snapshot = TelemetrySnapshot(
        plant_id=8,
        inverter_id="INV-SINGLE-01",
        timestamp=now,
        strings_count=1,
        mppt_count=1,
        dc_voltage_v=280.0,
        dc_current_a=5.5,
        ac_power_kw=1.45,
        poa_irradiance_wm2=500.0,
        solar_elevation_deg=35.0,
        expected_power_kw=1.50,
    )

    # Should run smoothly without exceptions and without false string imbalance
    results = fault_detection_engine.diagnose_all(single_string_snapshot)
    for res in results:
        assert "MPPT String Imbalance" not in res.root_cause_summary


def test_multi_string_mppt_current_divergence():
    """Verify that multi-string systems with diverging string currents trigger MPPT imbalance."""
    now = datetime.now(timezone.utc)
    multi_string_snapshot = TelemetrySnapshot(
        plant_id=9,
        inverter_id="INV-MULTI-01",
        timestamp=now,
        strings_count=2,
        mppt_count=2,
        mppt_channels=[
            {"channel": 1, "v": 320.0, "i": 8.5},
            {"channel": 2, "v": 315.0, "i": 1.2},  # Underperforming string
        ],
        dc_voltage_v=320.0,
        dc_current_a=9.7,
        ac_power_kw=2.8,
        poa_irradiance_wm2=720.0,
        solar_elevation_deg=48.0,
        installed_capacity_kwp=6.0,
        expected_power_kw=5.2,
    )

    diag = fault_detection_engine.diagnose_primary(multi_string_snapshot)
    assert diag.category == DetectionCategory.ABNORMAL_VOLTAGE_CURRENT
    assert "MPPT String Imbalance" in diag.root_cause_summary


def test_unexpected_power_reduction_against_baseline():
    """Verify that a 45% power deficit under full sun triggers UNEXPECTED_POWER_REDUCTION."""
    now = datetime.now(timezone.utc)
    power_drop_snapshot = TelemetrySnapshot(
        plant_id=10,
        inverter_id="INV-DROP-01",
        timestamp=now,
        ac_power_kw=2.5,
        installed_capacity_kwp=6.0,
        expected_power_kw=5.0,  # 50% deficit
        poa_irradiance_wm2=800.0,
        solar_elevation_deg=52.0,
        tariff_rate_inr=7.50,
    )

    diag = fault_detection_engine.diagnose_primary(power_drop_snapshot)
    assert diag.category == DetectionCategory.UNEXPECTED_POWER_REDUCTION
    assert diag.rule_identifier == "RULE_POWER_DROP_001"
    assert diag.energy_impact_kwh == 2.5  # 5.0 - 2.5
    assert diag.financial_impact_inr == 18.75  # 2.5 * 7.50


def test_suspected_soiling_multi_sample_persistence():
    """Verify that consistent 20% power attenuation across multi-sample history triggers SHADING_OR_SOILING."""
    now = datetime.now(timezone.utc)
    soiling_snapshot = TelemetrySnapshot(
        plant_id=11,
        inverter_id="INV-SOIL-01",
        timestamp=now,
        ac_power_kw=3.2,
        expected_power_kw=4.0,
        historical_readings=[
            {"ac_power_kw": 3.2, "expected_power_kw": 4.0},
            {"ac_power_kw": 3.1, "expected_power_kw": 4.0},
            {"ac_power_kw": 3.3, "expected_power_kw": 4.0},
        ],
        poa_irradiance_wm2=650.0,
        solar_elevation_deg=42.0,
    )

    diag = fault_detection_engine.diagnose_primary(soiling_snapshot)
    assert diag.category == DetectionCategory.SHADING_OR_SOILING
    assert diag.rule_identifier == "RULE_SHADE_SOIL_001"
    assert diag.is_suspicion_only is True


def test_contradictory_evidence_fallback():
    """Verify that contradictory or severely sparse telemetry falls back to UNKNOWN_INSUFFICIENT_EVIDENCE."""
    now = datetime.now(timezone.utc)
    sparse_snapshot = TelemetrySnapshot(
        plant_id=12,
        inverter_id="INV-SPARSE-01",
        timestamp=now,
        poa_irradiance_wm2=750.0,
        ac_power_kw=None,  # Missing electrical measurements
        dc_voltage_v=None,
    )

    diag = fault_detection_engine.diagnose_primary(sparse_snapshot)
    assert diag.category == DetectionCategory.UNKNOWN_INSUFFICIENT_EVIDENCE
    assert diag.rule_identifier == "RULE_INSUFFICIENT_EVID_001"
    assert diag.score_or_confidence <= 0.30
    assert diag.is_suspicion_only is True


def test_custom_rule_registration_and_extensibility():
    """Verify that external custom rules can be dynamically registered in RuleRegistry."""
    registry = RuleRegistry()

    class CustomGroundFaultRule(BaseDetectionRule):
        @property
        def rule_id(self) -> str:
            return "RULE_CUSTOM_GROUND_001"

        @property
        def name(self) -> str:
            return "Custom High Sensitivity Ground Fault Rule"

        @property
        def category(self) -> DetectionCategory:
            return DetectionCategory.ABNORMAL_VOLTAGE_CURRENT

        @property
        def priority(self) -> int:
            return 5  # Very high priority

        def evaluate(self, snapshot: TelemetrySnapshot):
            return DiagnosisResult(
                diagnosis_id="DIAG-CUSTOM-001",
                category=self.category,
                severity=SeverityLevel.CRITICAL,
                probable_cause="Custom detected ground resistance anomaly.",
                root_cause_summary="Custom ground fault",
                evidence=[],
                inputs_used=["custom_input"],
                missing_inputs=[],
                rule_identifier=self.rule_id,
                score_or_confidence=0.99,
                confidence_meaning="Custom high-sensitivity ground detection test.",
                recommended_next_inspection=InspectionRecommendation(
                    title="Custom Inspection",
                    action_steps=["Check custom ground loop."],
                    priority="IMMEDIATE",
                ),
                energy_impact_kwh=None,
                financial_impact_inr=None,
                is_suspicion_only=False,
            )

    custom_rule = CustomGroundFaultRule()
    registry.register_rule(custom_rule)

    custom_engine = FaultDetectionEngine(registry=registry)
    sample_snapshot = TelemetrySnapshot(plant_id=1, inverter_id="INV-01")
    primary_diag = custom_engine.diagnose_primary(sample_snapshot)

    assert primary_diag.rule_identifier == "RULE_CUSTOM_GROUND_001"
    assert primary_diag.severity == SeverityLevel.CRITICAL
