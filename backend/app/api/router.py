"""SolarMind API Router Registry.

Aggregates and registers all versioned REST sub-routers under /api/v1.
"""

from fastapi import APIRouter
from app.api.routes import (
    admin,
    alerts,
    analytics,
    auth,
    diagnoses,
    health,
    home,
    inverters,
    jobs,
    outages,
    photos,
    plants,
    technician,
    telemetry,
    weather,
    work_orders,
)

api_router = APIRouter()

# Include versioned sub-routers under /api/v1
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(health.router)
api_router.include_router(home.router)
api_router.include_router(technician.router)
api_router.include_router(plants.router)
api_router.include_router(inverters.router)
api_router.include_router(telemetry.router)
api_router.include_router(analytics.router)
api_router.include_router(diagnoses.router)
api_router.include_router(work_orders.router)
api_router.include_router(alerts.router)
api_router.include_router(photos.router)
api_router.include_router(jobs.router)
api_router.include_router(weather.router)
api_router.include_router(outages.router)

