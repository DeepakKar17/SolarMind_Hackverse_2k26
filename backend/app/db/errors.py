"""Database and application error handling and exception mapping for SolarMind."""

import logging
from typing import Any, Dict
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError, IntegrityError, OperationalError, SQLAlchemyError

logger = logging.getLogger("solarmind.db.errors")


class DatabaseError(Exception):
    """Base application exception for database failures."""

    def __init__(self, message: str = "A database error occurred.", code: str = "DATABASE_ERROR", details: Dict[str, Any] | None = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}


class EntityNotFoundError(DatabaseError):
    """Raised when a requested database entity cannot be found."""

    def __init__(self, entity_name: str, identifier: Any):
        super().__init__(
            message=f"{entity_name} with identifier '{identifier}' was not found.",
            code="ENTITY_NOT_FOUND",
            details={"entity": entity_name, "identifier": str(identifier)},
        )


class EntityConflictError(DatabaseError):
    """Raised when an operation violates a unique constraint or duplicate record rule."""

    def __init__(self, message: str, details: Dict[str, Any] | None = None):
        super().__init__(message=message, code="ENTITY_CONFLICT", details=details)


def register_database_exception_handlers(app: FastAPI) -> None:
    """Register centralized exception handlers on the FastAPI application."""

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        from fastapi.encoders import jsonable_encoder
        request_id = getattr(request.state, "request_id", "req-unknown") if hasattr(request, "state") else "req-unknown"
        formatted_errors = []
        for err in exc.errors():
            loc = ".".join(str(p) for p in err.get("loc", []))
            formatted_errors.append({
                "field": loc,
                "message": err.get("msg", "Invalid value"),
                "type": err.get("type", "validation_error"),
            })
        logger.warning(
            "Request validation failed on %s %s: %s [request_id=%s]",
            request.method,
            request.url.path,
            formatted_errors,
            request_id,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": formatted_errors,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request payload validation failed.",
                    "details": {"errors": formatted_errors},
                    "request_id": request_id,
                },
            },
            headers={"X-Request-ID": request_id},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "req-unknown") if hasattr(request, "state") else "req-unknown"
        detail_msg = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        logger.warning(
            "HTTP %d on %s %s: %s [request_id=%s]",
            exc.status_code,
            request.method,
            request.url.path,
            detail_msg,
            request_id,
        )
        return JSONResponse(
            status_code=exc.status_code,
            headers={"X-Request-ID": request_id, **(exc.headers or {})},
            content={
                "detail": detail_msg,
                "error": {
                    "code": f"HTTP_{exc.status_code}",
                    "message": detail_msg,
                    "details": exc.detail if isinstance(exc.detail, dict) else {},
                    "request_id": request_id,
                },
            },
        )

    @app.exception_handler(EntityNotFoundError)
    async def entity_not_found_handler(request: Request, exc: EntityNotFoundError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "req-unknown") if hasattr(request, "state") else "req-unknown"
        logger.warning("Entity not found on %s %s: %s [request_id=%s]", request.method, request.url.path, exc.message, request_id)
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            headers={"X-Request-ID": request_id},
            content={
                "detail": exc.message,
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                    "request_id": request_id,
                },
            },
        )

    @app.exception_handler(EntityConflictError)
    async def entity_conflict_handler(request: Request, exc: EntityConflictError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "req-unknown") if hasattr(request, "state") else "req-unknown"
        logger.warning("Entity conflict on %s %s: %s [request_id=%s]", request.method, request.url.path, exc.message, request_id)
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            headers={"X-Request-ID": request_id},
            content={
                "detail": exc.message,
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                    "request_id": request_id,
                },
            },
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "req-unknown") if hasattr(request, "state") else "req-unknown"
        logger.error("Database integrity error on %s %s: %s [request_id=%s]", request.method, request.url.path, str(exc.orig), request_id)
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            headers={"X-Request-ID": request_id},
            content={
                "detail": "The requested operation violates a database uniqueness or relational constraint.",
                "error": {
                    "code": "DATABASE_INTEGRITY_VIOLATION",
                    "message": "The requested operation violates database integrity constraints (e.g. unique constraint or foreign key).",
                    "details": {},
                    "request_id": request_id,
                },
            },
        )

    @app.exception_handler(OperationalError)
    async def operational_error_handler(request: Request, exc: OperationalError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "req-unknown") if hasattr(request, "state") else "req-unknown"
        logger.error("Database operational error on %s %s: %s [request_id=%s]", request.method, request.url.path, str(exc), request_id)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            headers={"X-Request-ID": request_id},
            content={
                "detail": "Database connection or operational error. Please retry shortly.",
                "error": {
                    "code": "DATABASE_UNAVAILABLE",
                    "message": "Database connection or operational error. Please retry shortly.",
                    "details": {},
                    "request_id": request_id,
                },
            },
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_generic_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "req-unknown") if hasattr(request, "state") else "req-unknown"
        logger.error("Database error on %s %s: %s [request_id=%s]", request.method, request.url.path, str(exc), request_id)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            headers={"X-Request-ID": request_id},
            content={
                "detail": "An internal database error occurred.",
                "error": {
                    "code": "DATABASE_INTERNAL_ERROR",
                    "message": "An unexpected database error occurred during request processing.",
                    "details": {},
                    "request_id": request_id,
                },
            },
        )
