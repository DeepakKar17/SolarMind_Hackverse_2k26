"""
Unit and integration tests for SolarMind Energy Loss Estimation & Recommendation Service.

Validates:
- Known multi-hour energy shortfall with valid tariff (separation of observed vs expected)
- Missing / zero tariff handling (strictly no financial deficit calculation)
- Single reading / incomplete data handling (Rule 1: never infer exact energy loss from single point)
- Overlapping intervals deduplication (Rule 6: interval union without double-counting)
- Multi-cause attribution partitioning (Rule 3: no 100% single-cause assumption when multiple overlap)
- Evidence-grounded priority ranking formula (S + I + D + E composite score)
- REST API endpoint POST /api/v1/diagnoses/energy-loss/estimate
"""

from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.energy_loss import (
    BaselineMethod,
    EnergyLossEstimationRequest,
    InspectionPriorityLevel,
    LossCertainty,
    TelemetryIntervalPoint,
)
from app.services.energy_loss_service import energy_loss_service


@pytest.fixture
def client():
    return TestClient(app)


# -----------------------------------------------------------------------------
# 1. Known Example: Multi-Hour Verified Shortfall with Tariff
# -----------------------------------------------------------------------------

def test_known_multi_hour_shortfall_with_tariff():
    """Calculates multi-hour energy shortfall and financial loss with verified tariff."""
    start = datetime(2026, 10, 9, 10, 0, 0, tzinfo=timezone.utc)
    end = datetime(2026, 10, 9, 14, 0, 0, tzinfo=timezone.utc)

    # 4 hours of 15-minute readings: Expected ~40 kW, Actual ~10 kW (e.g. 2 strings disconnected)
    readings = []
    curr = start
    while curr <= end:
        readings.append(
            TelemetryIntervalPoint(
                timestamp=curr,
                actual_power_kw=10.0,
                expected_power_kw=40.0,
                poa_irradiance_wm2=800.0,
                ambient_temp_c=32.0,
                inverter_status="RUNNING_DEGRADED",
            )
        )
        curr += timedelta(minutes=15)

    request = EnergyLossEstimationRequest(
        plant_id=1,
        inverter_id="INV-01",
        installed_capacity_kwp=50.0,
        start_time=start,
        end_time=end,
        readings=readings,
        tariff_rate_inr=7.50,
        fault_codes=["F18"],
        baseline_method=BaselineMethod.PHYSICS_POA_IRRADIANCE,
    )

    response = energy_loss_service.estimate_energy_loss(request)

    assert response.duration_hours == 4.0
    # Expected: 40 kW * 4 h = 160 kWh
    # Observed: 10 kW * 4 h = 40 kWh
    # Shortfall: 120 kWh
    assert abs(response.expected_generation_kwh - 160.0) < 1.0
    assert abs(response.observed_generation_kwh - 40.0) < 1.0
    assert abs(response.estimated_shortfall_kwh - 120.0) < 1.0

    # Confirmed vs Potential
    assert response.confirmed_loss_kwh > 0.0
    assert response.loss_certainty == LossCertainty.CONFIRMED_LOSS

    # Financial Impact: 120 kWh * 7.50 = ₹900.00
    assert response.estimated_financial_impact_inr is not None
    assert abs(response.estimated_financial_impact_inr - 900.0) < 10.0

    # Priority score should be HIGH or CRITICAL (> 60)
    assert response.priority_ranking.composite_score >= 60.0
    assert response.priority_ranking.priority_level in [InspectionPriorityLevel.HIGH, InspectionPriorityLevel.CRITICAL]

    # Recommendations should be evidence-based
    assert len(response.recommendations) >= 1
    assert any("F18" in rec.action_title or "F18" in rec.evidence_grounding for rec in response.recommendations)


# -----------------------------------------------------------------------------
# 2. Rule 2: Missing or Zero Tariff
# -----------------------------------------------------------------------------

