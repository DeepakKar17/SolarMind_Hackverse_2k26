# SolarMind Backend

FastAPI-powered asynchronous backend server for the SolarMind solar monitoring and fault diagnosis platform.

## Features
- Versioned REST endpoints (`/api/v1`) for telemetry ingestion, live monitoring, fault diagnosis, loss calculation, and image processing.
- Physics-informed yield calculations and statistical anomaly detection for single-string on-grid inverters.
- Modular Computer Vision interface powered by Pillow with pluggable classifier support.
- SQLite + SQLAlchemy 2.0 ORM persistence.

## Prerequisites
- Python 3.10+

## Local Installation & Setup

1. **Navigate to the backend folder:**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   ```bash
   python -m venv .venv
   # On Windows (PowerShell):
   .\.venv\Scripts\Activate.ps1
   # On Linux/macOS:
   source .venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Development Server:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

5. **Access Interactive API Docs:**
   - Swagger UI: `http://localhost:8000/docs`
   - ReDoc: `http://localhost:8000/redoc`

## Running Tests
```bash
pytest
```
