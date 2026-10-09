"""SolarMind Repositories.

Database access abstractions for Plants, Inverters, PV Assets, Telemetry,
Diagnoses, Photo Inspections, Work Orders, Alerts, and Analytics.
"""

from app.repositories.base import BaseRepository
from app.repositories.plant import PlantRepository, plant_repository
from app.repositories.inverter import InverterRepository, inverter_repository
from app.repositories.pv_asset import PVAssetRepository, pv_asset_repository
from app.repositories.telemetry import TelemetryRepository, telemetry_repository
from app.repositories.diagnosis import DiagnosisRepository, diagnosis_repository
from app.repositories.photo_inspection import (
    PhotoInspectionRepository,
    photo_inspection_repository,
)
from app.repositories.work_order import WorkOrderRepository, work_order_repository
from app.repositories.alert import AlertRepository, alert_repository
from app.repositories.analytics import AnalyticsRepository, analytics_repository
from app.repositories.user import UserRepository, user_repository
from app.repositories.auth_session import AuthSessionRepository, auth_session_repository

__all__ = [
    "BaseRepository",
    "PlantRepository",
    "plant_repository",
    "InverterRepository",
    "inverter_repository",
    "PVAssetRepository",
    "pv_asset_repository",
    "TelemetryRepository",
    "telemetry_repository",
    "DiagnosisRepository",
    "diagnosis_repository",
    "PhotoInspectionRepository",
    "photo_inspection_repository",
    "WorkOrderRepository",
    "work_order_repository",
    "AlertRepository",
    "alert_repository",
    "AnalyticsRepository",
    "analytics_repository",
    "UserRepository",
    "user_repository",
    "AuthSessionRepository",
    "auth_session_repository",
]
