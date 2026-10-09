"""
SolarMind Photo Inspection & Geo Photo AI API Routes.

Provides endpoints for binary photo upload, image validation, metadata inspection,
processing status inquiry, computer vision analysis, and safe file streaming.
"""

from datetime import datetime, timezone
import io
import os
from typing import Any, Dict, Optional
from uuid import uuid4
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_optional_current_user, require_authenticated_user
from app.core.permissions import can_view_photo, is_admin
from app.db.errors import EntityNotFoundError
from app.db.session import get_db
from app.models.photo_inspection import PhotoInspection
from app.models.plant import Plant
from app.models.user import User
from app.repositories.photo_inspection import photo_inspection_repository
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.photo_inspection import (
    PhotoInspectionCreate,
    PhotoInspectionResponse,
    PhotoInspectionUpdate,
    PhotoProcessingStatusResponse,
    VisionAnalysisResult,
)
from app.services.audit_service import transactional_audit
from app.services.photo_storage_service import (
    FileSizeExceededError,
    InvalidImageFormatError,
    PhotoStorageError,
    SecurityPathTraversalError,
    photo_storage_service,
)
from app.services.vision_pipeline_service import vision_pipeline_service

router = APIRouter(prefix="/photos", tags=["Geo Photo AI"])


@router.get(
    "",
    response_model=PaginatedResponse[PhotoInspectionResponse],
    summary="List Photo Inspections",
    description="Retrieve paginated list of site inspection photos with plant/asset/defect filters.",
)
def list_photos(
    plant_id: Optional[int] = Query(default=None, description="Filter by plant ID"),
    inverter_id: Optional[str] = Query(default=None, description="Filter by inverter ID"),
    pv_asset_id: Optional[str] = Query(default=None, description="Filter by PV asset ID"),
    fault_detected: Optional[bool] = Query(default=None, description="Filter by anomaly detected flag"),
    processing_status: Optional[str] = Query(default=None, description="Filter by processing status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[PhotoInspectionResponse]:
    offset = (page - 1) * page_size
    stmt = select(PhotoInspection)
    count_stmt = select(func.count()).select_from(PhotoInspection)

    if plant_id:
        stmt = stmt.where(PhotoInspection.plant_id == plant_id)
        count_stmt = count_stmt.where(PhotoInspection.plant_id == plant_id)
    if inverter_id:
        stmt = stmt.where(PhotoInspection.inverter_id == inverter_id)
        count_stmt = count_stmt.where(PhotoInspection.inverter_id == inverter_id)
    if pv_asset_id:
        stmt = stmt.where(PhotoInspection.pv_asset_id == pv_asset_id)
        count_stmt = count_stmt.where(PhotoInspection.pv_asset_id == pv_asset_id)
    if fault_detected is not None:
        stmt = stmt.where(PhotoInspection.fault_detected == fault_detected)
        count_stmt = count_stmt.where(PhotoInspection.fault_detected == fault_detected)
    if processing_status is not None:
        stmt = stmt.where(PhotoInspection.processing_status == processing_status)
        count_stmt = count_stmt.where(PhotoInspection.processing_status == processing_status)

    stmt = stmt.order_by(PhotoInspection.uploaded_at.desc()).offset(offset).limit(page_size)
    photos = list(db.scalars(stmt).all())

    if current_user:
        photos = [p for p in photos if can_view_photo(current_user, p)]

    total = len(photos) if current_user and not is_admin(current_user) else (db.scalar(count_stmt) or 0)

    items = [PhotoInspectionResponse.model_validate(p) for p in photos]
    return PaginatedResponse.create(
        items=items,
        total=total,
        params=PaginationParams(page=page, page_size=page_size),
    )


@router.post(
    "/upload",
    response_model=PhotoInspectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register Photo Metadata Record",
    description="Register photo metadata via structured JSON payload.",
)
def register_photo(
    payload: PhotoInspectionCreate,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> PhotoInspectionResponse:
    plant = db.get(Plant, payload.plant_id)
    if not plant:
        raise EntityNotFoundError("Plant", payload.plant_id)

    with transactional_audit(
        db=db,
        actor=current_user,
        action="UPLOAD_PHOTO_INSPECTION",
        target_type="PhotoInspection",
        target_id=payload.id,
        details=f"Registered photo metadata {payload.original_filename} on plant #{payload.plant_id}",
    ):
        created = photo_inspection_repository.create(db, obj_in=payload)

    db.refresh(created)
    return PhotoInspectionResponse.model_validate(created)


@router.post(
    "/upload-file",
    response_model=PhotoInspectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Site Inspection Photo File (Multipart Binary)",
    description="Validates image MIME type, decoded pixel integrity, size bounds, and path traversal protection. Saves file to controlled storage and records metadata.",
)
async def upload_photo_file(
    file: UploadFile = File(..., description="Binary image file (JPEG, PNG, WebP)"),
    plant_id: int = Form(..., description="Associated plant ID"),
    inverter_id: Optional[str] = Form(default=None, description="Optional inverter ID"),
    pv_asset_id: Optional[str] = Form(default=None, description="Optional PV asset / string ID"),
    diagnosis_id: Optional[str] = Form(default=None, description="Optional linked diagnosis ID"),
    latitude: Optional[float] = Form(default=None, description="GPS Latitude in decimal degrees"),
    longitude: Optional[float] = Form(default=None, description="GPS Longitude in decimal degrees"),
    gps_accuracy_m: Optional[float] = Form(default=None, description="GPS accuracy in meters"),
    notes: Optional[str] = Form(default=None, description="Field inspection notes"),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> PhotoInspectionResponse:
    # 1. Verify plant exists
    plant = db.get(Plant, plant_id)
    if not plant:
        raise EntityNotFoundError("Plant", plant_id)

    # 2. Read bytes
    try:
        content = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file payload: {exc}",
        )

    # 3. Validate and persist to controlled storage
    try:
        rel_path, safe_orig_name, file_size, mime = photo_storage_service.validate_and_store_photo(
            file_bytes=content,
            original_filename=file.filename or "photo.jpg",
            content_type=file.content_type,
        )
    except SecurityPathTraversalError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except FileSizeExceededError as exc:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc))
    except InvalidImageFormatError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except PhotoStorageError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    # 4. Generate unique DB record
    photo_id = f"PHOTO-{uuid4().hex[:8].upper()}"
    create_schema = PhotoInspectionCreate(
        id=photo_id,
        plant_id=plant_id,
        inverter_id=inverter_id,
        pv_asset_id=pv_asset_id,
        diagnosis_id=diagnosis_id,
        image_path=rel_path,
        original_filename=safe_orig_name,
        file_size_bytes=file_size,
        mime_type=mime,
        uploaded_at=datetime.now(timezone.utc),
        latitude=latitude,
        longitude=longitude,
        gps_accuracy_m=gps_accuracy_m,
        notes=notes,
    )

    with transactional_audit(
        db=db,
        actor=current_user,
        action="UPLOAD_PHOTO_FILE",
        target_type="PhotoInspection",
        target_id=photo_id,
        details=f"Uploaded photo {safe_orig_name} ({file_size} bytes) for plant #{plant_id}",
    ):
        created = photo_inspection_repository.create(db, obj_in=create_schema)

    db.refresh(created)
    return PhotoInspectionResponse.model_validate(created)


@router.get(
    "/{photo_id}",
    response_model=PhotoInspectionResponse,
    summary="Get Photo Inspection Detail & Metadata",
)
def get_photo_detail(
    photo_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PhotoInspectionResponse:
    photo = photo_inspection_repository.get(db, photo_id)
    if not photo:
        raise EntityNotFoundError("PhotoInspection", photo_id)

    if current_user and not can_view_photo(current_user, photo):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: You are not authorized to view photo '{photo_id}'.",
        )

    return PhotoInspectionResponse.model_validate(photo)


@router.get(
    "/{photo_id}/status",
    response_model=PhotoProcessingStatusResponse,
    summary="Retrieve Photo Processing & Vision AI Status",
)
def get_photo_processing_status(
    photo_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PhotoProcessingStatusResponse:
    photo = photo_inspection_repository.get(db, photo_id)
    if not photo:
        raise EntityNotFoundError("PhotoInspection", photo_id)

    if current_user and not can_view_photo(current_user, photo):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    is_done = photo.processing_status in ["COMPLETED", "NOT_CONFIGURED", "FAILED"]
    msg_map = {
        "PENDING": "Photo uploaded and queued for vision pipeline processing.",
        "ANALYZING": "Computer vision defect inference in progress.",
        "COMPLETED": "Computer vision analysis completed successfully.",
        "NOT_CONFIGURED": "Vision model is not configured on this server. Automated inference was skipped.",
        "FAILED": "Computer vision inference encountered a processing error.",
    }

    return PhotoProcessingStatusResponse(
        photo_id=photo.id,
        processing_status=photo.processing_status,
        uploaded_at=photo.uploaded_at,
        is_analyzed=is_done,
        fault_detected=photo.fault_detected,
        confidence_score=photo.confidence_score,
        message=msg_map.get(photo.processing_status, "Status inquiry complete."),
    )


@router.post(
    "/{photo_id}/analyze",
    response_model=VisionAnalysisResult,
    summary="Request Computer Vision Defect Analysis",
    description="Runs pluggable vision pipeline on the stored photo. Returns NOT_CONFIGURED when no model weights are deployed without generating synthetic detections.",
)
def analyze_photo(
    photo_id: str,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> VisionAnalysisResult:
    photo = photo_inspection_repository.get(db, photo_id)
    if not photo:
        raise EntityNotFoundError("PhotoInspection", photo_id)

    if not can_view_photo(current_user, photo):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    # Read photo binary from safe storage
    try:
        data, mime = photo_storage_service.read_photo_bytes(photo.image_path)
    except FileNotFoundError:
        photo.processing_status = "FAILED"
        db.commit()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored photo file could not be found.")
    except Exception as exc:
        photo.processing_status = "FAILED"
        db.commit()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Storage read error: {exc}")

    # Execute Vision Pipeline
    try:
        result = vision_pipeline_service.analyze_photo_bytes(
            image_bytes=data,
            filename=photo.original_filename or "photo.jpg",
        )
    except Exception as exc:
        photo.processing_status = "FAILED"
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Vision analysis failed: {exc}")

    # Update database record
    photo.processing_status = result.status
    photo.analysis_result = result.model_dump(mode="json")
    if result.status == "COMPLETED":
        photo.fault_detected = len(result.detections) > 0
        photo.confidence_score = max([d.confidence for d in result.detections], default=0.90)
    elif result.status == "NOT_CONFIGURED":
        photo.fault_detected = None
        photo.confidence_score = None

    db.commit()
    db.refresh(photo)
    return result


@router.get(
    "/{photo_id}/results",
    response_model=VisionAnalysisResult,
    summary="Retrieve Vision AI Analysis Results",
)
def get_photo_analysis_results(
    photo_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> VisionAnalysisResult:
    photo = photo_inspection_repository.get(db, photo_id)
    if not photo:
        raise EntityNotFoundError("PhotoInspection", photo_id)

    if current_user and not can_view_photo(current_user, photo):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    if not photo.analysis_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vision analysis has been performed for this photo yet. Call POST /photos/{photo_id}/analyze first.",
        )

    return VisionAnalysisResult.model_validate(photo.analysis_result)


@router.get(
    "/{photo_id}/file",
    summary="Stream Inspection Photo Binary Content",
    description="Streams image content with proper MIME headers without exposing server absolute filesystem paths.",
)
def get_photo_file(
    photo_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> Response:
    photo = photo_inspection_repository.get(db, photo_id)
    if not photo:
        raise EntityNotFoundError("PhotoInspection", photo_id)

    if current_user and not can_view_photo(current_user, photo):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    try:
        data, mime = photo_storage_service.read_photo_bytes(photo.image_path)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored photo file not found.")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    return Response(
        content=data,
        media_type=mime,
        headers={"Content-Disposition": f'inline; filename="{photo.original_filename or "inspection.jpg"}"'},
    )