def test_missing_tariff_omits_financial_impact():
    """Rule 2: Never estimate financial impact without a known applicable tariff."""
    start = datetime(2026, 10, 9, 11, 0, 0, tzinfo=timezone.utc)
    end = datetime(2026, 10, 9, 13, 0, 0, tzinfo=timezone.utc)

    readings = [
        TelemetryIntervalPoint(timestamp=start, actual_power_kw=5.0, expected_power_kw=25.0),
        TelemetryIntervalPoint(timestamp=start + timedelta(hours=1), actual_power_kw=5.0, expected_power_kw=25.0),
        TelemetryIntervalPoint(timestamp=end, actual_power_kw=5.0, expected_power_kw=25.0),
    ]

    request = EnergyLossEstimationRequest(
        plant_id=2,
        installed_capacity_kwp=30.0,
        start_time=start,
        end_time=end,
        readings=readings,
        tariff_rate_inr=None,  # Missing tariff
    )

    response = energy_loss_service.estimate_energy_loss(request)

    assert response.estimated_shortfall_kwh > 0.0
    assert response.estimated_financial_impact_inr is None
    assert any("tariff" in lim.lower() for lim in response.uncertainty_limitations)


# -----------------------------------------------------------------------------
# 3. Rule 1: Single Reading / Incomplete Data
# -----------------------------------------------------------------------------

def test_single_reading_refuses_exact_energy_inference():
    """Rule 1: Never infer exact lost energy from a single low-power reading."""
    ts = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    single_reading = [
        TelemetryIntervalPoint(
            timestamp=ts,
            actual_power_kw=2.0,
            expected_power_kw=30.0,
            poa_irradiance_wm2=750.0,
        )
    ]

    request = EnergyLossEstimationRequest(
        plant_id=3,
        installed_capacity_kwp=35.0,
        start_time=ts,
        end_time=ts,
        readings=single_reading,
        tariff_rate_inr=8.0,
    )

    response = energy_loss_service.estimate_energy_loss(request)

    assert response.loss_certainty == LossCertainty.INSUFFICIENT_DATA
    assert response.estimated_shortfall_kwh == 0.0
    assert any("single telemetry sample" in lim.lower() for lim in response.uncertainty_limitations)


# -----------------------------------------------------------------------------
# 4. Rule 6: Overlapping Intervals Deduplication
# -----------------------------------------------------------------------------

