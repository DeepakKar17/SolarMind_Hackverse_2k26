from fastapi.testclient import TestClient


def test_root_health_endpoint(client: TestClient):
    """Verifies that GET /health returns 200 OK and expected system metadata."""
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "SolarMind Backend"
    assert "version" in data
    assert "environment" in data
    assert "timestamp" in data


def test_api_v1_health_endpoint(client: TestClient):
    """Verifies that GET /api/v1/health returns 200 OK and expected system metadata."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "SolarMind Backend"
    assert "version" in data
    assert "environment" in data
    assert "timestamp" in data


def test_openapi_json_available(client: TestClient):
    """Verifies that OpenAPI documentation JSON schema is accessible."""
    response = client.get("/openapi.json")
    assert response.status_code == 200

    schema = response.json()
    assert "openapi" in schema
    assert schema["info"]["title"] == "SolarMind Backend"


def test_cors_headers_for_allowed_origin(client: TestClient):
    """Verifies that allowed frontend origin receives appropriate CORS headers."""
    response = client.get(
        "/api/v1/health",
        headers={"Origin": "http://localhost:5173"}
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_headers_rejected_for_unauthorized_origin(client: TestClient):
    """Verifies that unauthorized origin does NOT receive access-control-allow-origin header."""
    response = client.get(
        "/api/v1/health",
        headers={"Origin": "http://malicious-site.com"}
    )
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
