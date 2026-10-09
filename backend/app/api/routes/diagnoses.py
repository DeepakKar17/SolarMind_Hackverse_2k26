"""API endpoints for Fault Diagnosis and AI anomaly detection."""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_optional_current_user
from app.core.permissions import (
    can_view_diagnosis,
    enforce_diagnosis_access,
    enforce_plant_access,
    is_admin,
)
from app.db.errors import EntityNotFoundError
from app.db.session import get_db
from app.models.plant import Plant
from app.models.user import User
from app.repositories.diagnosis import diagnosis_repository
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.diagnosis import (
    DiagnosisAnalysisRequest,
    DiagnosisAnalysisResponse,
    DiagnosisResponse,
    DiagnosisUpdate,
)
from app.schemas.why_low import (
    WhyLowDiagnosticRequest,
    WhyLowDiagnosticResponse,
)
from app.schemas.energy_loss import (
    EnergyLossEstimationRequest,
    EnergyLossEstimationResponse,
)
from app.services.diagnosis_service import diagnosis_service
from app.services.energy_loss_service import energy_loss_service
from app.services.fault_knowledge_service import FaultCodeLookupResult, fault_knowledge_service
from app.services.why_low_service import why_low_service


router = APIRouter(prefix="/diagnoses", tags=["Fault Diagnosis"])