def test_merge_overlapping_intervals_deduplication():
    """Rule 6: Avoid double-counting overlapping diagnosis periods."""
    t0 = datetime(2026, 10, 9, 8, 0, 0, tzinfo=timezone.utc)
    t1 = datetime(2026, 10, 9, 10, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    t3 = datetime(2026, 10, 9, 14, 0, 0, tzinfo=timezone.utc)
    t4 = datetime(2026, 10, 9, 16, 0, 0, tzinfo=timezone.utc)

    # 3 overlapping/adjacent intervals: [8:00 - 12:00], [10:00 - 14:00], [14:00 - 16:00]
    intervals = [
        (t0, t2),
        (t1, t3),
        (t3, t4),
    ]

    merged = energy_loss_service.merge_overlapping_intervals(intervals)

    assert len(merged) == 1
    assert merged[0][0] == t0.replace(tzinfo=None)
    assert merged[0][1] == t4.replace(tzinfo=None)


def test_merge_disjoint_intervals():
    """Disjoint intervals remain separate without false bridging."""
    t0 = datetime(2026, 10, 9, 8, 0, 0, tzinfo=timezone.utc)
    t1 = datetime(2026, 10, 9, 10, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 10, 9, 13, 0, 0, tzinfo=timezone.utc)
    t3 = datetime(2026, 10, 9, 15, 0, 0, tzinfo=timezone.utc)

    intervals = [(t0, t1), (t2, t3)]
    merged = energy_loss_service.merge_overlapping_intervals(intervals)

    assert len(merged) == 2
    assert merged[0] == (t0.replace(tzinfo=None), t1.replace(tzinfo=None))
    assert merged[1] == (t2.replace(tzinfo=None), t3.replace(tzinfo=None))


# -----------------------------------------------------------------------------
# 5. Rule 3: Multi-Cause Shortfall Attribution Partitioning
# -----------------------------------------------------------------------------

def test_multi_cause_attribution_partitioning():
    """Rule 3: Do not attribute all production shortfall to a single fault when multiple causes are possible."""
    start = datetime(2026, 10, 9, 11, 0, 0, tzinfo=timezone.utc)
    end = datetime(2026, 10, 9, 15, 0, 0, tzinfo=timezone.utc)

    readings = [
        TelemetryIntervalPoint(timestamp=start, actual_power_kw=0.0, expected_power_kw=50.0, ambient_temp_c=45.0, poa_irradiance_wm2=900.0),
        TelemetryIntervalPoint(timestamp=start + timedelta(hours=2), actual_power_kw=0.0, expected_power_kw=50.0, ambient_temp_c=46.0, poa_irradiance_wm2=850.0),
        TelemetryIntervalPoint(timestamp=end, actual_power_kw=0.0, expected_power_kw=50.0, ambient_temp_c=44.0, poa_irradiance_wm2=700.0),
    ]

    request = EnergyLossEstimationRequest(
        plant_id=4,
        installed_capacity_kwp=60.0,
        start_time=start,
        end_time=end,
        readings=readings,
        tariff_rate_inr=7.0,
        fault_codes=["F13"],  # Grid outage
        concurrent_diagnoses=[
            {"fault_class": "THERMAL_OVERHEAT", "fault_title": "Inverter Heatsink Overtemperature Derating", "severity": "HIGH"}
        ],
    )

    response = energy_loss_service.estimate_energy_loss(request)

    assert len(response.attribution_breakdown) >= 2
    # Total percentage must equal 100%
    total_pct = sum(item.percentage_of_total for item in response.attribution_breakdown)
    assert abs(total_pct - 100.0) < 0.5

    # No single cause should claim 100%
    for item in response.attribution_breakdown:
        assert item.percentage_of_total < 100.0
        assert item.allocated_shortfall_kwh > 0.0


# -----------------------------------------------------------------------------
# 6. Priority Ranking Formula Verification
# -----------------------------------------------------------------------------

def test_priority_ranking_scoring_components():
    """Verify priority score composition across severity, impact, duration, and evidence."""
    score_critical = energy_loss_service._calculate_priority_score(
        severity="CRITICAL",
        shortfall_kwh=150.0,
        financial_impact_inr=1200.0,
        duration_hours=30.0,
        coverage_percentage=95.0,
        has_confirmed_fault=True,
    )
    # Critical: S=40, I=30, D=15, E=15 -> 100.0
    assert score_critical.composite_score == 100.0
    assert score_critical.priority_level == InspectionPriorityLevel.CRITICAL

    score_low = energy_loss_service._calculate_priority_score(
        severity="LOW",
        shortfall_kwh=2.0,
        financial_impact_inr=15.0,
        duration_hours=0.5,
        coverage_percentage=60.0,
        has_confirmed_fault=False,
    )
    # Low: S=8, I=3, D=2, E=6 -> 19.0
    assert score_low.composite_score < 30.0
    assert score_low.priority_level in [InspectionPriorityLevel.LOW, InspectionPriorityLevel.INFORMATIONAL]


# -----------------------------------------------------------------------------
# 7. REST API Integration
# -----------------------------------------------------------------------------

def test_api_post_energy_loss_estimate(client):
    """POST /api/v1/diagnoses/energy-loss/estimate endpoint test."""
    start = datetime(2026, 10, 9, 9, 0, 0, tzinfo=timezone.utc)
    end = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)

    payload = {
        "plant_id": 1,
        "inverter_id": "INV-01",
        "installed_capacity_kwp": 40.0,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "readings": [
            {
                "timestamp": start.isoformat(),
                "actual_power_kw": 8.0,
                "expected_power_kw": 32.0,
                "poa_irradiance_wm2": 700.0,
                "ambient_temp_c": 30.0,
                "is_valid": True,
            },
            {
                "timestamp": end.isoformat(),
                "actual_power_kw": 8.0,
                "expected_power_kw": 32.0,
                "poa_irradiance_wm2": 700.0,
                "ambient_temp_c": 30.0,
                "is_valid": True,
            },
        ],
        "tariff_rate_inr": 7.50,
        "fault_codes": ["F24"],
        "baseline_method": "PHYSICS_POA_IRRADIANCE",
    }

    response = client.post("/api/v1/diagnoses/energy-loss/estimate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["plant_id"] == 1
    assert data["duration_hours"] == 3.0
    assert data["estimated_shortfall_kwh"] > 0.0
    assert data["estimated_financial_impact_inr"] > 0.0
    assert "priority_ranking" in data
    assert len(data["recommendations"]) >= 1
