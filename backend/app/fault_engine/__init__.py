"""
SolarMind Modular & Explainable Fault Detection Engine.

Public package exports for schemas, rules, registry, and engine.
"""

from app.fault_engine.base_rule import BaseDetectionRule
from app.fault_engine.engine import FaultDetectionEngine, fault_detection_engine
from app.fault_engine.manufacturer_catalog import MANUFACTURER_CATALOGS, lookup_fault_code
from app.fault_engine.registry import RuleRegistry, rule_registry
from app.fault_engine.schemas import (
    DetectionCategory,
    DiagnosisResult,
    DiagnosticEvidence,
    InspectionRecommendation,
    SeverityLevel,
    TelemetrySnapshot,
)

__all__ = [
    "DetectionCategory",
    "SeverityLevel",
    "DiagnosticEvidence",
    "InspectionRecommendation",
    "TelemetrySnapshot",
    "DiagnosisResult",
    "BaseDetectionRule",
    "RuleRegistry",
    "rule_registry",
    "FaultDetectionEngine",
    "fault_detection_engine",
    "lookup_fault_code",
    "MANUFACTURER_CATALOGS",
]
