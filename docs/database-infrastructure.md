# SolarMind Database Infrastructure & Architecture Guide

## 1. Overview & Architecture

SolarMind uses **SQLAlchemy 2.x** with a modular declarative ORM layer, robust session lifecycle management, request-scoped FastAPI dependencies, and **Alembic** schema migrations.

The initial development prototype uses **SQLite** with Write-Ahead Logging (`WAL`) mode, foreign key enforcement, and local persistence in `backend/data/solarmind.db`. The database abstraction layer is completely database-agnostic, allowing seamless migration to **PostgreSQL** in production with zero business logic changes.

```
┌─────────────────────────────────────────────────────────────┐
│                      FastAPI Request Layer                  │
│   (Route Handlers, APIRouter, Root Liveness / Readiness)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Depends(get_db)
┌──────────────────────────────▼──────────────────────────────┐
│                  Session Lifecycle & Scoping                │
│       • Generator-based request cleanup (get_db)            │
│       • Context manager for background jobs (get_db_context)│
│       • Atomic transaction rollbacks on failure             │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                 Declarative Base & Models                   │
│   • Base (DeclarativeBase) + TimestampMixin (UTC)           │
│   • Plant, Inverter, Telemetry, Diagnosis, Alert, WorkOrder │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Engine & Connection Pool                 │
│   • SQLite (Development / Testing) with WAL & FK Pragma     │
│   • PostgreSQL (Production) via psycopg / asyncpg           │
│   • Alembic Migration Manager (alembic.ini + versions/)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Configuration & Engine Initialization

All database settings are read through Pydantic Settings (`app.core.config.settings`).

### Environment Variables (`backend/.env`):
```bash
# SQLite (Development Default)
DATABASE_URL=sqlite:///./data/solarmind.db

# PostgreSQL (Production Example)
# DATABASE_URL=postgresql+psycopg://solarmind_user:secure_password@localhost:5432/solarmind_prod

DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20
DATABASE_POOL_TIMEOUT=30
DATABASE_POOL_RECYCLE=1800
DATABASE_ECHO=False
```

### Engine Features:
- **Automatic Directory Creation:** SQLite directory path (`data/`) is verified and created on startup if missing.
- **SQLite Engine Pragma:** Injects `PRAGMA foreign_keys=ON`, `PRAGMA journal_mode=WAL`, and `PRAGMA busy_timeout=5000` via SQLAlchemy `connect` event listener to ensure relational integrity and high concurrency.
- **Connection Pooling:** In-memory testing uses `StaticPool`; PostgreSQL/production uses `QueuePool` with configurable pool sizing and `pool_pre_ping=True` to eliminate stale connections.

---

## 3. Session Lifecycle Management

### 3.1 Request-Scoped Dependency (`get_db`)
Every API route requesting database access receives a fresh `Session` that is automatically committed or closed in a `finally` block when the request finishes:

```python
from fastapi import Depends
from sqlalchemy.orm import Session
from app.db.session import get_db

@router.get("/plants")
def list_plants(db: Session = Depends(get_db)):
    # db session is active and properly scoped
    return plant_repository.get_all(db)
    # Session is cleanly closed automatically after response returns
```

### 3.2 Background / Service Context Manager (`get_db_context`)
For background tasks, CLI commands, scripts, or worker processes, use the context manager:

```python
from app.db.session import get_db_context
from app.models import Plant

with get_db_context() as session:
    plant = session.get(Plant, 1)
    plant.status = "WARNING"
    session.commit()
