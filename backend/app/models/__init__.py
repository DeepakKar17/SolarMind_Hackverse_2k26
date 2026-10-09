"""SolarMind ORM Models Export.

Complete entity schema models for solar plants, multi-tenant user assignments,
string inverters, PV assets, telemetry timeseries, fault diagnoses, diagnosis evidence,
fault catalog entries, rule versions, weather readings, outage events, photo inspections,
work orders, status history, alerts, integration connectors, sync runs, audit events,
and application settings.
"""

from app.db.base import Base, TimestampMixin, utc_now
from app.models.user import User
from app.models.auth_session import AuthSession
from app.models.plant import Plant
from app.models.plant_user_assignment import PlantUserAssignment
from app.models.inverter import Inverter
from app.models.pv_asset import PVAsset
from app.models.telemetry import Telemetry, TelemetryRecord
from app.models.diagnosis import Diagnosis
from app.models.diagnosis_evidence import DiagnosisEvidence
from app.models.fault_catalog_entry import FaultCatalogEntry
from app.models.fault_rule import FaultRule
from app.models.diagnosis_rule_version import DiagnosisRuleVersion
from app.models.weather_record import WeatherRecord
from app.models.outage_event import OutageEvent
from app.models.photo_inspection import PhotoInspection
from app.models.work_order import WorkOrder
from app.models.work_order_status_history import WorkOrderStatusHistory
from app.models.alert import Alert
from app.models.integration_config import IntegrationConfig
from app.models.integration_sync_run import IntegrationSyncRun
from app.models.audit_event import AuditEvent
from app.models.application_setting import ApplicationSetting

__all__ = [
    "Base",
    "TimestampMixin",
    "utc_now",
    "User",
    "AuthSession",
    "Plant",
    "PlantUserAssignment",
    "Inverter",
    "PVAsset",
    "Telemetry",
    "TelemetryRecord",
    "Diagnosis",
    "DiagnosisEvidence",
    "FaultCatalogEntry",
    "FaultRule",
    "DiagnosisRuleVersion",
    "WeatherRecord",
    "OutageEvent",
    "PhotoInspection",
    "WorkOrder",
    "WorkOrderStatusHistory",
    "Alert",
    "IntegrationConfig",
    "IntegrationSyncRun",
    "AuditEvent",
    "ApplicationSetting",
]
