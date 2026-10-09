"""Tests for health and readiness endpoints with database status checks."""

from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_root_readiness_endpoint_healthy(client: TestClient):
    """Verifies that GET /ready returns 200 OK and components.database reporting healthy status."""
    response = client.get("/ready")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ready"
    assert data["service"] == "SolarMind Backend"
    assert "components" in data
    assert "database" in data["components"]
    assert data["components"]["database"]["healthy"] is True
    assert data["components"]["database"]["status"] == "healthy"
    assert "latency_ms" in data["components"]["database"]


def test_api_v1_readiness_endpoint_healthy(client: TestClient):
    """Verifies that GET /api/v1/health/ready returns 200 OK and components.database reporting healthy status."""
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ready"
    assert data["components"]["database"]["healthy"] is True


def test_readiness_endpoint_db_failure(client: TestClient):
    """Verifies that GET /ready and /api/v1/health/ready return 503 Service Unavailable when DB probe fails."""
    mock_unhealthy = {
        "status": "unhealthy",
        "healthy": False,
        "latency_ms": 15.2,
        "error": "Connection timeout",
    }

    with patch("app.api.routes.health.check_db_readiness", return_value=mock_unhealthy), \
         patch("app.main.check_db_readiness", return_value=mock_unhealthy):
        # Test API v1 readiness
        resp_v1 = client.get("/api/v1/health/ready")
        assert resp_v1.status_code == 503
        data_v1 = resp_v1.json()
        assert data_v1["status"] == "unhealthy"
        assert data_v1["components"]["database"]["healthy"] is False

        # Test root readiness
        resp_root = client.get("/ready")
        assert resp_root.status_code == 503
        data_root = resp_root.json()
        assert data_root["status"] == "unhealthy"
        assert data_root["components"]["database"]["healthy"] is False