# Session is automatically closed, and any uncaught exception automatically triggers session.rollback()
```

---

## 4. Domain Models & Indexing Strategy

All models inherit from `app.db.base.Base` and `TimestampMixin` (which provides `created_at` and `updated_at` stored with UTC timezone).

| Model | Table | Primary Key | Key Relationships | Critical Indexes |
|---|---|---|---|---|
| `Plant` | `plants` | `id` (Integer PK) | Inverters, Diagnoses, Alerts, WorkOrders | `name`, `status`, `(status, is_active)` |
| `Inverter` | `inverters` | `id` (String PK) | Parent `Plant`, Telemetry, Diagnoses, Alerts | `plant_id`, `serial_number` (UNIQUE), `status`, `(plant_id, status)` |
| `Telemetry` | `telemetries` | `id` (Integer PK) | Parent `Inverter` | `inverter_id`, `timestamp`, `(inverter_id, timestamp)` |
| `Diagnosis` | `diagnoses` | `id` (String PK) | `Plant`, `Inverter`, `Alerts`, `WorkOrders` | `plant_id`, `inverter_id`, `fault_class`, `severity`, `status`, `(plant_id, status)`, `(fault_class, severity)` |
| `Alert` | `alerts` | `id` (String PK) | `Plant`, `Inverter`, `Diagnosis` | `plant_id`, `inverter_id`, `code`, `severity`, `status`, `acknowledged`, `(plant_id, status, acknowledged)` |
| `WorkOrder` | `work_orders` | `id` (String PK) | `Plant`, `Diagnosis` | `plant_id`, `diagnosis_id`, `priority`, `status`, `(plant_id, status)` |

### Cascade Rules:
- Deleting a `Plant` cascades (`CASCADE`) and deletes its associated inverters, telemetries, diagnoses, alerts, and work orders.
- Deleting an `Inverter` cascades to its telemetry timeseries data and related direct records.
- Deleting a `Diagnosis` sets `diagnosis_id` to `NULL` on related `Alert` and `WorkOrder` records (`ondelete="SET NULL"`), preserving work history and ticket records.

---

## 5. Database Health & Readiness Checks

SolarMind exposes standard health and readiness endpoints for container orchestrators (e.g. Kubernetes, Docker Compose, AWS ECS):

- **Liveness (`GET /health` and `GET /api/v1/health`):** Quick process ping (returns `200 OK`).
- **Readiness (`GET /ready` and `GET /api/v1/health/ready`):** Executes `SELECT 1` against the database, records latency in milliseconds, reports dialect and driver, and returns:
  - `200 OK` when the database connection is healthy.
  - `503 Service Unavailable` when the database connection fails or times out.

### Response Payload:
```json
{
  "status": "ready",
  "service": "SolarMind Backend",
  "version": "0.1.0",
  "environment": "development",
  "timestamp": "2026-10-09T10:30:00.000000+00:00",
  "components": {
    "database": {
      "status": "healthy",
      "healthy": true,
      "latency_ms": 1.25,
      "dialect": "sqlite",
      "driver": "pysqlite"
    }
  }
}
```

---

## 6. Error Handling & Mapping

Database exceptions are mapped to standard API error responses:

| Database Exception | Application Error Code | HTTP Status | Description |
|---|---|---|---|
| `EntityNotFoundError` | `ENTITY_NOT_FOUND` | 404 | Entity ID not found in database |
| `EntityConflictError` | `ENTITY_CONFLICT` | 409 | Duplicate entity or business conflict |
| `IntegrityError` | `DATABASE_INTEGRITY_VIOLATION` | 409 | Foreign key or unique constraint violation |
| `OperationalError` | `DATABASE_UNAVAILABLE` | 503 | Connection drops, lock timeouts, or network loss |
| `SQLAlchemyError` | `DATABASE_INTERNAL_ERROR` | 500 | Unhandled database internal error |

---

## 7. Alembic Migration Workflow

### 7.1 Running Migrations
To upgrade the database to the latest schema revision:
```bash
cd backend
.\.venv\Scripts\alembic upgrade head
```

### 7.2 Generating a New Migration
When modifying or adding ORM models in `app/models/`:
```bash
cd backend
.\.venv\Scripts\alembic revision --autogenerate -m "add_new_field_to_inverter"
```

### 7.3 Checking Migration Status
```bash
cd backend
.\.venv\Scripts\alembic current
.\.venv\Scripts\alembic history --verbose
```

### 7.4 Stamping Existing Databases
If an existing database already has the schema created:
```bash
.\.venv\Scripts\alembic stamp head
```

---

## 8. Migrating to PostgreSQL in Production

SolarMind is designed from day one to support PostgreSQL without rewriting any business logic or ORM models.

### Step 1: Install PostgreSQL Driver
Add `psycopg` to `requirements.txt`:
```
psycopg[binary]>=3.1.0
```

### Step 2: Update `.env` Configuration
Change `DATABASE_URL` in your production environment:
```ini
DATABASE_URL=postgresql+psycopg://username:password@pg-host:5432/solarmind_prod
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10
DATABASE_POOL_TIMEOUT=30
DATABASE_POOL_RECYCLE=1800
```

### Step 3: Run Alembic Migrations
```bash
alembic upgrade head
```

### Why Zero Business Logic Changes Are Needed:
1. **Standard Column Types:** All models use standard ANSI types (`String`, `Integer`, `Float`, `Text`, `Boolean`, `DateTime(timezone=True)`) which SQLAlchemy maps natively to PostgreSQL (`VARCHAR`, `INTEGER`, `DOUBLE PRECISION`, `TEXT`, `BOOLEAN`, `TIMESTAMPTZ`).
2. **Standard Transactions:** Session management, commits, and rollbacks use standard SQLAlchemy 2.0 ORM sessions.
3. **Foreign Keys & Cascades:** Cascades (`CASCADE`, `SET NULL`) are defined in standard DDL, natively enforced by PostgreSQL.
4. **Dialect Detection:** The database engine, readiness probe, and Alembic dynamically detect the underlying database dialect at runtime.
