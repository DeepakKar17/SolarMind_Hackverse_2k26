from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.health import check_db_readiness
from app.db.session import get_db

router = APIRouter(tags=["Health & Status"])


@router.get(
    "/health",
    summary="Health Liveness Check",
    response_model=Dict[str, Any],
)
async def health_check() -> Dict[str, Any]:
    """Returns basic process liveness status.

    Used by container orchestrators for liveness probes.
    """
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get(
    "/health/ready",
    summary="Health Readiness Check",
    response_model=Dict[str, Any],
)
@router.get(
    "/readiness",
    summary="Health Readiness Check Alias",
    response_model=Dict[str, Any],
)
@router.get(
    "/ready",
    summary="Health Readiness Check Alias",
    response_model=Dict[str, Any],
)
async def readiness_check(
    response: Response,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Returns system readiness including database connection check.

    Used by load balancers and orchestrators for traffic routing.
    """
    db_status = check_db_readiness(db)
    is_ready = db_status.get("healthy", False)

    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "ready" if is_ready else "unhealthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "components": {
            "database": db_status,
        },
    }