def normalize_datetime(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure naive UTC datetimes for consistent DB comparison."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


@router.get(
    "",
    response_model=PaginatedResponse[DiagnosisResponse],
    summary="List Diagnoses",
    description="Retrieve paginated list of fault diagnoses with filtering by plant, inverter, severity, category, and date range.",
)
def list_diagnoses(
    plant_id: Optional[int] = Query(default=None, description="Filter by plant ID"),
    inverter_id: Optional[str] = Query(default=None, description="Filter by inverter ID"),
    pv_asset_id: Optional[str] = Query(default=None, description="Filter by PV asset / string ID"),
    fault_class: Optional[str] = Query(default=None, description="Filter by fault class (e.g. 'STRING_DISCONNECTION')"),
    severity: Optional[str] = Query(default=None, description="Filter by severity ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')"),
    status: Optional[str] = Query(default=None, description="Filter by status ('ACTIVE', 'CONFIRMED', 'RESOLVED', etc.)"),
    search: Optional[str] = Query(default=None, description="Search term in title, cause, or summary"),
    start_time: Optional[datetime] = Query(default=None, description="Detection start time in UTC"),
    end_time: Optional[datetime] = Query(default=None, description="Detection end time in UTC"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[DiagnosisResponse]:
    start = normalize_datetime(start_time)
    end = normalize_datetime(end_time)

    if start and end and start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_time must be less than or equal to end_time.",
        )

    offset = (page - 1) * page_size
    items = diagnosis_repository.list_with_filters(
        db,
        plant_id=plant_id,
        inverter_id=inverter_id,
        pv_asset_id=pv_asset_id,
        fault_class=fault_class,
        severity=severity,
        status=status,
        search=search,
        start_time=start,
        end_time=end,
        offset=offset,
        limit=page_size,
    )

    if current_user:
        items = [d for d in items if can_view_diagnosis(current_user, d)]

    total = len(items) if current_user and not is_admin(current_user) else diagnosis_repository.count_with_filters(
        db,
        plant_id=plant_id,
        inverter_id=inverter_id,
        pv_asset_id=pv_asset_id,
        fault_class=fault_class,
        severity=severity,
        status=status,
        search=search,
        start_time=start,
        end_time=end,
    )

    response_items = [DiagnosisResponse.model_validate(item) for item in items]
    return PaginatedResponse.create(
        items=response_items,
        total=total,
        params=PaginationParams(page=page, page_size=page_size),
    )


@router.get(
    "/{diagnosis_id}",
    response_model=DiagnosisResponse,
    summary="Get Diagnosis by ID",
    description="Retrieve full details for a specific fault diagnosis.",
)
def get_diagnosis(
    diagnosis_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> DiagnosisResponse:
    diagnosis = diagnosis_repository.get_with_details(db, diagnosis_id)
    if not diagnosis:
        raise EntityNotFoundError("Diagnosis", diagnosis_id)

    if current_user:
        enforce_diagnosis_access(current_user, diagnosis)

    return DiagnosisResponse.model_validate(diagnosis)


@router.post(
    "/analyze",
    response_model=DiagnosisAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Run AI Fault Diagnosis",
    description="Execute deterministic and machine learning diagnostic inference algorithms over recent inverter telemetry.",
)
def analyze_telemetry(
    request: DiagnosisAnalysisRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> DiagnosisAnalysisResponse:
    if current_user and request.plant_id:
        plant = db.get(Plant, request.plant_id)
        if plant:
            enforce_plant_access(current_user, plant)

    return diagnosis_service.analyze_plant_telemetry(db, request)


@router.post(
    "/why-low",
    response_model=WhyLowDiagnosticResponse,
    status_code=status.HTTP_200_OK,
    summary="Why-Low Generation Diagnostic Pipeline",
    description="Execute the strict 10-step Why-Low evaluation workflow to diagnose yield gaps and verify physical evidence.",
)
def diagnose_why_low(
    request: WhyLowDiagnosticRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> WhyLowDiagnosticResponse:
    if current_user and request.plant_id:
        plant = db.get(Plant, request.plant_id)
        if plant:
            enforce_plant_access(current_user, plant)

    return why_low_service.diagnose_why_low(db, request)



@router.get(
    "/fault-code/lookup",
    response_model=FaultCodeLookupResult,
    summary="Lookup Inverter Fault Code by Manufacturer & Model",
    description="Retrieve verified manufacturer-specific fault code definition, official troubleshooting steps, electrical hazard warnings, and SolarMind diagnostic interpretation. Returns explicit unresolved status for unknown codes.",
)
def lookup_fault_code_knowledge(
    manufacturer: str = Query(..., description="Inverter OEM manufacturer (e.g. 'Deye', 'SMA', 'Fronius')"),
    code: str = Query(..., description="Inverter fault or alarm code (e.g. 'F01', 'F24', '102')"),
    model: Optional[str] = Query(default=None, description="Optional inverter model string (e.g. 'SUN-80K-G03')"),
) -> FaultCodeLookupResult:
    return fault_knowledge_service.lookup(manufacturer=manufacturer, code=code, model=model)


@router.get(
    "/fault-code/manufacturers",
    response_model=list[str],
    summary="List Supported Inverter Manufacturers in Fault Knowledge Base",
)
def list_supported_fault_code_manufacturers() -> list[str]:
    return fault_knowledge_service.list_supported_manufacturers()


@router.get(
    "/fault-code/catalog",
    summary="List Knowledge Base Fault Code Entries",
)
def list_fault_code_catalog(
    manufacturer: Optional[str] = Query(default=None, description="Filter catalog by manufacturer"),
) -> list[dict]:
    return fault_knowledge_service.list_catalog_entries(manufacturer=manufacturer)


@router.post(
    "/energy-loss/estimate",
    response_model=EnergyLossEstimationResponse,
    summary="Estimate Energy Shortfall, Financial Impact & Prioritized Recommendations",
    description="Calculates energy shortfall against healthy baseline, evaluates financial impact with valid tariff, partitions multi-cause attribution, and computes priority score.",
)
def estimate_energy_loss_and_recommendations(
    request: EnergyLossEstimationRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> EnergyLossEstimationResponse:
    if current_user:
        plant = db.get(Plant, request.plant_id)
        if plant:
            enforce_plant_access(current_user, plant)

    return energy_loss_service.estimate_energy_loss(request)


@router.patch(
    "/{diagnosis_id}",
    response_model=DiagnosisResponse,
    summary="Update Diagnosis Status & Notes",
    description="Update diagnosis severity, status lifecycle, root cause summary, or resolution timestamps.",
)
def update_diagnosis(
    diagnosis_id: str,
    update_in: DiagnosisUpdate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> DiagnosisResponse:
    diagnosis = diagnosis_repository.get_with_details(db, diagnosis_id)
    if not diagnosis:
        raise EntityNotFoundError("Diagnosis", diagnosis_id)

    if current_user:
        enforce_diagnosis_access(current_user, diagnosis)

    updated = diagnosis_service.update_diagnosis(db, diagnosis_id, update_in)
    return DiagnosisResponse.model_validate(updated)
