"""Tests for application hardening, request tracking, error boundaries, and security."""

from unittest.mock import MagicMock, patch
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import pytest
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import mask_secret, sanitize_filename
from app.main import create_app


def test_request_id_generation_and_propagation(client: TestClient):
    """Verify X-Request-ID header is generated or preserved in responses."""
    # 1. Generated if not supplied
    resp1 = client.get("/health")
    assert resp1.status_code == 200
    assert "X-Request-ID" in resp1.headers
    assert resp1.headers["X-Request-ID"].startswith("req-")

    # 2. Preserved if supplied by client
    custom_id = "req-client-custom-999"
    resp2 = client.get("/health", headers={"X-Request-ID": custom_id})
    assert resp2.status_code == 200
    assert resp2.headers["X-Request-ID"] == custom_id


def test_centralized_validation_error_envelope(client: TestClient):
    """Verify invalid payloads return HTTP 422 with standardized error envelope and request_id."""
    # Send invalid plant creation payload (missing required name)
    resp = client.post(
        "/api/v1/plants",
        json={"location": "Jaipur", "installed_capacity_kwp": -50.0},
        headers={"X-Request-ID": "req-val-001"},
    )
    assert resp.status_code == 422
    data = resp.json()

    assert "error" in data
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert data["error"]["request_id"] == "req-val-001"
    assert "details" in data["error"]
    assert len(data["error"]["details"]["errors"]) > 0


def test_readiness_probe_database_unavailable():
    """Verify readiness check returns 503 and reports unhealthy when DB check fails."""
    app = create_app()

    # Mock DB failure
    with patch("app.main.check_db_readiness", return_value={"healthy": False, "error": "Connection refused"}):
        with TestClient(app) as test_client:
            resp = test_client.get("/ready")
            assert resp.status_code == 503
            data = resp.json()
            assert data["status"] == "unhealthy"
            assert data["components"]["database"]["healthy"] is False


def test_global_exception_handler_no_stacktrace_leakage(client: TestClient):
    """Verify unexpected server errors return clean 500 without stack trace leakage."""
    # Inject a temporary route raising an unhandled Python exception
    app = client.app

    @app.get("/api/v1/test-unhandled-crash")
    def crash_endpoint():
        raise RuntimeError("Sensitive internal database password leak attempt!")

    resp = client.get("/api/v1/test-unhandled-crash", headers={"X-Request-ID": "req-crash-777"})
    assert resp.status_code == 500
    data = resp.json()

    # Ensure no Python traceback is present in client response
    assert "Traceback" not in resp.text
    assert "Sensitive internal database password" not in resp.text
    assert data["error"]["code"] == "INTERNAL_SERVER_ERROR"
    assert data["error"]["request_id"] == "req-crash-777"


def test_request_payload_size_limiter(client: TestClient):
    """Verify request headers exceeding MAX_REQUEST_BODY_BYTES return 413 Payload Too Large."""
    # Send request with oversized Content-Length header
    oversized_bytes = 20 * 1024 * 1024  # 20 MB > 15 MB limit
    resp = client.post(
        "/api/v1/plants",
        headers={"Content-Length": str(oversized_bytes), "X-Request-ID": "req-oversized-01"},
    )
    assert resp.status_code == 413
    data = resp.json()
    assert data["error"]["code"] == "PAYLOAD_TOO_LARGE"
    assert data["error"]["request_id"] == "req-oversized-01"


def test_filename_sanitization():
    """Verify sanitize_filename neutralizes path traversal and illegal characters."""
    assert sanitize_filename("../../etc/passwd") == "passwd"
    assert sanitize_filename("..\\..\\windows\\system32\\config.sys") == "config.sys"
    assert sanitize_filename("safe_export_2026.csv") == "safe_export_2026.csv"
    assert sanitize_filename("bad\x00file.csv") == "badfile.csv"
    assert sanitize_filename(None) == "unnamed_file"


def test_secret_masking():
    """Verify mask_secret obscures credentials."""
    assert mask_secret("secretpassword123") == "se****23"
    assert mask_secret("123") == "****"
    assert mask_secret(None) is None


def test_docs_toggling_in_production():
    """Verify interactive documentation can be disabled in production."""
    with patch("app.main.settings.DOCS_ENABLED", False):
        app = create_app()
        assert app.openapi_url is None
        assert app.docs_url is None
        assert app.redoc_url is None
