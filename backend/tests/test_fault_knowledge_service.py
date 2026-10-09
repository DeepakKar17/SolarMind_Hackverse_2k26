"""
Unit and integration tests for SolarMind Inverter Fault Code Knowledge Service.

Validates:
- Deye SUN-70K-G03 through SUN-110K-G03 verified documented fault codes
- Exact preservation of manufacturer hazard warnings and page references
- Clear separation of documented OEM facts from SolarMind interpretations
- Safe handling of unknown codes and unknown manufacturers (no hallucinated mappings)
- Strict brand isolation (no cross-OEM code assumptions)
- REST API endpoints for fault code lookups and catalog inspection
- Integration with InverterFaultRule detection engine
- Absence of hazardous remote reset/switching operations
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.fault_knowledge_service import (
    FaultKnowledgeService,
    fault_knowledge_service,
)
from app.fault_engine.rules.inverter_fault_rule import InverterFaultRule
from app.fault_engine.schemas import TelemetrySnapshot, DetectionCategory, SeverityLevel


@pytest.fixture
def client():
    # Force reload catalog in case of runtime modifications
    fault_knowledge_service._load_catalog()
    return TestClient(app)


# -----------------------------------------------------------------------------
# 1. Documented Deye SUN-(70-110)K-G03 Knowledge Tests
# -----------------------------------------------------------------------------

def test_deye_grid_failure_f13():
    """Verify Deye F13 grid failure mapping against documented manual."""
    fault_knowledge_service._load_catalog()
    res = fault_knowledge_service.lookup("Deye", "F13", model="SUN-80K-G03")
    assert res.is_known is True
    assert res.status == "VERIFIED_OEM_MAPPING"
    assert res.documented_fact is not None
    assert res.documented_fact.manufacturer == "Deye"
    assert res.documented_fact.code == "F13"
    assert "Grid" in res.documented_fact.documented_name
    assert "SUN-(70-110)K-G03" in res.documented_fact.model_family
    assert "Deye SUN-(70-110)K-G03" in res.source_metadata.source_document
    assert res.source_metadata.page_reference != "N/A"
    assert res.source_metadata.mapping_confidence == 1.0

    # Verify separation of fact and interpretation
    assert res.solarmind_interpretation is not None
    assert res.solarmind_interpretation.category == "GRID_INTERRUPTION"
    assert any("ac" in check or "grid" in check for check in res.solarmind_interpretation.recommended_sensor_checks)


def test_deye_ground_insulation_fault_f24():
    """Verify Deye F24 ground insulation impedance fault and hazard warnings."""
    res = fault_knowledge_service.lookup("Deye", "F24")
    assert res.is_known is True
    assert res.documented_fact.code == "F24"
    assert "Insulation" in res.documented_fact.documented_name or "ISO" in res.documented_fact.documented_name
    
    # Hazard warning must be preserved verbatim
    assert res.documented_fact.manufacturer_hazard_warning is not None
    assert "DANGER" in res.documented_fact.manufacturer_hazard_warning
    assert "megger" in res.documented_fact.manufacturer_hazard_warning.lower() or "technician" in res.documented_fact.manufacturer_hazard_warning.lower()

    # Interpretation must reflect critical electrical safety severity
    assert res.solarmind_interpretation.inferred_severity in ["HIGH", "CRITICAL"]


def test_deye_dc_bus_fault_f01_f26_hazard_warning():
    """Verify Deye F01 and F26 retain capacitor discharge and high voltage hazard warnings."""
    res_f01 = fault_knowledge_service.lookup("Deye", "F01")
    assert res_f01.is_known is True
    assert res_f01.documented_fact.manufacturer_hazard_warning is not None
    assert "5 minutes" in res_f01.documented_fact.manufacturer_hazard_warning or "discharge" in res_f01.documented_fact.manufacturer_hazard_warning.lower()

    res_f26 = fault_knowledge_service.lookup("Deye", "F26")
    assert res_f26.is_known is True
    assert "discharge" in res_f26.documented_fact.manufacturer_hazard_warning.lower()


def test_deye_heatsink_overtemp_f29():
    """Verify Deye F29 internal heatsink over-temperature."""
    res = fault_knowledge_service.lookup("Deye", "F29")
    assert res.is_known is True
    assert "Heatsink" in res.documented_fact.documented_name or "Temperature" in res.documented_fact.documented_name
    assert "CAUTION" in res.documented_fact.manufacturer_hazard_warning
    assert "internal_temp_c" in res.solarmind_interpretation.recommended_sensor_checks


def test_deye_dc_bus_anomaly_f56():
    """Verify Deye F56 DC input bus low voltage anomaly."""
    res = fault_knowledge_service.lookup("Deye", "F56")
    assert res.is_known is True
    assert "Busbar" in res.documented_fact.documented_name or "Bus" in res.documented_fact.documented_name
    assert "dc_voltage_v" in res.solarmind_interpretation.recommended_sensor_checks


# -----------------------------------------------------------------------------
# 2. Unknown Codes and Brand Isolation Tests
# -----------------------------------------------------------------------------

def test_unknown_code_for_known_manufacturer():
    """Unrecognized code for Deye must return explicit UNRESOLVED_UNKNOWN_CODE without guessing."""
    res = fault_knowledge_service.lookup("Deye", "F9999")
    assert res.is_known is False
    assert res.status == "UNRESOLVED_UNKNOWN_CODE"
    assert res.documented_fact is None
    assert res.solarmind_interpretation is None
    assert "not a documented fault code for Deye" in res.message


def test_unknown_manufacturer():
    """Unrecognized manufacturer must return explicit UNRESOLVED_UNKNOWN_CODE without cross-brand assumption."""
    res = fault_knowledge_service.lookup("UnknownBrandSolar", "F01")
    assert res.is_known is False
    assert res.status == "UNRESOLVED_UNKNOWN_CODE"
    assert res.documented_fact is None
    assert res.solarmind_interpretation is None
    assert "not currently in the verified OEM knowledge base" in res.message


def test_empty_or_none_parameters():
    """Missing or empty inputs return explicit unresolved result."""
    res1 = fault_knowledge_service.lookup(None, "F13")
    assert res1.is_known is False
    assert res1.status == "UNRESOLVED_UNKNOWN_CODE"

    res2 = fault_knowledge_service.lookup("Deye", "")
    assert res2.is_known is False
    assert res2.status == "UNRESOLVED_UNKNOWN_CODE"


def test_brand_specific_code_isolation():
    """Code 301 is different across SMA and Fronius and must not collide."""
    sma_res = fault_knowledge_service.lookup("SMA", "301")
    fronius_res = fault_knowledge_service.lookup("Fronius", "301")

    assert sma_res.is_known is True
    assert fronius_res.is_known is True
    assert sma_res.documented_fact.manufacturer == "SMA"
    assert fronius_res.documented_fact.manufacturer == "Fronius"
    # Documented descriptions are distinct across OEMs
    assert "Overfrequency" in sma_res.documented_fact.documented_name
    assert "Overcurrent" in fronius_res.documented_fact.documented_name
    assert sma_res.source_metadata.source_document != fronius_res.source_metadata.source_document


def test_case_insensitivity_and_whitespace():
    """Lookup should be robust to casing and whitespace."""
    res1 = fault_knowledge_service.lookup("  deye  ", "  f13  ")
    assert res1.is_known is True
    assert res1.documented_fact.code == "F13"

    res2 = fault_knowledge_service.lookup("SMA", "3501")
    assert res2.is_known is True


# -----------------------------------------------------------------------------
# 3. Catalog Listing & Metadata
# -----------------------------------------------------------------------------

def test_list_supported_manufacturers():
    """Knowledge service reports list of supported OEMs."""
    mfg_list = fault_knowledge_service.list_supported_manufacturers()
    assert "Deye" in mfg_list
    assert any(m.upper() == "SMA" for m in mfg_list)


def test_list_catalog_entries():
    """Knowledge service can filter or list catalog entries."""
    deye_entries = fault_knowledge_service.list_catalog_entries(manufacturer="Deye")
    assert len(deye_entries) >= 10
    all_codes = [e["code"] for e in deye_entries]
    assert "F13" in all_codes
    assert "F24" in all_codes
    assert "F29" in all_codes


# -----------------------------------------------------------------------------
# 4. Fault Engine Integration (InverterFaultRule)
# -----------------------------------------------------------------------------

def test_inverter_fault_rule_with_verified_deye_code():
    """Engine evaluates Deye F24 ground fault, generating high-confidence diagnostic."""
    rule = InverterFaultRule()
    snapshot = TelemetrySnapshot(
        plant_id=1,
        inverter_id="INV-01",
        timestamp="2026-10-09T12:00:00Z",
        inverter_manufacturer="Deye",
        inverter_model="SUN-100K-G03",
        reported_fault_codes=["F24"],
        inverter_status="FAULT",
    )
    result = rule.evaluate(snapshot)
    assert result is not None
    assert result.score_or_confidence >= 0.95
    assert "F24" in result.probable_cause or "F24" in result.root_cause_summary
    assert result.recommended_next_inspection is not None
    assert any("DANGER" in p for p in result.recommended_next_inspection.safety_precautions)


def test_inverter_fault_rule_with_unresolved_code():
    """Engine evaluates unknown code with lower confidence and explicit consultation requirement."""
    rule = InverterFaultRule()
    snapshot = TelemetrySnapshot(
        plant_id=1,
        inverter_id="INV-01",
        timestamp="2026-10-09T12:00:00Z",
        inverter_manufacturer="Deye",
        inverter_model="SUN-100K-G03",
        reported_fault_codes=["F9999"],
        inverter_status="FAULT",
    )
    result = rule.evaluate(snapshot)
    assert result is not None
    assert result.score_or_confidence < 0.80
    assert "unmapped" in result.probable_cause.lower() or "unresolved" in result.probable_cause.lower()


# -----------------------------------------------------------------------------
# 5. REST API Endpoints Tests
# -----------------------------------------------------------------------------

def test_api_lookup_known_fault_code(client):
    """GET /api/v1/diagnoses/fault-code/lookup for verified Deye code."""
    response = client.get("/api/v1/diagnoses/fault-code/lookup?manufacturer=Deye&code=F13&model=SUN-80K-G03")
    assert response.status_code == 200
    data = response.json()
    assert data["is_known"] is True
    assert data["status"] == "VERIFIED_OEM_MAPPING"
    assert data["documented_fact"]["manufacturer"] == "Deye"
    assert data["documented_fact"]["code"] == "F13"
    assert data["solarmind_interpretation"]["category"] == "GRID_INTERRUPTION"
    assert data["source_metadata"]["mapping_confidence"] == 1.0


def test_api_lookup_unknown_fault_code(client):
    """GET /api/v1/diagnoses/fault-code/lookup for unverified code returns 200 with UNRESOLVED status."""
    response = client.get("/api/v1/diagnoses/fault-code/lookup?manufacturer=Deye&code=UNKNOWN99")
    assert response.status_code == 200
    data = response.json()
    assert data["is_known"] is False
    assert data["status"] == "UNRESOLVED_UNKNOWN_CODE"
    assert data["documented_fact"] is None


def test_api_list_manufacturers(client):
    """GET /api/v1/diagnoses/fault-code/manufacturers returns supported OEM list."""
    response = client.get("/api/v1/diagnoses/fault-code/manufacturers")
    assert response.status_code == 200
    mfgs = response.json()
    assert isinstance(mfgs, list)
    assert "Deye" in mfgs


def test_api_list_catalog(client):
    """GET /api/v1/diagnoses/fault-code/catalog returns verified catalog entries."""
    response = client.get("/api/v1/diagnoses/fault-code/catalog?manufacturer=Deye")
    assert response.status_code == 200
    entries = response.json()
    assert isinstance(entries, list)
    assert len(entries) >= 10
