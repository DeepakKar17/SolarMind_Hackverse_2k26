"""
SolarMind Background Job Processing API Routes.

Provides endpoints for job status tracking, listing, and retry operations.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_optional_current_user, require_authenticated_user
from app.models.user import User
from app.schemas.job import JobResponse, JobStatus
from app.services.job_processing_service import job_processing_service

router = APIRouter(prefix="/jobs", tags=["Background Jobs"])


@router.get(
    "/{job_id}",
    response_model=JobResponse,
    summary="Get Background Job Status",
    description="Retrieve processing status, progress, timestamps, and execution output for a background job.",
)
def get_job_status(
    job_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> JobResponse:
    job = job_processing_service.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' was not found.",
        )
    return job


@router.post(
    "/{job_id}/retry",
    response_model=JobResponse,
    summary="Retry Failed Background Job",
    description="Retries a failed background task if retry limit is not exceeded.",
)
def retry_failed_job(
    job_id: str,
    current_user: User = Depends(require_authenticated_user),
) -> JobResponse:
    try:
        return job_processing_service.retry_job(job_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.get(
    "",
    response_model=List[JobResponse],
    summary="List Tracked Background Jobs",
)
def list_jobs(
    resource_id: Optional[str] = Query(default=None, description="Filter by resource ID"),
    job_type: Optional[str] = Query(default=None, description="Filter by job type"),
    status: Optional[JobStatus] = Query(default=None, description="Filter by job status"),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> List[JobResponse]:
    return job_processing_service.list_jobs(
        resource_id=resource_id,
        job_type=job_type,
        status=status,
    )
