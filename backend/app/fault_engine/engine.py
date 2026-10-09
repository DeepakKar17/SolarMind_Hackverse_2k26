"""
SolarMind Fault Detection Engine & Diagnosis Service Interface.

Orchestrates the evaluation of telemetry snapshots through the prioritized rule registry.
Ensures explainable, evidence-backed diagnostic conclusions with clear confidence bounds.
"""

import logging
from typing import List, Optional
from app.fault_engine.registry import RuleRegistry, rule_registry
from app.fault_engine.schemas import (
    DetectionCategory,
    DiagnosisResult,
    TelemetrySnapshot,
)

logger = logging.getLogger("solarmind.fault_engine")


class FaultDetectionEngine:
    """Core diagnostic engine executing explainable detection rules against solar telemetry."""

    def __init__(self, registry: Optional[RuleRegistry] = None):
        self.registry = registry or rule_registry

    def diagnose_all(self, snapshot: TelemetrySnapshot) -> List[DiagnosisResult]:
        """
        Evaluates the telemetry snapshot against all registered rules and returns all triggered diagnoses.

        Returns:
            List of DiagnosisResult objects in order of rule priority.
        """
        results: List[DiagnosisResult] = []
        rules = self.registry.get_all_rules()

        for rule in rules:
            try:
                # If we encounter the catch-all fallback and other concrete rules have already fired, skip fallback
                if rule.category == DetectionCategory.UNKNOWN_INSUFFICIENT_EVIDENCE and results:
                    continue

                res = rule.evaluate(snapshot)
                if res is not None:
                    results.append(res)
            except Exception as exc:
                logger.error(
                    "Error executing rule '%s' (%s) on plant %d / inverter %s: %s",
                    rule.rule_id,
                    rule.name,
                    snapshot.plant_id,
                    snapshot.inverter_id,
                    exc,
                    exc_info=True,
                )

        # If no rule triggered, run the fallback rule
        if not results:
            fallback_rule = self.registry.get_rule("RULE_INSUFFICIENT_EVID_001")
            if fallback_rule:
                fallback_res = fallback_rule.evaluate(snapshot)
                if fallback_res:
                    results.append(fallback_res)

        return results

    def diagnose_primary(self, snapshot: TelemetrySnapshot) -> DiagnosisResult:
        """
        Evaluates the telemetry snapshot and returns the highest-priority, definitive diagnosis.

        Returns:
            DiagnosisResult representing the primary root cause.
        """
        all_results = self.diagnose_all(snapshot)
        if not all_results:
            fallback_rule = self.registry.get_rule("RULE_INSUFFICIENT_EVID_001")
            return fallback_rule.evaluate(snapshot)

        # Return the highest-priority triggered result
        return all_results[0]


# Global engine instance
fault_detection_engine = FaultDetectionEngine()
