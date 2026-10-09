"""SolarMind Pydantic Schemas.

Clean request validation and response models for all API endpoints.
"""

from app.schemas.common import (
    DateRangeFilter,
    MessageResponse,
    PaginatedResponse,
    PaginationParams,
)
from app.schemas.plant import (
    PlantBase,
    PlantCreate,
    PlantResponse,
    PlantSummaryResponse,
    PlantUpdate,
)
from app.schemas.inverter import (
    InverterBase,
    InverterCreate,
    InverterResponse,
    InverterUpdate,
)
from app.schemas.pv_asset import (
    PVAssetBase,
    PVAssetCreate,
    PVAssetResponse,
    PVAssetUpdate,
)
from app.schemas.telemetry import (
    CSVImportRowError,
    CSVImportSummaryResponse,
    TelemetryBase,
    TelemetryBatchCreate,
    TelemetryCreate,
    TelemetryQueryFilter,
    TelemetryResponse,
)
from app.schemas.diagnosis import (
    DiagnosisAnalysisRequest,
    DiagnosisAnalysisResponse,
    DiagnosisBase,
    DiagnosisCreate,
    DiagnosisResponse,
    DiagnosisUpdate,
)
from app.schemas.why_low import (
    ExpectedPowerCalculation,
    SolarPositionInfo,
    WhyLowDiagnosticRequest,
    WhyLowDiagnosticResponse,
)
from app.schemas.weather import (
    CloudPerformanceAnalysisResponse,
    WeatherForecastHourResponse,
    WeatherForecastResponse,
    WeatherObservationResponse,
    WeatherRecordCreate,
    WeatherRecordResponse,
)
from app.schemas.outage import (
    OutageDetectionRequest,
    OutageDetectionResponse,
    OutageEventBase,
    OutageEventCreate,
    OutageEventResponse,
    OutageEventUpdate,
)
from app.schemas.photo_inspection import (
    PhotoInspectionBase,
    PhotoInspectionCreate,
    PhotoInspectionResponse,
    PhotoInspectionUpdate,
)
from app.schemas.work_order import (
    ChecklistItem,
    WorkOrderBase,
    WorkOrderCreate,
    WorkOrderInspectionSubmit,
    WorkOrderResponse,
    WorkOrderStatusHistoryResponse,
    WorkOrderUpdate,
    WorkOrderVerificationRequest,
    WorkOrderVerificationResponse,
)

from app.schemas.alert import (
    AlertAcknowledge,
    AlertBase,
    AlertCreate,
    AlertResponse,
    AlertUpdate,
)
from app.schemas.analytics import (
    AnalyticsDashboardResponse,
    AnalyticsSummaryResponse,
    AnalyticsTimeseriesPoint,
    DailyLossPoint,
    EnergyLossAnalyticsResponse,
    FaultCategorySummary,
    FaultDistributionResponse,
    FaultSeveritySummary,
    GenerationAnalyticsResponse,
    MaintenanceSlaMetrics,
)
from app.schemas.user import (
    UserBase,
    UserProfileUpdate,
    UserResponse,
    UserUpdate,
)
from app.schemas.auth import (
    AuthMessageResponse,
    AuthTokenResponse,
    ChangePasswordRequest,
    EmailVerificationRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    ResendVerificationRequest,
    UserLoginRequest,
    UserRegisterRequest,
)

__all__ = [
    # Common
    "PaginationParams",
    "PaginatedResponse",
    "DateRangeFilter",
    "MessageResponse",
    # User & Auth
    "UserBase",
    "UserResponse",
    "UserUpdate",
    "UserProfileUpdate",
    "UserRegisterRequest",
    "UserLoginRequest",
    "PasswordResetRequest",
    "PasswordResetConfirm",
    "EmailVerificationRequest",
    "ResendVerificationRequest",
    "ChangePasswordRequest",
    "AuthTokenResponse",
    "AuthMessageResponse",
    # Plant
    "PlantBase",
    "PlantCreate",
    "PlantUpdate",
    "PlantResponse",
    "PlantSummaryResponse",
    # Inverter
    "InverterBase",
    "InverterCreate",
    "InverterUpdate",
    "InverterResponse",
    # PVAsset
    "PVAssetBase",
    "PVAssetCreate",
    "PVAssetUpdate",
    "PVAssetResponse",
    # Telemetry
    "TelemetryBase",
    "TelemetryCreate",
    "TelemetryBatchCreate",
    "TelemetryResponse",
    "TelemetryQueryFilter",
    # Diagnosis
    "DiagnosisBase",
    "DiagnosisCreate",
    "DiagnosisUpdate",
    "DiagnosisResponse",
    # Why-Low & Expected Generation
    "ExpectedPowerCalculation",
    "SolarPositionInfo",
    "WhyLowDiagnosticRequest",
    "WhyLowDiagnosticResponse",
    # Weather
    "WeatherObservationResponse",
    "WeatherForecastHourResponse",
    "WeatherForecastResponse",
    "WeatherRecordCreate",
    "WeatherRecordResponse",
    "CloudPerformanceAnalysisResponse",
    # Outage
    "OutageEventBase",
    "OutageEventCreate",
    "OutageEventUpdate",
    "OutageEventResponse",
    "OutageDetectionRequest",
    "OutageDetectionResponse",
    # PhotoInspection
    "PhotoInspectionBase",
    "PhotoInspectionCreate",
    "PhotoInspectionUpdate",
    "PhotoInspectionResponse",
    # WorkOrder
    "WorkOrderBase",
    "WorkOrderCreate",
    "WorkOrderUpdate",
    "WorkOrderResponse",
    # Alert
    "AlertBase",
    "AlertCreate",
    "AlertAcknowledge",
    "AlertUpdate",
    "AlertResponse",
    # Analytics
    "AnalyticsTimeseriesPoint",
    "FaultCategorySummary",
    "MaintenanceSlaMetrics",
    "AnalyticsDashboardResponse",
]
