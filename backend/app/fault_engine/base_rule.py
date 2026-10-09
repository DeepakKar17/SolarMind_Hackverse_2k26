"""
SolarMind Base Fault Detection Rule.

Abstract base class defining the contract for independently testable,
modular detection rules in the SolarMind fault detection engine.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import uuid

from app.fault_engine.schemas import (
    DetectionCategory,
    DiagnosisResult,
    DiagnosticEvidence,
    InspectionRecommendation,
    SeverityLevel,
    TelemetrySnapshot,
)


class BaseDetectionRule(ABC):
    """Abstract base class for all SolarMind fault detection rules."""

    @property
    @abstractmethod
    def rule_id(self) -> str:
        """Unique deterministic identifier for this rule (e.g. 'RULE_LOW_GEN_001')."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of the rule."""
        pass

    @property
    @abstractmethod
    def category(self) -> DetectionCategory:
        """Core detection category handled by this rule."""
        pass

    @property
    @abstractmethod
    def priority(self) -> int:
        """Execution priority (lower number = higher priority, e.g. Telemetry/Grid checks before derating)."""
        pass

    @abstractmethod
    def evaluate(self, snapshot: TelemetrySnapshot) -> Optional[DiagnosisResult]:
        """
        Evaluate the telemetry snapshot against this rule's heuristics and physics models.

        Returns:
            DiagnosisResult if a suspicious anomaly or fault is detected, otherwise None.
        """
        pass

    # -------------------------------------------------------------------------
    # Common Helper Methods for Rule Implementations
    # -------------------------------------------------------------------------

    def calculate_energy_and_financial_loss(
        self,
        snapshot: TelemetrySnapshot,
        duration_hours: float = 1.0,
    ) -> tuple[Optional[float], Optional[float]]:
        """
        Calculates energy deficit (kWh) and financial impact (INR) ONLY when
        a reliable expected baseline exists. Returns (None, None) if baseline is missing.
        """
        if snapshot.expected_power_kw is None or snapshot.ac_power_kw is None:
            return None, None

        actual = max(0.0, snapshot.ac_power_kw)
        expected = max(0.0, snapshot.expected_power_kw)

        if expected <= actual:
            return 0.0, 0.0

        deficit_kw = expected - actual
        energy_loss_kwh = round(deficit_kw * duration_hours, 2)
        tariff = snapshot.tariff_rate_inr if snapshot.tariff_rate_inr > 0 else 7.50
        financial_loss_inr = round(energy_loss_kwh * tariff, 2)

        return energy_loss_kwh, financial_loss_inr

    def generate_diagnosis_id(self, prefix: str = "DIAG") -> str:
        """Generates a unique diagnosis ID."""
        return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"
