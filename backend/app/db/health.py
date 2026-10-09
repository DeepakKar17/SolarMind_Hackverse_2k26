"""Database health and readiness check utilities for SolarMind."""

import logging
import time
from typing import Any, Dict
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger("solarmind.db.health")


def check_db_readiness(session: Session) -> Dict[str, Any]:
    """Execute a lightweight probe query to verify database connectivity and responsiveness.

    Returns:
        Dict containing status, latency_ms, dialect, and driver information.
    """
    start_time = time.perf_counter()
    try:
        # Ping the database using a simple scalar query
        result = session.execute(text("SELECT 1")).scalar()
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

        if result != 1:
            logger.warning("Database readiness probe returned unexpected result: %s", result)
            return {
                "status": "degraded",
                "healthy": False,
                "latency_ms": latency_ms,
                "error": f"Unexpected probe result: {result}",
            }

        bind = session.get_bind()
        dialect_name = getattr(bind.dialect, "name", "unknown")
        driver_name = getattr(bind.dialect, "driver", "unknown")

        return {
            "status": "healthy",
            "healthy": True,
            "latency_ms": latency_ms,
            "dialect": dialect_name,
            "driver": driver_name,
        }

    except Exception as exc:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.error("Database readiness check failed: %s", exc, exc_info=True)
        return {
            "status": "unhealthy",
            "healthy": False,
            "latency_ms": latency_ms,
            "error": str(exc),
        }
