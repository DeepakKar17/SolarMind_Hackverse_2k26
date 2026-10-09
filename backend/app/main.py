"""SolarMind FastAPI Main Application Module.

Hardened application factory with request tracking, liveness/readiness probes,
exception handling, and secure lifecycle management.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import Depends, FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import logger
from app.db.errors import register_database_exception_handlers
from app.db.health import check_db_readiness
from app.db.init_db import init_db, seed_development_data
from app.db.session import get_db, get_db_context
from app.middleware.request_tracking import RequestTrackingMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown routines."""
    safe_config = settings.get_safe_config()
    logger.info("Starting %s v%s [%s]", safe_config["PROJECT_NAME"], safe_config["VERSION"], safe_config["ENVIRONMENT"])
    logger.info("Allowed CORS Origins: %s", safe_config["ALLOWED_ORIGINS"])
    logger.info("Database Target: %s", safe_config["DATABASE_URL"])

    # Verify / initialize database tables non-destructively
    try:
        init_db()
        if settings.ENVIRONMENT == "development":
            with get_db_context() as db:
                seed_development_data(db)
    except Exception as exc:
        logger.error("Failed during database startup verification: %s", exc, exc_info=True)

    yield

    logger.info("Shutting down %s gracefully", settings.PROJECT_NAME)


def create_app() -> FastAPI:
    """Factory creating and configuring the hardened FastAPI instance."""
    # Determine if interactive documentation should be exposed
    docs_enabled = (
        settings.DOCS_ENABLED
        if settings.DOCS_ENABLED is not None
        else (settings.ENVIRONMENT != "production")
    )
    openapi_url = "/openapi.json" if docs_enabled else None
    docs_url = "/docs" if docs_enabled else None
    redoc_url = "/redoc" if docs_enabled else None

    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="AI-assisted solar monitoring and fault diagnosis platform for single-string household solar installations.",
        openapi_url=openapi_url,
        docs_url=docs_url,
        redoc_url=redoc_url,
        lifespan=lifespan,
    )

    # 1. Add Request Tracking & Payload Limit Middleware
    app.add_middleware(RequestTrackingMiddleware)

    # 2. Configure Explicit CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # 3. Root Level Health Endpoint (Liveness)
    @app.get("/health", tags=["Health & Status"], summary="Root Liveness Check")
    async def root_health() -> Dict[str, Any]:
        return {
            "status": "healthy",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # 4. Root Level Readiness Endpoint (Dependency Readiness Check)
    @app.get("/ready", tags=["Health & Status"], summary="Root Readiness Check")
    async def root_ready(
        response: Response,
        db: Session = Depends(get_db),
    ) -> Dict[str, Any]:
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

    # 5. Versioned API Router under /api/v1
    app.include_router(api_router, prefix=settings.API_V1_STR)

    # 6. Register Centralized Exception Handlers (Validation, HTTP, Database)
    register_database_exception_handlers(app)

    # 7. Global Fallback Exception Handler - Never expose Python stack traces to clients
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", "req-unknown") if hasattr(request, "state") else "req-unknown"
        logger.error("Unhandled Exception at %s %s [request_id=%s]: %s", request.method, request.url.path, request_id, str(exc), exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            headers={"X-Request-ID": request_id},
            content={
                "detail": "An unexpected server error occurred. Please contact support.",
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected server error occurred. Please contact support.",
                    "details": {},
                    "request_id": request_id,
                },
            },
        )

    return app


app = create_app()
