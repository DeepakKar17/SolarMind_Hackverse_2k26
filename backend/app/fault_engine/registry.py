"""
SolarMind Fault Detection Rule Registry.

Manages dynamic registration, ordering, and execution priority of detection rules.
Allows custom rules to be plugged in or disabled for specific plant configurations.
"""

from typing import Dict, List, Optional
from app.fault_engine.base_rule import BaseDetectionRule
from app.fault_engine.rules.grid_interruption_rule import GridInterruptionRule
from app.fault_engine.rules.inverter_fault_rule import InverterFaultRule
from app.fault_engine.rules.low_generation_rule import LowGenerationRule
from app.fault_engine.rules.power_reduction_rule import UnexpectedPowerReductionRule
from app.fault_engine.rules.shading_soiling_rule import ShadingSoilingRule
from app.fault_engine.rules.telemetry_quality_rule import TelemetryQualityRule
from app.fault_engine.rules.temperature_rule import AbnormalTemperatureRule
from app.fault_engine.rules.voltage_current_rule import AbnormalVoltageCurrentRule
from app.fault_engine.rules.insufficient_evidence_rule import InsufficientEvidenceRule
from app.fault_engine.schemas import DetectionCategory


class RuleRegistry:
    """Extensible registry of fault detection rules."""

    def __init__(self):
        self._rules: Dict[str, BaseDetectionRule] = {}
        self.register_default_rules()

    def register_rule(self, rule: BaseDetectionRule) -> None:
        """Register a new detection rule."""
        self._rules[rule.rule_id] = rule

    def unregister_rule(self, rule_id: str) -> Optional[BaseDetectionRule]:
        """Remove a rule by its ID."""
        return self._rules.pop(rule_id, None)

    def get_rule(self, rule_id: str) -> Optional[BaseDetectionRule]:
        """Fetch a specific rule by ID."""
        return self._rules.get(rule_id)

    def get_all_rules(self) -> List[BaseDetectionRule]:
        """Returns all registered rules sorted in execution priority order."""
        return sorted(self._rules.values(), key=lambda r: r.priority)

    def get_rules_for_category(self, category: DetectionCategory) -> List[BaseDetectionRule]:
        """Returns rules targeting a specific category."""
        return [r for r in self.get_all_rules() if r.category == category]

    def register_default_rules(self) -> None:
        """Populate the standard initial suite of SolarMind fault detection rules."""
        default_rules: List[BaseDetectionRule] = [
            TelemetryQualityRule(),
            GridInterruptionRule(),
            InverterFaultRule(),
            AbnormalTemperatureRule(),
            AbnormalVoltageCurrentRule(),
            LowGenerationRule(),
            UnexpectedPowerReductionRule(),
            ShadingSoilingRule(),
            InsufficientEvidenceRule(),
        ]
        for r in default_rules:
            self.register_rule(r)

    def reset_to_defaults(self) -> None:
        """Clears and re-registers standard rules."""
        self._rules.clear()
        self.register_default_rules()


# Global default rule registry instance
rule_registry = RuleRegistry()
