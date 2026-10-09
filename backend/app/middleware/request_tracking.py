"""Request Tracking Middleware for SolarMind.

Handles:
- Request ID extraction and generation (propagates X-Request-ID).
- Request body payload size validation.
- Structured access and error telemetry without leaking sensitive credentials.
"""

import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.logging import logger


class RequestTrackingMiddleware(BaseHTTPMiddleware):
    """Middleware attaching X-Request-ID and logging structured request telemetry."""

    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Request ID extraction or generation
        incoming_id = request.headers.get("X-Request-ID")
        request_id = incoming_id.strip() if incoming_id and incoming_id.strip() else f"req-{uuid.uuid4().hex[:12]}"
        request.state.request_id = request_id

        # 2. Request body size check
        content_length = request.headers.get("Content-Length")
        if content_length:
            try:
                length_bytes = int(content_length)
                if length_bytes > settings.MAX_REQUEST_BODY_BYTES:
                    logger.warning(
                        "Request payload too large (%d bytes > %d limit) for %s %s (request_id=%s)",
                        length_bytes,
                        settings.MAX_REQUEST_BODY_BYTES,
                        request.method,
                        request.url.path,
                        request_id,
                    )
                    return JSONResponse(
                        status_code=413,
                        content={
                            "error": {
                                "code": "PAYLOAD_TOO_LARGE",
                                "message": f"Request payload exceeds maximum allowable size of {settings.MAX_REQUEST_BODY_BYTES} bytes.",
                                "details": {
                                    "max_allowed_bytes": settings.MAX_REQUEST_BODY_BYTES,
                                    "received_bytes": length_bytes,
                                },
                                "request_id": request_id,
                            }
                        },
                        headers={"X-Request-ID": request_id},
                    )
            except ValueError:
                pass

        # 3. Execution & timing
        start_time = time.perf_counter()
        try:
            response: Response = await call_next(request)
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(
                "Unhandled error processing %s %s (%.2f ms) [request_id=%s]: %s",
                request.method,
                request.url.path,
                duration_ms,
                request_id,
                str(exc),
                exc_info=True,
            )
            return JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": "INTERNAL_SERVER_ERROR",
                        "message": "An unexpected internal server error occurred.",
                        "details": {},
                        "request_id": request_id,
                    }
                },
                headers={"X-Request-ID": request_id},
            )

        duration_ms = (time.perf_counter() - start_time) * 1000.0

        # 4. Attach request ID to response headers
        response.headers["X-Request-ID"] = request_id

        # 5. Structured logging (safe, no payload or password leakage)
        log_fn = logger.warning if response.status_code >= 400 else logger.info
        client_host = request.client.host if request.client else "unknown"
        log_fn(
            "%s %s -> %d (%.2f ms) [request_id=%s, client=%s]",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
            client_host,
        )

        return response
